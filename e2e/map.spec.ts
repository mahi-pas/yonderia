import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { createTestInviteCode, createTestTrip } from "./helpers/seed";
import { formatItineraryItemTime } from "@/components/trip/ItineraryCard";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { Database } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type ReadyContext = Awaited<ReturnType<typeof createAuthenticatedContext>>;

type SeededMapTrip = {
  commuteItem: ItineraryListItem;
  eventItem: ItineraryListItem;
  hotelItem: ItineraryListItem;
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

async function markProfileReady(userId: string, displayName: string) {
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

async function insertItineraryItem(tripId: string, createdBy: string, item: ItineraryListItem) {
  const { error } = await adminClient
    .from("itinerary_items")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .insert({
      created_by: createdBy,
      day_date: item.day_date,
      description: item.description,
      destination_latitude: item.destination_latitude,
      destination_longitude: item.destination_longitude,
      destination_name: item.destination_name,
      end_time: item.end_time,
      id: item.id,
      image_url: item.image_url,
      item_type: item.item_type,
      latitude: item.latitude,
      location_name: item.location_name,
      longitude: item.longitude,
      sort_order: item.sort_order,
      start_time: item.start_time,
      title: item.title,
      trip_id: tripId,
    });

  if (error) {
    throw error;
  }
}

async function seedMapTrip(organizerId: string): Promise<SeededMapTrip> {
  const createdTrip = await createTestTrip(organizerId);
  const tripId = createdTrip.trip.id;

  const eventItem: ItineraryListItem = {
    day_date: "2026-05-01",
    description: "Golden-hour cruise past the best city views.",
    destination_latitude: null,
    destination_longitude: null,
    destination_name: null,
    end_time: "2026-05-01T20:00:00.000Z",
    id: randomUUID(),
    image_url: "https://example.com/sunset-cruise.jpg",
    item_type: "event",
    latitude: 48.8584,
    location_name: "Seine River Dock",
    longitude: 2.2945,
    sort_order: 1,
    start_time: "2026-05-01T18:00:00.000Z",
    title: "Sunset Cruise",
  };
  const commuteItem: ItineraryListItem = {
    day_date: "2026-05-01",
    description: "Afternoon transfer out to the palace.",
    destination_latitude: 48.8049,
    destination_longitude: 2.1204,
    destination_name: "Versailles Chateau Rive Gauche",
    end_time: "2026-05-01T15:00:00.000Z",
    id: randomUUID(),
    image_url: "https://example.com/versailles-train.jpg",
    item_type: "commute",
    latitude: 48.8414,
    location_name: "Gare Montparnasse",
    longitude: 2.3208,
    sort_order: 2,
    start_time: "2026-05-01T14:00:00.000Z",
    title: "Train to Versailles",
  };
  const hotelItem: ItineraryListItem = {
    day_date: "2026-05-02",
    description: "Riverside stay for the last night.",
    destination_latitude: null,
    destination_longitude: null,
    destination_name: null,
    end_time: "2026-05-03T10:00:00.000Z",
    id: randomUUID(),
    image_url: "https://example.com/hotel-du-louvre.jpg",
    item_type: "hotel",
    latitude: 48.8656,
    location_name: "Hotel du Louvre",
    longitude: 2.3285,
    sort_order: 3,
    start_time: "2026-05-02T16:00:00.000Z",
    title: "Hotel Check-in",
  };

  await Promise.all([
    insertItineraryItem(tripId, organizerId, eventItem),
    insertItineraryItem(tripId, organizerId, commuteItem),
    insertItineraryItem(tripId, organizerId, hotelItem),
  ]);

  const viewInvite = await createTestInviteCode(tripId, "view");

  return {
    commuteItem,
    eventItem,
    hotelItem,
    tripId,
    viewCode: viewInvite.code,
  };
}

function buildTripUrl(tripId: string, options?: { code?: string }) {
  const params = new URLSearchParams({ mapMock: "1" });

  if (options?.code) {
    params.set("code", options.code);
  }

  return `/trip/${tripId}?${params.toString()}`;
}

function getMap(page: Parameters<typeof test>[0]["page"]) {
  return page.getByTestId("trip-map-section");
}

test.beforeAll(async ({ baseURL, browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser, { baseURL });
  await markProfileReady(organizerAuth.user.id, "Olive Organizer");
});

test.afterAll(async () => {
  await organizerAuth.context.close();

  const { error } = await adminClient.auth.admin.deleteUser(organizerAuth.user.id);

  if (error) {
    throw error;
  }
});

test("Map renders on the trip page with pins for all itinerary items and day filter pills", async () => {
  let seeded: SeededMapTrip | null = null;

  try {
    seeded = await seedMapTrip(organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(buildTripUrl(seeded.tripId));

    const map = getMap(page);
    await expect(map.getByRole("heading", { name: "Trip at a glance" })).toBeVisible();
    await expect(map.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(map.getByRole("button", { name: "Day 1", exact: true })).toBeVisible();
    await expect(map.getByRole("button", { name: "Day 2", exact: true })).toBeVisible();
    await expect(map.getByText("4 pins visible")).toBeVisible();
    await expect(map.getByTestId("trip-map-pin")).toHaveCount(4);
    await expect(map.locator('[data-item-type="event"]')).toHaveCount(1);
    await expect(map.locator('[data-item-type="hotel"]')).toHaveCount(1);
    await expect(map.locator('[data-item-type="commute"]')).toHaveCount(3);

    await page.close();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test('Clicking a pin opens the itinerary detail modal', async () => {
  let seeded: SeededMapTrip | null = null;

  try {
    seeded = await seedMapTrip(organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(buildTripUrl(seeded.tripId));

    const map = getMap(page);
    await map.getByRole("button", { name: "Open Sunset Cruise pin" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Sunset Cruise")).toBeVisible();
    await expect(dialog.getByText("Golden-hour cruise past the best city views.")).toBeVisible();
    await expect(dialog.locator('img[alt="Sunset Cruise"]')).toBeVisible();
    await expect(dialog.getByText(formatItineraryItemTime(seeded.eventItem))).toBeVisible();
    await expect(dialog.getByText("Seine River Dock")).toBeVisible();

    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await page.close();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test('Clicking "Day 1" hides pins from other days and clicking "All" restores them', async () => {
  let seeded: SeededMapTrip | null = null;

  try {
    seeded = await seedMapTrip(organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(buildTripUrl(seeded.tripId));

    const map = getMap(page);
    await map.getByRole("button", { name: "Day 1", exact: true }).click();
    await expect(map.getByText("3 pins visible")).toBeVisible();
    await expect(map.getByTestId("trip-map-pin")).toHaveCount(3);
    await expect(map.getByRole("button", { name: "Open Hotel Check-in pin" })).toHaveCount(0);

    await map.getByRole("button", { name: "All", exact: true }).click();
    await expect(map.getByText("4 pins visible")).toBeVisible();
    await expect(map.getByTestId("trip-map-pin")).toHaveCount(4);
    await expect(map.getByRole("button", { name: "Open Hotel Check-in pin" })).toHaveCount(1);

    await page.close();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("A multi-day item stays visible on every covered day filter", async () => {
  let seeded: SeededMapTrip | null = null;

  try {
    seeded = await seedMapTrip(organizerAuth.user.id);

    const multiDayEvent: ItineraryListItem = {
      day_date: "2026-05-01",
      description: "A festival that runs all weekend.",
      destination_latitude: null,
      destination_longitude: null,
      destination_name: null,
      end_time: "2026-05-03T10:00:00.000Z",
      id: randomUUID(),
      image_url: "https://example.com/weekend-festival.jpg",
      item_type: "event",
      latitude: 48.8566,
      location_name: "Champ de Mars",
      longitude: 2.3522,
      sort_order: 4,
      start_time: "2026-05-01T20:00:00.000Z",
      title: "Weekend Festival",
    };

    await insertItineraryItem(seeded.tripId, organizerAuth.user.id, multiDayEvent);

    const page = await organizerAuth.context.newPage();
    await page.goto(buildTripUrl(seeded.tripId));

    const map = getMap(page);

    await map.getByRole("button", { name: "Day 1", exact: true }).click();
    await expect(map.getByRole("button", { name: "Open Weekend Festival pin" })).toHaveCount(1);

    await map.getByRole("button", { name: "Day 2", exact: true }).click();
    await expect(map.getByRole("button", { name: "Open Weekend Festival pin" })).toHaveCount(1);

    await map.getByRole("button", { name: "Day 3", exact: true }).click();
    await expect(map.getByRole("button", { name: "Open Weekend Festival pin" })).toHaveCount(1);

    await page.close();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Commute items show two pins connected by a line", async () => {
  let seeded: SeededMapTrip | null = null;

  try {
    seeded = await seedMapTrip(organizerAuth.user.id);

    const page = await organizerAuth.context.newPage();
    await page.goto(buildTripUrl(seeded.tripId));

    const map = getMap(page);
    await expect(map.getByRole("button", { name: "Open Train to Versailles pin" })).toHaveCount(2);
    await expect(map.getByTestId("trip-map-line")).toHaveCount(1);

    await page.close();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Map on the view-only page renders pins, clicking a pin opens the detail modal, and edit capabilities stay hidden", async () => {
  let seeded: SeededMapTrip | null = null;

  try {
    seeded = await seedMapTrip(organizerAuth.user.id);

    const page = await organizerAuth.context.browser().newPage();
    await page.goto(buildTripUrl(seeded.tripId, { code: seeded.viewCode }));

    const map = getMap(page);
    await expect(map.getByTestId("trip-map-pin")).toHaveCount(4);
    await map.getByRole("button", { name: "Open Hotel Check-in pin" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Hotel Check-in")).toBeVisible();
    await expect(dialog.getByText(formatItineraryItemTime(seeded.hotelItem))).toBeVisible();
    await expect(dialog.getByText("Hotel du Louvre")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Event" })).toHaveCount(0);
    await expect(page.getByText("You're viewing this trip as a guest. Have an invite code?")).toBeVisible();

    await page.close();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("On mobile the map is about 250px tall with a full screen button, and full screen toggles back to normal", async ({
  baseURL,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only assertion.");

  let mobileAuth: ReadyContext | null = null;
  let seeded: SeededMapTrip | null = null;

  try {
    mobileAuth = await createAuthenticatedContext(browser, { baseURL });
    await markProfileReady(mobileAuth.user.id, "Mobile Organizer");
    seeded = await seedMapTrip(mobileAuth.user.id);

    const page = await mobileAuth.context.newPage();
    await page.goto(buildTripUrl(seeded.tripId));

    const map = getMap(page);
    const mapCanvas = map.getByTestId("trip-map-canvas");
    const mapBox = await mapCanvas.boundingBox();
    const viewport = page.viewportSize();

    expect(mapBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(mapBox!.height).toBeGreaterThanOrEqual(230);
    expect(mapBox!.height).toBeLessThanOrEqual(270);

    const fullScreenButton = map.getByRole("button", { name: "Full screen" });
    await expect(fullScreenButton).toBeVisible();
    await fullScreenButton.click();

    const overlay = page.getByTestId("trip-map-fullscreen-overlay");
    await expect(overlay).toBeVisible();
    const overlayBox = await overlay.boundingBox();

    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.height).toBeGreaterThan((viewport?.height ?? 0) - 20);
    expect(overlayBox!.width).toBeGreaterThan((viewport?.width ?? 0) - 20);

    await page.getByRole("button", { name: "Close full screen map" }).click();
    await expect(page.getByTestId("trip-map-fullscreen-overlay")).toHaveCount(0);

    const restoredBox = await mapCanvas.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(restoredBox!.height).toBeGreaterThanOrEqual(230);
    expect(restoredBox!.height).toBeLessThanOrEqual(270);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
    if (mobileAuth) {
      await mobileAuth.context.close();
      const { error } = await adminClient.auth.admin.deleteUser(mobileAuth.user.id);

      if (error) {
        throw error;
      }
    }
  }
});
