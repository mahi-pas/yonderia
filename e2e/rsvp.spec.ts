import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { format, parseISO } from "date-fns";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import {
  addParticipant,
  createTestInviteCode,
  createTestTrip,
  insertEventRsvp,
} from "./helpers/seed";
import type { Database, ItineraryItemType } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type ReadyContext = Awaited<ReturnType<typeof createAuthenticatedContext>>;

type SeededRsvpScenario = {
  eventItemId: string;
  memberId: string;
  organizerId: string;
  tripId: string;
  viewCode: string;
};

let adminClient: ReturnType<typeof createAdminClient>;
let organizerAuth: ReadyContext;
let memberAuth: ReadyContext;
let userBAuth: ReadyContext;

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createAdminClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function markProfileReady(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  displayName: string,
) {
  const { error } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      display_name: displayName,
      has_completed_onboarding: true,
    })
    .eq("id", userId);
  if (error) throw error;
}

async function updateTrip(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  values: { name?: string; start_date?: string; end_date?: string },
) {
  const { error } = await adminClient
    .from("trips")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update(values)
    .eq("id", tripId);
  if (error) throw error;
}

async function insertItineraryItem(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  createdBy: string,
  input: {
    dayDate: string;
    itemType: ItineraryItemType;
    title: string;
    sortOrder?: number;
  },
): Promise<string> {
  const id = randomUUID();
  const { error } = await adminClient
    .from("itinerary_items")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .insert({
      id,
      trip_id: tripId,
      item_type: input.itemType,
      title: input.title,
      description: null,
      image_url: null,
      day_date: input.dayDate,
      start_time: null,
      end_time: null,
      location_name: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      destination_name: null,
      destination_latitude: null,
      destination_longitude: null,
      sort_order: input.sortOrder ?? 0,
      created_by: createdBy,
    });
  if (error) throw error;
  return id;
}

function buildTripUrl(tripId: string, options?: { code?: string }) {
  const params = new URLSearchParams({ mapMock: "1" });
  if (options?.code) params.set("code", options.code);
  return `/trip/${tripId}?${params.toString()}`;
}

function getDayLabel(dayDate: string): string {
  return format(parseISO(dayDate), "EEE, MMM d");
}

function getDayHeadingLabel(dayNumber: number, dayDate: string): string {
  return `Day ${dayNumber} — ${getDayLabel(dayDate)}`;
}

function getDayToggle(page: import("@playwright/test").Page, dayNumber: number, dayDate: string) {
  return page
    .locator("button")
    .filter({ has: page.getByRole("heading", { name: getDayHeadingLabel(dayNumber, dayDate) }) })
    .first();
}

async function seedRsvpScenario(): Promise<SeededRsvpScenario> {
  const organizerId = organizerAuth.user.id;
  const memberId = memberAuth.user.id;
  const createdTrip = await createTestTrip(organizerId);
  const tripId = createdTrip.trip.id;

  await updateTrip(adminClient, tripId, {
    name: "RSVP E2E Trip",
    start_date: "2026-06-01",
    end_date: "2026-06-03",
  });
  await addParticipant(tripId, memberId, "member");

  const dayDate = "2026-06-01";
  const eventItemId = await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate,
    itemType: "event",
    title: "RSVP Test Event",
    sortOrder: 1,
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate,
    itemType: "hotel",
    title: "Test Hotel",
    sortOrder: 2,
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate,
    itemType: "commute",
    title: "Test Commute",
    sortOrder: 3,
  });

  await insertEventRsvp(eventItemId, organizerId, "going");
  await insertEventRsvp(eventItemId, memberId, "interested");

  const viewCode = (await createTestInviteCode(tripId, "view")).code;

  return {
    eventItemId,
    memberId,
    organizerId,
    tripId,
    viewCode,
  };
}

async function routeImageSearch(page: import("@playwright/test").Page) {
  await page.route("**/api/images/search**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ results: [] }),
      contentType: "application/json",
      status: 200,
    });
  });
}

test.beforeAll(async ({ baseURL, browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser, { baseURL });
  memberAuth = await createAuthenticatedContext(browser, { baseURL });
  userBAuth = await createAuthenticatedContext(browser, { baseURL });

  await markProfileReady(adminClient, organizerAuth.user.id, "Olive Organizer");
  await markProfileReady(adminClient, memberAuth.user.id, "Mina Member");
  await markProfileReady(adminClient, userBAuth.user.id, "User B");
});

test.afterAll(async () => {
  if (organizerAuth?.context) await organizerAuth.context.close();
  if (memberAuth?.context) await memberAuth.context.close();
  if (userBAuth?.context) await userBAuth.context.close();
});

test("Event card shows a going count badge", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await expect(page.getByTitle("1 going")).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Opening event detail shows the three RSVP buttons", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await page.getByRole("button", { name: "RSVP Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Going" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Interested" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Not going" })).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Clicking Going highlights the button and increments the count", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await memberAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await page.getByRole("button", { name: "RSVP Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const goingButton = dialog.getByRole("button", { name: "Going" });
    await goingButton.click();

    await expect(goingButton).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText(/2 going/)).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Clicking Going again deselects it and decrements the count", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await memberAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await page.getByRole("button", { name: "RSVP Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const goingButton = dialog.getByRole("button", { name: "Going" });
    await goingButton.click();
    await expect(goingButton).toHaveAttribute("aria-pressed", "true");
    await goingButton.click();
    await expect(goingButton).toHaveAttribute("aria-pressed", "false");
    await expect(dialog.getByText(/1 going/)).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Switching from Going to Interested updates both counts", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await page.getByRole("button", { name: "RSVP Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Interested" }).click();
    await expect(dialog.getByRole("button", { name: "Interested" })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText(/2 interested/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Going" })).toHaveAttribute("aria-pressed", "false");
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("See who's going link opens the RSVP list with correct groupings", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await page.getByRole("button", { name: "RSVP Test Event" }).first().click();

    const detailDialog = page.getByRole("dialog");
    await detailDialog.getByRole("link", { name: "See who's going" }).click();

    const rsvpListDialog = page.getByRole("dialog", { name: /Who's going/ });
    await expect(rsvpListDialog.getByText("Going (1)")).toBeVisible();
    await expect(rsvpListDialog.getByText("Interested (1)")).toBeVisible();
    await expect(rsvpListDialog.getByText("Olive Organizer")).toBeVisible();
    await expect(rsvpListDialog.getByText("Mina Member")).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("RSVP buttons appear for hotel and commute items", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-06-01").click();
    await page.getByRole("button", { name: "Test Hotel" }).first().click();
    const hotelDialog = page.getByRole("dialog");
    await expect(hotelDialog.getByRole("button", { name: "Going" })).toBeVisible();
    await expect(hotelDialog.getByRole("button", { name: "Interested" })).toBeVisible();

    await hotelDialog.getByRole("button", { name: "×" }).click();
    await page.getByRole("button", { name: "Test Commute" }).first().click();
    const commuteDialog = page.getByRole("dialog");
    await expect(commuteDialog.getByRole("button", { name: "Going" })).toBeVisible();
    await expect(commuteDialog.getByRole("button", { name: "Interested" })).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Real-time: User A RSVPs in one tab → count updates in User B's tab without refresh", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const pageA = await organizerAuth.context.newPage();
    const pageB = await memberAuth.context.newPage();
    await routeImageSearch(pageA);
    await routeImageSearch(pageB);
    await pageA.goto(buildTripUrl(scenario.tripId));
    await pageB.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(pageA, 1, "2026-06-01").click();
    await getDayToggle(pageB, 1, "2026-06-01").click();

    await pageB.getByRole("button", { name: "RSVP Test Event" }).first().click();
    const dialogB = pageB.getByRole("dialog");
    await expect(dialogB.getByText(/1 going/)).toBeVisible();

    await pageA.getByRole("button", { name: "RSVP Test Event" }).first().click();
    const dialogA = pageA.getByRole("dialog");
    await dialogA.getByRole("button", { name: "Going" }).click();
    await expect(dialogA.getByText(/2 going/)).toBeVisible();

    await expect(dialogB.getByText(/2 going/)).toBeVisible({ timeout: 15000 });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("View-only page shows aggregate RSVP counts but no RSVP buttons", async () => {
  let scenario: SeededRsvpScenario | null = null;
  try {
    scenario = await seedRsvpScenario();
    const page = await userBAuth.context.newPage();
    await routeImageSearch(page);
    await page.goto(buildTripUrl(scenario.tripId, { code: scenario.viewCode }));

    await getDayToggle(page, 1, "2026-06-01").click();
    await expect(page.getByTitle(/going/)).toBeVisible();
    await page.getByRole("button", { name: "RSVP Test Event" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Going" })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "See who's going" })).toHaveCount(0);
    await expect(dialog.getByText(/1 going/)).toBeVisible();
    await expect(dialog.getByText(/1 interested/)).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});
