import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestTrip } from "./helpers/seed";
import type { Database, ItineraryItem, ItineraryItemType } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type ReadyContext = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type SeededEditScenario = {
  commute: ItineraryItem;
  event: ItineraryItem;
  hotel: ItineraryItem;
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
  nextAdminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  displayName: string,
) {
  const { error } = await nextAdminClient
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

async function insertItineraryItem(
  nextAdminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  createdBy: string,
  input: SeedItineraryItemInput,
): Promise<ItineraryItem> {
  const { data, error } = await nextAdminClient
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
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateTripDates(nextAdminClient: ReturnType<typeof createAdminClient>, tripId: string) {
  const { error } = await nextAdminClient
    .from("trips")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      description: "Trip seeded for itinerary edit and delete coverage.",
      end_date: "2026-05-03",
      location_name: "Paris, France",
      name: "Edit Flow Trip",
      start_date: "2026-05-01",
    })
    .eq("id", tripId);

  if (error) {
    throw error;
  }
}

async function seedEditScenario(
  nextAdminClient: ReturnType<typeof createAdminClient>,
  organizerId: string,
  options?: {
    memberId?: string;
    plannerId?: string;
  },
): Promise<SeededEditScenario> {
  const { trip } = await createTestTrip(organizerId);
  await updateTripDates(nextAdminClient, trip.id);

  if (options?.plannerId) {
    await addParticipant(trip.id, options.plannerId, "planner");
  }

  if (options?.memberId) {
    await addParticipant(trip.id, options.memberId, "member");
  }

  const event = await insertItineraryItem(nextAdminClient, trip.id, organizerId, {
    dayDate: "2026-05-01",
    description: "See the modern collection before dinner.",
    endTime: "2026-05-01T12:00:00.000Z",
    imageUrl: "https://example.com/gallery-visit.jpg",
    itemType: "event",
    latitude: 48.8601,
    locationName: "Musee d'Orsay",
    longitude: 2.3266,
    sortOrder: 1,
    startTime: "2026-05-01T10:30:00.000Z",
    title: "Gallery Visit",
  });
  const hotel = await insertItineraryItem(nextAdminClient, trip.id, organizerId, {
    dayDate: "2026-05-01",
    description: "Drop bags and get settled.",
    endTime: "2026-05-03T11:00:00.000Z",
    imageUrl: "https://example.com/hotel-regina.jpg",
    itemType: "hotel",
    latitude: 48.8638,
    locationName: "Hotel Regina",
    longitude: 2.3331,
    sortOrder: 2,
    startTime: "2026-05-01T15:00:00.000Z",
    title: "Hotel Check-in",
  });
  const commute = await insertItineraryItem(nextAdminClient, trip.id, organizerId, {
    dayDate: "2026-05-02",
    description: "Morning train to Versailles.",
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

  return {
    commute,
    event,
    hotel,
    tripId: trip.id,
  };
}

async function routeImageSearch(
  page: Page,
  results: Array<{ imageUrl: string; photographerName: string; photographerUrl: string; sourceUrl: string; title: string }>,
) {
  await page.route("**/api/images/search**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ results }),
      contentType: "application/json",
      status: 200,
    });
  });
}

function getCard(page: Page, title: string) {
  return page.locator("button.group").filter({ hasText: title }).first();
}

async function openDetail(page: Page, title: string) {
  await getCard(page, title).click();
  return page.getByRole("dialog", { name: title });
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
  if (organizerAuth?.user?.id) await adminClient.auth.admin.deleteUser(organizerAuth.user.id);
  if (plannerAuth?.user?.id) await adminClient.auth.admin.deleteUser(plannerAuth.user.id);
  if (memberAuth?.user?.id) await adminClient.auth.admin.deleteUser(memberAuth.user.id);
});

async function expectRoleActions(options: {
  auth: ReadyContext;
  includeMember?: boolean;
  includePlanner?: boolean;
  shouldManage: boolean;
}) {
  let seeded: SeededEditScenario | null = null;

  try {
    seeded = await seedEditScenario(adminClient, organizerAuth.user.id, {
      memberId: options.includeMember ? memberAuth.user.id : undefined,
      plannerId: options.includePlanner ? plannerAuth.user.id : undefined,
    });

    const page = await options.auth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    const detail = await openDetail(page, seeded.event.title);
    await expect(detail.getByRole("button", { name: "Close", exact: true })).toBeVisible();

    if (options.shouldManage) {
      await expect(detail.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
      await expect(detail.getByRole("button", { name: "Delete", exact: true })).toBeVisible();

      await detail.getByRole("button", { name: "Edit", exact: true }).click();
      const editDialog = page.getByRole("dialog", { name: "Edit Event" });
      await expect(editDialog.getByLabel("Title")).toHaveValue("Gallery Visit");
      await expect(editDialog.getByLabel("Start", { exact: true })).toHaveValue("2026-05-01T10:30");
      await expect(editDialog.getByLabel("End", { exact: true })).toHaveValue("2026-05-01T12:00");
      await expect(editDialog.getByLabel("Location", { exact: true })).toHaveValue("Musee d'Orsay");
      await editDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    } else {
      await expect(detail.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
      await expect(detail.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: `Edit ${seeded.event.title}` })).toHaveCount(0);
    }
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
}

test("Organizer sees the correct itinerary detail actions", async () => {
  await expectRoleActions({
    auth: organizerAuth,
    shouldManage: true,
  });
});

test("Planner sees the correct itinerary detail actions", async () => {
  await expectRoleActions({
    auth: plannerAuth,
    includePlanner: true,
    shouldManage: true,
  });
});

test("Member sees the correct itinerary detail actions", async () => {
  await expectRoleActions({
    auth: memberAuth,
    includeMember: true,
    shouldManage: false,
  });
});

test("Organizer can quick-edit an event from the pencil icon and the card updates title, time, location, and image", async () => {
  let seeded: SeededEditScenario | null = null;

  try {
    seeded = await seedEditScenario(adminClient, organizerAuth.user.id);
    const page = await organizerAuth.context.newPage();
    await routeImageSearch(page, [
      {
        imageUrl: "https://example.com/gallery-visit-updated.jpg",
        photographerName: "Casey Lens",
        photographerUrl: "https://example.com/photographer",
        sourceUrl: "https://example.com/source",
        title: "Updated gallery suggestion",
      },
    ]);

    await page.goto(`/trip/${seeded.tripId}`);
    await page.getByRole("button", { name: `Edit ${seeded.event.title}` }).click();

    const dialog = page.getByRole("dialog", { name: "Edit Event" });
    await expect(dialog.getByLabel("Title")).toHaveValue("Gallery Visit");
    await dialog.getByLabel("Title").fill("Gallery Visit Updated");
    await dialog.getByLabel("Start", { exact: true }).fill("2026-05-01T11:00");
    await dialog.getByLabel("End", { exact: true }).fill("2026-05-01T13:15");
    await dialog.getByLabel("Location", { exact: true }).fill("Centre Pompidou");
    await dialog.getByRole("img", { name: "Updated gallery suggestion" }).click();
    await dialog.getByRole("button", { name: "Save Changes", exact: true }).click();

    const updatedCard = getCard(page, "Gallery Visit Updated");
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard).toContainText("11:00 AM");
    await expect(updatedCard).toContainText("1:15 PM");
    await expect(updatedCard).toContainText("Centre Pompidou");
    await expect(updatedCard.locator('img[alt="Gallery Visit Updated"]')).toHaveAttribute(
      "src",
      "https://example.com/gallery-visit-updated.jpg",
    );
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Organizer can cancel or confirm deleting an event from the detail modal", async () => {
  let seeded: SeededEditScenario | null = null;

  try {
    seeded = await seedEditScenario(adminClient, organizerAuth.user.id);
    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    let detail = await openDetail(page, seeded.event.title);
    await detail.getByRole("button", { name: "Delete", exact: true }).click();

    const confirmDialog = page.getByRole("dialog", { name: `Delete ${seeded.event.title}?` });
    await expect(confirmDialog).toContainText(`Delete ${seeded.event.title}? This action cannot be undone.`);
    await confirmDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(getCard(page, seeded.event.title)).toBeVisible();

    detail = await openDetail(page, seeded.event.title);
    await detail.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog", { name: `Delete ${seeded.event.title}?` }).getByRole("button", { name: "Delete" }).click();

    await expect(getCard(page, seeded.event.title)).toHaveCount(0);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Realtime edits and deletes sync across open trip tabs", async () => {
  let seeded: SeededEditScenario | null = null;

  try {
    seeded = await seedEditScenario(adminClient, organizerAuth.user.id);
    const pageA = await organizerAuth.context.newPage();
    const pageB = await organizerAuth.context.newPage();

    await pageA.goto(`/trip/${seeded.tripId}`);
    await pageB.goto(`/trip/${seeded.tripId}`);

    await pageA.getByRole("button", { name: `Edit ${seeded.event.title}` }).click();
    const editDialog = pageA.getByRole("dialog", { name: "Edit Event" });
    await editDialog.getByLabel("Title").fill("Realtime Gallery Walk");
    await editDialog.getByRole("button", { name: "Save Changes", exact: true }).click();

    await expect.poll(async () => getCard(pageB, "Realtime Gallery Walk").count()).toBe(1);

    const detail = await openDetail(pageA, "Realtime Gallery Walk");
    await detail.getByRole("button", { name: "Delete", exact: true }).click();
    await pageA
      .getByRole("dialog", { name: "Delete Realtime Gallery Walk?" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect.poll(async () => getCard(pageB, "Realtime Gallery Walk").count()).toBe(0);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Editing a commute pre-fills origin and destination", async () => {
  let seeded: SeededEditScenario | null = null;

  try {
    seeded = await seedEditScenario(adminClient, organizerAuth.user.id);
    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await page.getByRole("button", { name: `Edit ${seeded.commute.title}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Commute" });
    await expect(dialog.getByLabel("Origin", { exact: true })).toHaveValue("Gare Montparnasse");
    await expect(dialog.getByLabel("Destination", { exact: true })).toHaveValue("Versailles Chateau");
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});

test("Editing a hotel pre-fills check-in and check-out times", async () => {
  let seeded: SeededEditScenario | null = null;

  try {
    seeded = await seedEditScenario(adminClient, organizerAuth.user.id);
    const page = await organizerAuth.context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await page.getByRole("button", { name: `Edit ${seeded.hotel.title}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Hotel" });
    await expect(dialog.getByLabel(/^Check-in/)).toHaveValue("2026-05-01T15:00");
    await expect(dialog.getByLabel(/^Check-out/)).toHaveValue("2026-05-03T11:00");
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
    }
  }
});
