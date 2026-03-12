import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestTrip } from "./helpers/seed";
import type { Database, Trip } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

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

async function deleteUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
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

async function getTrip(adminClient: ReturnType<typeof createAdminClient>, tripId: string) {
  const { data, error } = await adminClient
    .from("trips")
    .select("name, description, location_name, start_date, end_date, image_url")
    .eq("id", tripId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function createPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0KsAAAAASUVORK5CYII=",
    "base64",
  );
}

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type AuthPool = {
  member: AuthSession;
  organizer: AuthSession;
};

type SeededEditTripScenario = {
  memberContext: AuthSession["context"];
  memberUserId: string;
  organizerContext: AuthSession["context"];
  organizerUserId: string;
  tripId: string;
  tripName: string;
};

let authPool: AuthPool | null = null;

async function seedEditTripScenario(
  adminClient: ReturnType<typeof createAdminClient>,
  options?: {
    imageUrl?: string | null;
    name?: string;
  },
): Promise<SeededEditTripScenario> {
  if (!authPool) {
    throw new Error("Expected shared auth pool to be initialized.");
  }

  const organizerAuth = authPool.organizer;
  const memberAuth = authPool.member;
  const createdTrip = await createTestTrip(organizerAuth.user.id);
  const tripId = createdTrip.trip.id;
  const tripName = options?.name ?? "Spring in Lisbon";

  await addParticipant(tripId, memberAuth.user.id, "member");
  await updateTrip(adminClient, tripId, {
    description: "A sunny long weekend with seafood, trams, and pastel de nata stops.",
    end_date: "2026-09-18",
    image_url: options?.imageUrl ?? null,
    location_name: "Lisbon, Portugal",
    name: tripName,
    start_date: "2026-09-12",
  });

  return {
    memberContext: memberAuth.context,
    memberUserId: memberAuth.user.id,
    organizerContext: organizerAuth.context,
    organizerUserId: organizerAuth.user.id,
    tripId,
    tripName,
  };
}

async function cleanupScenario(scenario: SeededEditTripScenario | null) {
  if (!scenario) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient.from("trips").delete().eq("id", scenario.tripId);
}

async function openEditPage(page: Page, tripId: string) {
  await page.goto(`/trip/${tripId}/edit`);
  await expect(page.getByRole("heading", { name: "Update the plan" })).toBeVisible();
}

test.beforeAll(async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const organizer = await createAuthenticatedContext(browser, { baseURL });
  const member = await createAuthenticatedContext(browser, { baseURL });

  await markProfileReady(adminClient, organizer.user.id, "Olivia Organizer");
  await markProfileReady(adminClient, member.user.id, "Maya Member");

  authPool = {
    member,
    organizer,
  };
});

test.afterAll(async () => {
  if (!authPool) {
    return;
  }

  const adminClient = createAdminClient();

  try {
    await authPool.organizer?.context?.close();
    await authPool.member?.context?.close();
  } finally {
    await deleteUser(adminClient, authPool.member.user.id);
    await deleteUser(adminClient, authPool.organizer.user.id);
    authPool = null;
  }
});

test("Organizer can access /trip/{tripId}/edit", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient);
    page = await scenario.organizerContext.newPage();

    await openEditPage(page, scenario.tripId);
    await expect(page.getByLabel("Trip name")).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Non-organizer visiting /trip/{tripId}/edit is redirected to the trip page", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient);
    page = await scenario.memberContext.newPage();

    await page.goto(`/trip/${scenario.tripId}/edit`);
    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Edit form is pre-filled with existing trip data", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient, {
      imageUrl: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      name: "Autumn in Porto",
    });
    page = await scenario.organizerContext.newPage();

    await openEditPage(page, scenario.tripId);

    await expect(page.getByLabel("Trip name")).toHaveValue("Autumn in Porto");
    await expect(page.getByLabel("Start date")).toHaveValue("2026-09-12");
    await expect(page.getByLabel("End date")).toHaveValue("2026-09-18");
    await expect(page.getByLabel("Location")).toHaveValue("Lisbon, Portugal");
    await expect(page.getByLabel("Description")).toHaveValue(
      "A sunny long weekend with seafood, trams, and pastel de nata stops.",
    );
    await expect(page.locator('img[alt="Selected trip cover preview"]')).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/default-user=s96-c",
    );
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Changing the trip name and saving updates the trip page hero", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    const updatedName = `Updated Trip ${Date.now()}`;

    await openEditPage(page, scenario.tripId);
    await page.getByLabel("Trip name").fill(updatedName);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
    await expect((await getTrip(adminClient, scenario.tripId)).name).toBe(updatedName);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Changing the header image uploads a new image and updates the hero", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient);
    page = await scenario.organizerContext.newPage();

    await openEditPage(page, scenario.tripId);
    await page.locator('input[type="file"]').setInputFiles({
      buffer: createPngBuffer(),
      mimeType: "image/png",
      name: "updated-header.png",
    });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));

    const updatedTrip = await getTrip(adminClient, scenario.tripId);
    expect(updatedTrip.image_url).toBeTruthy();
    await expect(page.locator(`img[alt="${scenario.tripName} header"]`)).toHaveCount(1);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Cancel button returns to the trip page without saving changes", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient);
    page = await scenario.organizerContext.newPage();

    await openEditPage(page, scenario.tripId);
    await page.getByLabel("Trip name").fill("Unsaved Rename");
    await page.getByLabel("Description").fill("This should not persist.");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();

    const untouchedTrip = await getTrip(adminClient, scenario.tripId);
    expect(untouchedTrip.name).toBe(scenario.tripName);
    expect(untouchedTrip.description).toBe(
      "A sunny long weekend with seafood, trams, and pastel de nata stops.",
    );
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Edit button (pencil icon) on hero is only visible to organizer", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededEditTripScenario | null = null;
  let organizerPage: Page | null = null;
  let memberPage: Page | null = null;

  try {
    scenario = await seedEditTripScenario(adminClient);
    organizerPage = await scenario.organizerContext.newPage();
    memberPage = await scenario.memberContext.newPage();

    await organizerPage.goto(`/trip/${scenario.tripId}`);
    await memberPage.goto(`/trip/${scenario.tripId}`);

    await expect(organizerPage.getByRole("link", { name: "Edit trip" })).toBeVisible();
    await expect(memberPage.getByRole("link", { name: "Edit trip" })).toHaveCount(0);
  } finally {
    await organizerPage?.close();
    await memberPage?.close();
    await cleanupScenario(scenario);
  }
});
