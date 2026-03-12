import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { format, parseISO } from "date-fns";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import {
  addParticipant,
  createTestInviteCode,
  createTestTrip,
  insertEventComment,
} from "./helpers/seed";
import type { Database, ItineraryItemType } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type ReadyContext = Awaited<ReturnType<typeof createAuthenticatedContext>>;

type SeededCommentsScenario = {
  eventItemId: string;
  memberId: string;
  organizerId: string;
  tripId: string;
  viewCode: string;
};

let adminClient: ReturnType<typeof createAdminClient>;
let organizerAuth: ReadyContext;
let memberAuth: ReadyContext;
let otherMemberAuth: ReadyContext;

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
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  displayName: string,
) {
  const { error } = await admin
    .from("profiles")
    // @ts-expect-error Supabase infers never from handcrafted Database type
    .update({
      display_name: displayName,
      has_completed_onboarding: true,
    })
    .eq("id", userId);
  if (error) throw error;
}

async function insertItineraryItem(
  admin: ReturnType<typeof createAdminClient>,
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
  const { error } = await admin
    .from("itinerary_items")
    // @ts-expect-error Supabase infers never from handcrafted Database type
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

function getDayLabel(dayDate: string) {
  return format(parseISO(dayDate), "EEE, MMM d");
}

function getDayHeadingLabel(dayNumber: number, dayDate: string) {
  return `Day ${dayNumber} — ${getDayLabel(dayDate)}`;
}

function getDayToggle(
  page: import("@playwright/test").Page,
  dayNumber: number,
  dayDate: string,
) {
  return page
    .locator("button")
    .filter({
      has: page.getByRole("heading", { name: getDayHeadingLabel(dayNumber, dayDate) }),
    })
    .first();
}

async function seedCommentsScenario(): Promise<SeededCommentsScenario> {
  const organizerId = organizerAuth.user.id;
  const memberId = memberAuth.user.id;
  const created = await createTestTrip(organizerId);
  const tripId = created.trip.id;

  await adminClient
    .from("trips")
    // @ts-expect-error Supabase infers never
    .update({
      name: "Comments E2E Trip",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
    })
    .eq("id", tripId);

  await addParticipant(tripId, memberId, "member");

  const dayDate = "2026-07-01";
  const eventItemId = await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate,
    itemType: "event",
    title: "Comments Test Event",
    sortOrder: 1,
  });

  await insertEventComment(eventItemId, organizerId, {
    content: "Pre-existing text comment from organizer",
  });
  await insertEventComment(eventItemId, memberId, {
    gifUrl: "https://media.tenor.com/test.gif",
  });

  const viewCode = (await createTestInviteCode(tripId, "view")).code;

  return {
    eventItemId,
    memberId,
    organizerId,
    tripId,
    viewCode,
  };
}

function routeGifApis(page: import("@playwright/test").Page) {
  page.route("**/api/gifs/search**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        next: "",
        results: [
          {
            id: "e2e-gif-1",
            url: "https://example.com/tiny.gif",
            fullUrl: "https://example.com/full.gif",
            width: 100,
            height: 100,
          },
        ],
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  page.route("**/api/gifs/trending**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        next: "",
        results: [
          {
            id: "e2e-trending-1",
            url: "https://example.com/trend-tiny.gif",
            fullUrl: "https://example.com/trend-full.gif",
            width: 90,
            height: 90,
          },
        ],
      }),
      contentType: "application/json",
      status: 200,
    });
  });
}

test.beforeAll(async ({ browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser);
  memberAuth = await createAuthenticatedContext(browser);
  otherMemberAuth = await createAuthenticatedContext(browser);

  await markProfileReady(adminClient, organizerAuth.user.id, "Olive Organizer");
  await markProfileReady(adminClient, memberAuth.user.id, "Mina Member");
  await markProfileReady(adminClient, otherMemberAuth.user.id, "Other Member");
});

test.afterAll(async () => {
  await organizerAuth.context.close();
  await memberAuth.context.close();
  await otherMemberAuth.context.close();
});

test("Event detail shows the comments section", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await organizerAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Comments")).toBeVisible();
    await expect(dialog.getByPlaceholder("Add a comment...")).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("User can type and send a text comment", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const input = dialog.getByPlaceholder("Add a comment...");
    await input.fill("Hello from the test!");
    await dialog.getByRole("button", { name: "Send comment" }).click();

    await expect(dialog.getByText("Hello from the test!")).toBeVisible({ timeout: 5000 });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Comment appears in the list with avatar, name, and timestamp", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await organizerAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Pre-existing text comment from organizer")).toBeVisible();
    await expect(dialog.getByText("Olive Organizer")).toBeVisible();
    await expect(dialog.getByText("Mina Member")).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("User can open the GIF picker, search for a GIF, and send it", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add GIF" }).click();

    await expect(page.getByRole("dialog", { name: "Pick a GIF" })).toBeVisible();
    await page.getByPlaceholder("Search GIFs").fill("happy");
    await page.waitForTimeout(400);
    await page.locator("button").filter({ has: page.locator('img[src*="tiny.gif"]') }).first().click();
    await page.getByRole("button", { name: "Send" }).click();

    await expect(dialog.getByText("GIF added")).toBeVisible({ timeout: 3000 });
    await dialog.getByRole("button", { name: "Send comment" }).click();
    await expect(dialog.locator('img[src="https://example.com/full.gif"]')).toBeVisible({
      timeout: 5000,
    });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("GIF renders correctly in the comment list", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await organizerAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('img[src="https://media.tenor.com/test.gif"]')).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("User can delete their own comment (trash icon → removed)", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Add a comment...").fill("I will delete this");
    await dialog.getByRole("button", { name: "Send comment" }).click();

    await expect(dialog.getByText("I will delete this")).toBeVisible({ timeout: 5000 });

    const commentRow = dialog.getByText("I will delete this").locator("..").locator("..");
    await commentRow.getByRole("button", { name: "Delete comment" }).click();

    await expect(dialog.getByText("I will delete this")).not.toBeVisible({ timeout: 5000 });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Organizer can delete any comment", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await organizerAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const memberGifRow = dialog
      .locator('img[src="https://media.tenor.com/test.gif"]')
      .locator("..")
      .locator("..");
    await memberGifRow.getByRole("button", { name: "Delete comment" }).click();

    await expect(dialog.locator('img[src="https://media.tenor.com/test.gif"]')).not.toBeVisible({
      timeout: 5000,
    });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Member cannot delete other people's comments", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Pre-existing text comment from organizer")).toBeVisible();
    const deleteButtons = dialog.getByRole("button", { name: "Delete comment" });
    await expect(deleteButtons).toHaveCount(1);
    const organizerCommentRow = dialog
      .getByText("Pre-existing text comment from organizer")
      .locator("..")
      .locator("..");
    await expect(organizerCommentRow.getByRole("button", { name: "Delete comment" })).toHaveCount(0);
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Pressing Enter sends the comment", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const input = dialog.getByPlaceholder("Add a comment...");
    await input.fill("Sent with Enter");
    await input.press("Enter");

    await expect(dialog.getByText("Sent with Enter")).toBeVisible({ timeout: 5000 });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Pressing Shift+Enter creates a newline instead of sending", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const input = dialog.getByPlaceholder("Add a comment...");
    await input.fill("Line one");
    await input.press("Shift+Enter");
    await input.type("Line two");
    await dialog.getByRole("button", { name: "Send comment" }).click();

    await expect(dialog.getByText("Line one")).toBeVisible();
    await expect(dialog.getByText("Line two")).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Comment count badge shows on the itinerary card", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await organizerAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await expect(page.getByTitle("Comments").filter({ hasText: "💬 2" })).toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Real-time: User A comments → comment appears in User B's view without refresh", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const pageA = await organizerAuth.context.newPage();
    const pageB = await memberAuth.context.newPage();
    routeGifApis(pageA);
    routeGifApis(pageB);
    await pageA.goto(buildTripUrl(scenario.tripId));
    await pageB.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(pageA, 1, "2026-07-01").click();
    await getDayToggle(pageB, 1, "2026-07-01").click();

    await pageA.getByRole("button", { name: "Comments Test Event" }).first().click();
    await pageB.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialogA = pageA.getByRole("dialog");
    await dialogA.getByPlaceholder("Add a comment...").fill("Real-time test message");
    await dialogA.getByRole("button", { name: "Send comment" }).click();

    const dialogB = pageB.getByRole("dialog");
    await expect(dialogB.getByText("Real-time test message")).toBeVisible({ timeout: 15000 });
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Comments section is NOT shown on the view-only page", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await otherMemberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId, { code: scenario.viewCode }));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Comments")).not.toBeVisible();
    await expect(dialog.getByPlaceholder("Add a comment...")).not.toBeVisible();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});

test("Max character validation: typing 501 characters disables send", async () => {
  let scenario: SeededCommentsScenario | null = null;
  try {
    scenario = await seedCommentsScenario();
    const page = await memberAuth.context.newPage();
    routeGifApis(page);
    await page.goto(buildTripUrl(scenario.tripId));

    await getDayToggle(page, 1, "2026-07-01").click();
    await page.getByRole("button", { name: "Comments Test Event" }).first().click();

    const dialog = page.getByRole("dialog");
    const input = dialog.getByPlaceholder("Add a comment...");
    await input.fill("x".repeat(501));

    await expect(dialog.getByText("501/500")).toBeVisible();
    const sendButton = dialog.getByRole("button", { name: "Send comment" });
    await expect(sendButton).toBeDisabled();
  } finally {
    if (scenario) await adminClient.from("trips").delete().eq("id", scenario.tripId);
  }
});
