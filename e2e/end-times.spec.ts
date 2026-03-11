import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { createTestInviteCode, createTestTrip } from "./helpers/seed";
import type { Database, ItineraryItemType, Trip } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type ReadyContext = Awaited<ReturnType<typeof createAuthenticatedContext>>;

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

type SeededEndTimesScenario = {
  tripId: string;
  viewCode: string;
};

let adminClient: ReturnType<typeof createAdminClient>;
let organizerAuth: ReadyContext;

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

async function updateTrip(admin: ReturnType<typeof createAdminClient>, tripId: string, values: Partial<Trip>) {
  const { error } = await admin
    .from("trips")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update(values)
    .eq("id", tripId);

  if (error) {
    throw error;
  }
}

async function insertItineraryItem(
  admin: ReturnType<typeof createAdminClient>,
  tripId: string,
  createdBy: string,
  input: SeedItineraryItemInput,
) {
  const { error } = await admin
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

async function seedEndTimesScenario(
  admin: ReturnType<typeof createAdminClient>,
  organizerId: string,
): Promise<SeededEndTimesScenario> {
  const createdTrip = await createTestTrip(organizerId);
  const tripId = createdTrip.trip.id;

  await updateTrip(admin, tripId, {
    description: "A short trip seeded with timed and untimed itinerary items.",
    end_date: "2026-05-03",
    location_name: "Lisbon, Portugal",
    name: "End Times Coverage Trip",
    start_date: "2026-05-01",
  });

  await insertItineraryItem(admin, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "An event without an end time for display checks.",
    itemType: "event",
    latitude: 38.7223,
    locationName: "Alfama",
    longitude: -9.1393,
    sortOrder: 0,
    startTime: "2026-05-01T09:00:00.000Z",
    title: "Morning Walk",
  });
  await insertItineraryItem(admin, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "Shorter event should sort first when start times match.",
    endTime: "2026-05-01T11:00:00.000Z",
    itemType: "event",
    latitude: 38.7139,
    locationName: "Time Out Market",
    longitude: -9.1453,
    sortOrder: 9,
    startTime: "2026-05-01T10:00:00.000Z",
    title: "Quick Brunch",
  });
  await insertItineraryItem(admin, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "Longer event with the same start time.",
    endTime: "2026-05-01T12:00:00.000Z",
    itemType: "event",
    latitude: 38.7794,
    locationName: "MAAT",
    longitude: -9.1603,
    sortOrder: 1,
    startTime: "2026-05-01T10:00:00.000Z",
    title: "Long Museum Visit",
  });
  await insertItineraryItem(admin, tripId, organizerId, {
    dayDate: "2026-05-01",
    description: "Main timed event for card and detail assertions.",
    endTime: "2026-05-01T17:00:00.000Z",
    itemType: "event",
    latitude: 38.7071,
    locationName: "Tagus River",
    longitude: -9.1355,
    sortOrder: 2,
    startTime: "2026-05-01T14:00:00.000Z",
    title: "Sunset Cruise",
  });
  await insertItineraryItem(admin, tripId, organizerId, {
    dayDate: "2026-05-02",
    description: "Timed commute for range formatting checks.",
    destinationLatitude: 38.7228,
    destinationLongitude: -9.1342,
    destinationName: "Lisbon Oriente",
    endTime: "2026-05-02T17:00:00.000Z",
    itemType: "commute",
    latitude: 38.7138,
    locationName: "Cais do Sodre",
    longitude: -9.1454,
    sortOrder: 0,
    startTime: "2026-05-02T14:00:00.000Z",
    title: "Harbor Train",
  });

  const viewInvite = await createTestInviteCode(tripId, "view");

  return {
    tripId,
    viewCode: viewInvite.code,
  };
}

async function deleteUser(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId);

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
  await page.route("**/api/images/search**", async (route) => {
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
}

function getDayLabel(dayDate: string): string {
  return format(parseISO(dayDate), "EEE, MMM d");
}

function getDayHeadingLabel(dayNumber: number, dayDate: string) {
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

async function getDayCardTitles(page: Page, dayNumber: number, dayDate: string) {
  const titles = await getDaySection(page, dayNumber, dayDate).locator("button.group h3").allTextContents();
  return titles.map((title) => title.trim());
}

test.beforeAll(async ({ baseURL, browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser, { baseURL });
  await markProfileReady(adminClient, organizerAuth.user.id, "Olive Organizer");
});

test.afterAll(async () => {
  await organizerAuth.context.close();
  await deleteUser(adminClient, organizerAuth.user.id);
});

test("Add Event modal has full datetime fields on Event and Commute", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Start", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("End", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Commute" }).click();
    await expect(dialog.getByLabel("Departure", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Arrival", { exact: true })).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Setting end_time before start_time shows a validation error", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Backwards Event");
    await dialog.getByLabel("Start", { exact: true }).fill("2026-05-01T17:00");
    await dialog.getByLabel("End", { exact: true }).fill("2026-05-01T16:00");
    await dialog.getByLabel("Location").fill("Miradouro de Santa Luzia");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(dialog.getByText(/end time.*after.*start time/i)).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Creating an event with end_time shows the time range on the itinerary card", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Dinner Reservation");
    await dialog.getByLabel("Start", { exact: true }).fill("2026-05-01T18:30");
    await dialog.getByLabel("End", { exact: true }).fill("2026-05-01T20:00");
    await dialog.getByLabel("Location").fill("Bairro Alto");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(getDaySection(page, 1, "2026-05-01").getByText("Dinner Reservation")).toBeVisible();
    await expect(getDaySection(page, 1, "2026-05-01").getByText("6:30 PM – 8:00 PM")).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Creating a commute with arrival time shows the departure-to-arrival format", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await getDaySection(page, 2, "2026-05-02").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Commute" }).click();
    await dialog.getByLabel("Title").fill("Airport Train");
    await dialog.getByLabel("Departure", { exact: true }).fill("2026-05-02T07:15");
    await dialog.getByLabel("Arrival", { exact: true }).fill("2026-05-02T08:45");
    await dialog.getByLabel("Origin").fill("Rossio");
    await dialog.getByLabel("Destination").fill("Lisbon Airport");
    await dialog.getByRole("button", { name: "Save Commute" }).click();

    await expect(getDaySection(page, 2, "2026-05-02").getByText("Airport Train")).toBeVisible();
    await expect(
      getDaySection(page, 2, "2026-05-02").getByText("Departs 7:15 AM → Arrives 8:45 AM"),
    ).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Itinerary detail view shows end time when present", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);
    const sunsetRange = `${format(new Date("2026-05-01T14:00:00.000Z"), "h:mm a")} – ${format(new Date("2026-05-01T17:00:00.000Z"), "h:mm a")}`;
    const harborRange = `Departs ${format(new Date("2026-05-02T14:00:00.000Z"), "h:mm a")} → Arrives ${format(new Date("2026-05-02T17:00:00.000Z"), "h:mm a")}`;

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: /Sunset Cruise/i }).click();

    let dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(sunsetRange);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await getDaySection(page, 2, "2026-05-02").getByRole("button", { name: /Harbor Train/i }).click();

    dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(harborRange);
    await expect(dialog.getByText("Departure")).toBeVisible();
    await expect(dialog.getByText("Arrival")).toBeVisible();
    await expect(dialog).toContainText(format(new Date("2026-05-02T14:00:00.000Z"), "MMM d, yyyy h:mm a"));
    await expect(dialog).toContainText(format(new Date("2026-05-02T17:00:00.000Z"), "MMM d, yyyy h:mm a"));
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Two events starting at the same time are sorted by end_time", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await expect.poll(async () => getDayCardTitles(page, 1, "2026-05-01")).toEqual([
      "Morning Walk",
      "Quick Brunch",
      "Long Museum Visit",
      "Sunset Cruise",
    ]);
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("View-only page shows end times correctly", async ({ browser }) => {
  let guestContext: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  let guestPage: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    guestContext = await browser.newContext();
    guestPage = await guestContext.newPage();
    await guestPage.goto(`/trip/${seeded.tripId}?code=${seeded.viewCode}`);
    const sunsetRange = `${format(new Date("2026-05-01T14:00:00.000Z"), "h:mm a")} – ${format(new Date("2026-05-01T17:00:00.000Z"), "h:mm a")}`;
    const harborRange = `Departs ${format(new Date("2026-05-02T14:00:00.000Z"), "h:mm a")} → Arrives ${format(new Date("2026-05-02T17:00:00.000Z"), "h:mm a")}`;

    await expect(guestPage.getByText(/viewing this trip as a guest/i)).toBeVisible();
    await expect(getDaySection(guestPage, 1, "2026-05-01").getByText(sunsetRange)).toBeVisible();

    await getDayHeaderButton(guestPage, 2, "2026-05-02").click();
    await expect(getDaySection(guestPage, 2, "2026-05-02").getByText(harborRange)).toBeVisible();
  } finally {
    await guestPage?.close();
    await guestContext?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("A multi-day event appears on every covered itinerary day", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Weekend Festival");
    await dialog.getByLabel("Start", { exact: true }).fill("2026-05-01T20:00");
    await dialog.getByLabel("End", { exact: true }).fill("2026-05-03T10:00");
    await dialog.getByLabel("Location").fill("Parque Eduardo VII");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(getDaySection(page, 1, "2026-05-01").getByText("Weekend Festival")).toBeVisible();
    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await expect(getDaySection(page, 2, "2026-05-02").getByText("Weekend Festival")).toBeVisible();
    await getDayHeaderButton(page, 3, "2026-05-03").click();
    await expect(getDaySection(page, 3, "2026-05-03").getByText("Weekend Festival")).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("An overnight commute appears on both covered days", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Commute" }).click();
    await dialog.getByLabel("Title").fill("Sleeper Train");
    await dialog.getByLabel("Departure", { exact: true }).fill("2026-05-01T23:30");
    await dialog.getByLabel("Arrival", { exact: true }).fill("2026-05-02T01:15");
    await dialog.getByLabel("Origin").fill("Santa Apolonia");
    await dialog.getByLabel("Destination").fill("Porto Campanha");
    await dialog.getByRole("button", { name: "Save Commute" }).click();

    await expect(getDaySection(page, 1, "2026-05-01").getByText("Sleeper Train")).toBeVisible();
    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await expect(getDaySection(page, 2, "2026-05-02").getByText("Sleeper Train")).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("A multi-day hotel appears on every covered itinerary day", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Hotel" }).click();
    await dialog.getByLabel("Title").fill("Riverfront Hotel");
    await dialog.getByLabel(/^Check-in/).fill("2026-05-01T15:00");
    await dialog.getByLabel(/^Check-out/).fill("2026-05-03T11:00");
    await dialog.getByLabel("Location").fill("Ribeira");
    await dialog.getByRole("button", { name: "Save Hotel" }).click();

    await expect(getDaySection(page, 1, "2026-05-01").getByText("Riverfront Hotel")).toBeVisible();
    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await expect(getDaySection(page, 2, "2026-05-02").getByText("Riverfront Hotel")).toBeVisible();
    await getDayHeaderButton(page, 3, "2026-05-03").click();
    await expect(getDaySection(page, 3, "2026-05-03").getByText("Riverfront Hotel")).toBeVisible();
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("An item without end_time only appears on its start day", async () => {
  let page: Page | null = null;
  let seeded: SeededEndTimesScenario | null = null;

  try {
    seeded = await seedEndTimesScenario(adminClient, organizerAuth.user.id);
    page = await organizerAuth.context.newPage();
    await routeImageSearch(page, { results: [] });
    await page.goto(`/trip/${seeded.tripId}`);

    await getDaySection(page, 1, "2026-05-01").getByRole("button", { name: "Add Event" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Late Night Snack");
    await dialog.getByLabel("Start", { exact: true }).fill("2026-05-01T23:30");
    await dialog.getByLabel("Location").fill("Chiado");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(getDaySection(page, 1, "2026-05-01").getByText("Late Night Snack")).toBeVisible();
    await getDayHeaderButton(page, 2, "2026-05-02").click();
    await expect(getDaySection(page, 2, "2026-05-02").getByText("Late Night Snack")).toHaveCount(0);
  } finally {
    await page?.close();
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});
