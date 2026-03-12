import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestTrip } from "./helpers/seed";
import type { Database, ItineraryItemType, Trip } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type ReadyContext = Awaited<ReturnType<typeof createAuthenticatedContext>>;

type SeededTripContext = {
  memberId?: string;
  plannerId?: string;
  tripId: string;
};

type SeedItineraryItemInput = {
  dayDate: string;
  description?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  destinationName?: string | null;
  endTime?: string | null;
  imageUrl?: string | null;
  itemType: ItineraryItemType;
  latitude?: number | null;
  locationName?: string | null;
  longitude?: number | null;
  sortOrder?: number;
  startTime?: string | null;
  title: string;
};

let adminClient: ReturnType<typeof createAdminClient>;
let organizerAuth: ReadyContext;
let plannerAuth: ReadyContext;
let memberAuth: ReadyContext;

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

  if (error) {
    throw error;
  }
}

async function createParticipantUser(
  adminClient: ReturnType<typeof createAdminClient>,
  displayName: string,
) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: `itinerary-${Date.now()}-${Math.random()}@yonderia.test`,
    email_confirm: true,
    password: "PlaywrightPassword123!",
    user_metadata: {
      full_name: displayName,
    },
  });

  if (error) {
    throw error;
  }

  const userId = data.user?.id;

  if (!userId) {
    throw new Error("Expected created participant test user.");
  }

  await markProfileReady(adminClient, userId, displayName);
  return userId;
}

async function updateTrip(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  values: Partial<Trip>,
) {
  const { error } = await adminClient
    .from("trips")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update(values)
    .eq("id", tripId);

  if (error) {
    throw error;
  }
}

async function insertItineraryItem(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  createdBy: string,
  input: SeedItineraryItemInput,
) {
  const { error } = await adminClient
    .from("itinerary_items")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .insert({
      created_by: createdBy,
      day_date: input.dayDate,
      description: input.description ?? null,
      destination_latitude: input.destinationLatitude ?? null,
      destination_longitude: input.destinationLongitude ?? null,
      destination_name: input.destinationName ?? null,
      end_time: input.endTime ?? null,
      id: randomUUID(),
      image_url: input.imageUrl ?? null,
      item_type: input.itemType,
      latitude: input.latitude ?? null,
      location_name: input.locationName ?? null,
      longitude: input.longitude ?? null,
      sort_order: input.sortOrder ?? 0,
      start_time: input.startTime ?? null,
      title: input.title,
      trip_id: tripId,
    });

  if (error) {
    throw error;
  }
}

async function seedThreeDayTripScenario(
  adminClient: ReturnType<typeof createAdminClient>,
  organizerId: string,
  options?: {
    memberId?: string;
    plannerId?: string;
  },
): Promise<SeededTripContext> {
  const createdTrip = await createTestTrip(organizerId);
  const tripId = createdTrip.trip.id;

  await updateTrip(adminClient, tripId, {
    description: "A three-day Paris getaway with museums, trains, and a cozy hotel.",
    image_url: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    location_name: "Paris, France",
    name: "Paris Itinerary Test Trip",
    start_date: "2026-05-01",
    end_date: "2026-05-03",
  });

  if (options?.plannerId) {
    await addParticipant(tripId, options.plannerId, "planner");
  }

  if (options?.memberId) {
    await addParticipant(tripId, options.memberId, "member");
  }

  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "See the classics before the crowds roll in.",
    endTime: "2026-05-01T16:00:00.000Z",
    imageUrl: "https://example.com/museum-visit.jpg",
    itemType: "event",
    latitude: 48.8606,
    locationName: "Louvre Museum",
    longitude: 2.3376,
    sortOrder: 2,
    startTime: "2026-05-01T14:00:00.000Z",
    title: "Museum Visit",
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "Fuel up for the day.",
    endTime: "2026-05-01T09:45:00.000Z",
    imageUrl: "https://example.com/coffee-run.jpg",
    itemType: "event",
    latitude: 48.853,
    locationName: "Cafe de Flore",
    longitude: 2.333,
    sortOrder: 1,
    startTime: "2026-05-01T09:00:00.000Z",
    title: "Coffee Run",
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "Drop bags and settle in whenever everyone arrives.",
    imageUrl: "https://example.com/hotel-regina.jpg",
    itemType: "hotel",
    latitude: 48.8638,
    locationName: "Hotel Regina",
    longitude: 2.3331,
    sortOrder: 3,
    startTime: null,
    title: "Hotel Check-in",
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate: "2026-05-02",
    description: "Morning ride out to the palace.",
    destinationLatitude: 48.8049,
    destinationLongitude: 2.1204,
    destinationName: "Versailles Chateau",
    endTime: "2026-05-02T09:15:00.000Z",
    imageUrl: "https://example.com/versailles-train.jpg",
    itemType: "commute",
    latitude: 48.8414,
    locationName: "Gare Montparnasse",
    longitude: 2.3208,
    sortOrder: 1,
    startTime: "2026-05-02T08:30:00.000Z",
    title: "Versailles Train",
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate: "2026-05-02",
    description: "Tour the palace and gardens.",
    endTime: "2026-05-02T13:00:00.000Z",
    imageUrl: "https://example.com/palace-tour.jpg",
    itemType: "event",
    latitude: 48.8049,
    locationName: "Palace of Versailles",
    longitude: 2.1204,
    sortOrder: 2,
    startTime: "2026-05-02T11:00:00.000Z",
    title: "Palace Tour",
  });
  await insertItineraryItem(adminClient, tripId, organizerId, {
    dayDate: "2026-05-03",
    description: "One last meal before checkout.",
    endTime: "2026-05-03T11:15:00.000Z",
    imageUrl: "https://example.com/farewell-brunch.jpg",
    itemType: "event",
    latitude: 48.8667,
    locationName: "Le Marais",
    longitude: 2.361,
    sortOrder: 1,
    startTime: "2026-05-03T10:00:00.000Z",
    title: "Farewell Brunch",
  });

  return {
    memberId: options?.memberId,
    plannerId: options?.plannerId,
    tripId,
  };
}

async function deleteUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

async function routeImageSearch(
  page: Page,
  options?: {
    results?: { imageUrl: string; sourceUrl: string; title: string }[];
  },
) {
  const queries: string[] = [];

  await page.route("**/api/images/search**", async (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    await route.fulfill({
      body: JSON.stringify({
        results:
          options?.results ??
          [
            {
              imageUrl: "https://example.com/mock-suggestion.jpg",
              sourceUrl: "https://example.com/mock-source",
              title: "Mock suggestion",
            },
          ],
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  return queries;
}

function getDayLabel(dayDate: string): string {
  return format(parseISO(dayDate), "EEE, MMM d");
}

function getDayHeadingLabel(dayNumber: number, dayDate: string): string {
  return `Day ${dayNumber} — ${getDayLabel(dayDate)}`;
}

function getDayHeaderButton(page: Page, dayNumber: number, dayDate: string) {
  return page
    .locator("button")
    .filter({ has: page.getByRole("heading", { name: getDayHeadingLabel(dayNumber, dayDate) }) })
    .first();
}

function getDaySection(page: Page, dayNumber: number, dayDate: string) {
  return getDayHeaderButton(page, dayNumber, dayDate).locator("..");
}

function getDayPanel(page: Page, dayNumber: number, dayDate: string) {
  return getDayHeaderButton(page, dayNumber, dayDate).locator("xpath=following-sibling::div[1]");
}

async function getDayCardTitles(page: Page, dayNumber: number, dayDate: string) {
  const titles = await getDaySection(page, dayNumber, dayDate).locator("button.group h3").allTextContents();
  return titles.map((title) => title.trim());
}

test.beforeAll(async ({ baseURL, browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser, { baseURL });
  plannerAuth = await createAuthenticatedContext(browser, { baseURL });
  memberAuth = await createAuthenticatedContext(browser, { baseURL });

  await markProfileReady(adminClient, organizerAuth.user.id, "Olive Organizer");
  await markProfileReady(adminClient, plannerAuth.user.id, "Parker Planner");
  await markProfileReady(adminClient, memberAuth.user.id, "Mina Member");
});

test.afterAll(async () => {
  if (organizerAuth?.context) await organizerAuth.context.close();
  if (plannerAuth?.context) await plannerAuth.context.close();
  if (memberAuth?.context) await memberAuth.context.close();
  if (organizerAuth?.user?.id) await deleteUser(adminClient, organizerAuth.user.id);
  if (plannerAuth?.user?.id) await deleteUser(adminClient, plannerAuth.user.id);
  if (memberAuth?.user?.id) await deleteUser(adminClient, memberAuth.user.id);
});

test("Day sections render for each day of the trip with the right labels", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await expect(page.getByRole("heading", { name: getDayHeadingLabel(1, "2026-05-01") })).toBeVisible();
    await expect(page.getByRole("heading", { name: getDayHeadingLabel(2, "2026-05-02") })).toBeVisible();
    await expect(page.getByRole("heading", { name: getDayHeadingLabel(3, "2026-05-03") })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: /^Day \d/ })).toHaveCount(3);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Day 1 is expanded by default and other days start collapsed", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await expect(page.getByText("Coffee Run")).toBeVisible();
    await expect(getDayPanel(page, 1, "2026-05-01")).toHaveClass(/grid-rows-\[1fr\]/);
    await expect(getDayPanel(page, 2, "2026-05-02")).toHaveClass(/grid-rows-\[0fr\]/);
    await expect(getDayPanel(page, 3, "2026-05-03")).toHaveClass(/grid-rows-\[0fr\]/);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Clicking a day header toggles expand and collapse", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    const dayTwoHeader = getDayHeaderButton(page, 2, "2026-05-02");
    await dayTwoHeader.click();
    await expect(getDayPanel(page, 2, "2026-05-02")).toHaveClass(/grid-rows-\[1fr\]/);

    const dayOneHeader = getDayHeaderButton(page, 1, "2026-05-01");
    await dayOneHeader.click();
    await expect(getDayPanel(page, 1, "2026-05-01")).toHaveClass(/grid-rows-\[0fr\]/);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Organizer sees Add Event", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const organizerPage = await organizerAuth.context.newPage();
    await organizerPage.goto(`/trip/${seeded.tripId}`);
    await expect(organizerPage.getByRole("button", { name: "Add Event" }).first()).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Planner sees Add Event", async () => {
  let organizerId: string | null = null;
  let seeded: SeededTripContext | null = null;

  try {
    organizerId = await createParticipantUser(adminClient, "Olive Organizer");
    seeded = await seedThreeDayTripScenario(adminClient, organizerId, {
      plannerId: plannerAuth.user.id,
    });

    const plannerPage = await plannerAuth.context.newPage();
    await plannerPage.goto(`/trip/${seeded.tripId}`);
    await expect(plannerPage.getByRole("button", { name: "Add Event" }).first()).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
    if (organizerId) {
      await deleteUser(adminClient, organizerId);
    }
  }
});

test("Member does not see Add Event", async () => {
  let organizerId: string | null = null;
  let seeded: SeededTripContext | null = null;

  try {
    organizerId = await createParticipantUser(adminClient, "Olive Organizer");
    seeded = await seedThreeDayTripScenario(adminClient, organizerId, {
      memberId: memberAuth.user.id,
    });

    const memberPage = await memberAuth.context.newPage();
    await memberPage.goto(`/trip/${seeded.tripId}`);
    await expect(memberPage.getByRole("button", { name: "Add Event" })).toHaveCount(0);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
    if (organizerId) {
      await deleteUser(adminClient, organizerId);
    }
  }
});

test("Add Event modal switches fields across Event, Hotel, and Commute tabs", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await page.getByRole("button", { name: "Add Event" }).first().click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByLabel("Time", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel(/^Check-in time/)).toHaveCount(0);
    await expect(dialog.getByLabel("Origin", { exact: true })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Hotel" }).click();
    await expect(dialog.getByLabel(/^Check-in time/)).toBeVisible();
    await expect(dialog.getByLabel(/^Check-out time/)).toBeVisible();
    await expect(dialog.getByLabel("Time", { exact: true })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Commute" }).click();
    await expect(dialog.getByLabel("Departure time", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel(/^Origin/)).toBeVisible();
    await expect(dialog.getByLabel(/^Destination/)).toBeVisible();
    await expect(dialog.getByLabel(/^Check-in time/)).toHaveCount(0);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Creating an event saves it into the correct day section", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await getDaySection(page, 2, "2026-05-02").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Seine Picnic");
    await dialog.getByLabel("Time").fill("15:30");
    await dialog.getByLabel("Location").fill("Seine River Bank");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(getDaySection(page, 2, "2026-05-02").getByText("Seine Picnic")).toBeVisible();
    await expect(getDaySection(page, 2, "2026-05-02").getByText("Seine River Bank")).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Creating a hotel without check-in time puts it at the end of the day", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Hotel" }).click();
    await dialog.getByLabel("Title").fill("Late Hotel");
    await dialog.getByLabel("Location").fill("Saint Germain Hotel");
    await dialog.getByRole("button", { name: "Save Hotel" }).click();

    await expect(getDaySection(page, 1, "2026-05-01").getByText("Late Hotel")).toBeVisible();
    await expect.poll(async () => getDayCardTitles(page, 1, "2026-05-01")).toEqual([
      "Coffee Run",
      "Museum Visit",
      "Hotel Check-in",
      "Late Hotel",
    ]);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Creating a commute shows both origin and destination on the card", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDayHeaderButton(page, 3, "2026-05-03").click();
    await getDaySection(page, 3, "2026-05-03").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Commute" }).click();
    await dialog.getByLabel("Title").fill("Airport Transfer");
    await dialog.getByLabel("Departure time").fill("07:45");
    await dialog.getByLabel("Origin").fill("Hotel Regina");
    await dialog.getByLabel("Destination").fill("Charles de Gaulle Airport");
    await dialog.getByRole("button", { name: "Save Commute" }).click();

    await expect(getDaySection(page, 3, "2026-05-03").getByText("Airport Transfer")).toBeVisible();
    await expect(
      getDaySection(page, 3, "2026-05-03").getByText("Hotel Regina to Charles de Gaulle Airport"),
    ).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Itinerary cards are sorted by start_time and card click opens full details", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await expect.poll(async () => getDayCardTitles(page, 1, "2026-05-01")).toEqual([
      "Coffee Run",
      "Museum Visit",
      "Hotel Check-in",
    ]);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: /Museum Visit/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("See the classics before the crowds roll in.")).toBeVisible();
    await expect(dialog.locator('img[alt="Museum Visit"]')).toBeVisible();
    await expect(dialog.getByText(format(new Date("2026-05-01T14:00:00.000Z"), "MMM d, yyyy h:mm a"))).toBeVisible();
    await expect(dialog.getByText(format(new Date("2026-05-01T16:00:00.000Z"), "MMM d, yyyy h:mm a"))).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Entering a title triggers auto-image search and shows the suggested image", async () => {
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    const queries = await routeImageSearch(page, {
      results: [
        {
          imageUrl: "https://example.com/eiffel-picnic.jpg",
          sourceUrl: "https://example.com/eiffel-picnic-source",
          title: "Eiffel picnic suggestion",
        },
      ],
    });
    await page.goto(`/trip/${seeded.tripId}`);

    await page.getByRole("button", { name: "Add Event" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Eiffel Picnic");

    await expect(dialog.locator('img[alt="Eiffel Picnic"]')).toBeVisible({ timeout: 5000 });
    await expect.poll(() => queries.length).toBeGreaterThan(0);
    expect(queries.some((query) => query.includes("Eiffel Picnic"))).toBe(true);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("On mobile the Add Event modal opens as a full-screen bottom sheet", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only assertion.");

  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedThreeDayTripScenario(adminClient, organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await page.getByRole("button", { name: "Add Event" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const dialogBox = await dialog.boundingBox();
    const viewport = page.viewportSize();

    expect(dialogBox).not.toBeNull();
    expect(viewport).not.toBeNull();

    expect(dialogBox!.height).toBeGreaterThan((viewport?.height ?? 0) - 20);
    expect(dialogBox!.width).toBeGreaterThan((viewport?.width ?? 0) - 20);
    expect(dialogBox!.y).toBeLessThanOrEqual(5);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});
