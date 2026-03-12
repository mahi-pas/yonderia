import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestTrip } from "./helpers/seed";
import type { Database, Profile, Trip, TripParticipant } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type AuthPool = {
  owner: AuthSession;
  viewer: AuthSession;
};

type ProfileScenario = {
  ownerDisplayName: string;
  ownerSoloTripId: string;
  ownerSoloTripName: string;
  ownerUserId: string;
  sharedTripIds: [string, string];
  sharedTripNames: [string, string];
  viewerDisplayName: string;
  viewerSoloTripId: string;
  viewerSoloTripName: string;
  viewerUserId: string;
};

const VIEWER_NAME = "Vera Viewer";
const OWNER_NAME = "Olive Owner";
const GOOGLE_AVATAR_URL = "https://lh3.googleusercontent.com/a/default-user=s96-c";
const SHARED_TRIP_NAMES = ["Shared Lisbon Escape", "Shared Food Crawl"] as const;
const VIEWER_SOLO_TRIP_NAME = "Viewer Solo Ramble";
const OWNER_SOLO_TRIP_NAME = "Owner Solo Weekend";

let authPool: AuthPool | null = null;

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

async function updateProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  values: Partial<Profile>,
) {
  const { error } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update(values)
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

async function updateParticipant(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  userId: string,
  values: Partial<TripParticipant>,
) {
  const { error } = await adminClient
    .from("trip_participants")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update(values)
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function getTripCount(adminClient: ReturnType<typeof createAdminClient>, userId: string): Promise<number> {
  const { count, error } = await adminClient
    .from("trip_participants")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getProfileRow(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function seedNamedTrip(
  adminClient: ReturnType<typeof createAdminClient>,
  organizerId: string,
  name: string,
  locationName: string,
) {
  const createdTrip = await createTestTrip(organizerId);
  await updateTrip(adminClient, createdTrip.trip.id, {
    description: `${name} description`,
    location_name: locationName,
    name,
    start_date: "2026-09-04",
    end_date: "2026-09-09",
  });

  return createdTrip.trip.id;
}

async function seedProfileScenario(): Promise<ProfileScenario> {
  if (!authPool) {
    throw new Error("Expected auth pool to be initialized.");
  }

  const adminClient = createAdminClient();
  const viewerUserId = authPool.viewer.user.id;
  const ownerUserId = authPool.owner.user.id;

  const sharedTripOneId = await seedNamedTrip(
    adminClient,
    viewerUserId,
    SHARED_TRIP_NAMES[0],
    "Lisbon, Portugal",
  );
  await addParticipant(sharedTripOneId, ownerUserId, "planner");
  await updateParticipant(adminClient, sharedTripOneId, ownerUserId, {
    nickname: OWNER_NAME,
  });

  const sharedTripTwoId = await seedNamedTrip(
    adminClient,
    ownerUserId,
    SHARED_TRIP_NAMES[1],
    "Barcelona, Spain",
  );
  await addParticipant(sharedTripTwoId, viewerUserId, "member");
  await updateParticipant(adminClient, sharedTripTwoId, viewerUserId, {
    nickname: VIEWER_NAME,
  });

  const viewerSoloTripId = await seedNamedTrip(
    adminClient,
    viewerUserId,
    VIEWER_SOLO_TRIP_NAME,
    "Portland, Oregon",
  );
  const ownerSoloTripId = await seedNamedTrip(
    adminClient,
    ownerUserId,
    OWNER_SOLO_TRIP_NAME,
    "Kyoto, Japan",
  );

  return {
    ownerDisplayName: OWNER_NAME,
    ownerSoloTripId,
    ownerSoloTripName: OWNER_SOLO_TRIP_NAME,
    ownerUserId,
    sharedTripIds: [sharedTripOneId, sharedTripTwoId],
    sharedTripNames: [...SHARED_TRIP_NAMES],
    viewerDisplayName: VIEWER_NAME,
    viewerSoloTripId,
    viewerSoloTripName: VIEWER_SOLO_TRIP_NAME,
    viewerUserId,
  };
}

async function cleanupScenario(scenario: ProfileScenario | null) {
  if (!scenario) {
    return;
  }

  const adminClient = createAdminClient();
  const tripIds = [
    ...scenario.sharedTripIds,
    scenario.viewerSoloTripId,
    scenario.ownerSoloTripId,
  ];

  const { error } = await adminClient.from("trips").delete().in("id", tripIds);

  if (error) {
    throw error;
  }
}

async function openPage(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return page;
}

function getProfileCard(page: Page) {
  return page.locator("section").filter({ has: page.getByText(/trip|trips/) }).first();
}

async function expectTripCount(page: Page, count: number) {
  await expect(getProfileCard(page)).toContainText(new RegExp(`${count}\\s+trip${count === 1 ? "" : "s"}`));
}

test.beforeAll(async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const viewer = await createAuthenticatedContext(browser, { baseURL });
  const owner = await createAuthenticatedContext(browser, { baseURL });

  await updateProfile(adminClient, viewer.user.id, {
    avatar_url: GOOGLE_AVATAR_URL,
    display_name: VIEWER_NAME,
    has_completed_onboarding: true,
  });
  await updateProfile(adminClient, owner.user.id, {
    avatar_url: GOOGLE_AVATAR_URL,
    display_name: OWNER_NAME,
    has_completed_onboarding: true,
  });

  authPool = {
    owner,
    viewer,
  };
});

test.afterAll(async () => {
  if (!authPool) {
    return;
  }

  const adminClient = createAdminClient();

  try {
    await authPool.viewer?.context?.close();
    await authPool.owner?.context?.close();
  } finally {
    await deleteUser(adminClient, authPool.viewer.user.id);
    await deleteUser(adminClient, authPool.owner.user.id);
    authPool = null;
  }
});

test("Profile page shows avatar, display name, and trip count", async () => {
  const adminClient = createAdminClient();
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/profile/${scenario.ownerUserId}`);

    await expect(page.getByRole("heading", { name: scenario.ownerDisplayName }).first()).toBeVisible();
    await expect(page.locator(`img[alt="${scenario.ownerDisplayName}"]`).first()).toBeVisible();
    await expectTripCount(page, 3);
    await expect(await getTripCount(adminClient, scenario.ownerUserId)).toBe(3);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Trip count is accurate and matches trip_participants rows", async () => {
  const adminClient = createAdminClient();
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.owner.context, `/profile/${scenario.viewerUserId}`);

    const actualCount = await getTripCount(adminClient, scenario.viewerUserId);

    await expectTripCount(page, actualCount);
    await expect(actualCount).toBe(3);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Viewing own profile shows "Edit Profile" button', async () => {
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/profile/${scenario.viewerUserId}`);

    await expect(page.getByRole("button", { name: "Edit Profile" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Viewing someone else\'s profile does NOT show "Edit Profile" button', async () => {
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/profile/${scenario.ownerUserId}`);

    await expect(page.getByRole("button", { name: "Edit Profile" })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Edit profile: changing display name and avatar saves correctly", async () => {
  const adminClient = createAdminClient();
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/profile/${scenario.viewerUserId}`);

    await page.getByRole("button", { name: "Edit Profile" }).click();
    await page.getByLabel("Display name").fill("Updated Vera");
    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg5MzdgAAAABJRU5ErkJggg==",
        "base64",
      ),
      mimeType: "image/png",
      name: "profile-avatar.png",
    });
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("heading", { name: "Updated Vera" }).first()).toBeVisible();
    await expect(page.locator('img[alt="Updated Vera"]').first()).toBeVisible();

    await expect
      .poll(async () => {
        const profile = await getProfileRow(adminClient, scenario.viewerUserId);
        return {
          avatarUrl: profile.avatar_url,
          displayName: profile.display_name,
        };
      })
      .toMatchObject({
        avatarUrl: expect.stringContaining("/storage/v1/object/public/avatars/"),
        displayName: "Updated Vera",
      });
  } finally {
    await page?.close();
    if (scenario) {
      await updateProfile(adminClient, scenario.viewerUserId, {
        avatar_url: GOOGLE_AVATAR_URL,
        display_name: VIEWER_NAME,
        has_completed_onboarding: true,
      });
    }
    await cleanupScenario(scenario);
  }
});

test("Shared trips section shows trips where both viewer and profile owner participate", async () => {
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/profile/${scenario.ownerUserId}`);

    await expect(page.getByRole("heading", { name: "Trips you share" })).toBeVisible();
    await expect(page.getByText(scenario.sharedTripNames[0])).toBeVisible();
    await expect(page.getByText(scenario.sharedTripNames[1])).toBeVisible();
    await expect(page.getByText(scenario.viewerSoloTripName)).toHaveCount(0);
    await expect(page.getByText(scenario.ownerSoloTripName)).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Shared trips section is hidden for unauthenticated visitors", async ({ page }) => {
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    await page.goto(`/profile/${scenario.ownerUserId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: scenario.ownerDisplayName }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trips you share" })).toHaveCount(0);
    await expect(page.getByText(scenario.sharedTripNames[0])).toHaveCount(0);
    await expect(page.getByText(scenario.sharedTripNames[1])).toHaveCount(0);
  } finally {
    await cleanupScenario(scenario);
  }
});

test("Clicking avatar in participants row navigates to correct profile page", async () => {
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/trip/${scenario.sharedTripIds[0]}`);

    await page.getByRole("link").filter({ hasText: scenario.ownerDisplayName }).click();
    await expect(page).toHaveURL(new RegExp(`/profile/${scenario.ownerUserId}$`));
    await expect(page.getByRole("heading", { name: scenario.ownerDisplayName }).first()).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Clicking avatar in participants page navigates to correct profile page", async () => {
  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/trip/${scenario.sharedTripIds[0]}/participants`);

    await page.getByRole("link", { name: `View ${scenario.ownerDisplayName}'s profile` }).click();
    await expect(page).toHaveURL(new RegExp(`/profile/${scenario.ownerUserId}$`));
    await expect(page.getByRole("heading", { name: scenario.ownerDisplayName }).first()).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Profile page works on mobile (single column, centered layout)", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only layout check.");

  let page: Page | null = null;
  let scenario: ProfileScenario | null = null;

  try {
    scenario = await seedProfileScenario();
    page = await openPage(authPool!.viewer.context, `/profile/${scenario.ownerUserId}`);

    const viewport = page.viewportSize();
    const profileCardBox = await getProfileCard(page).boundingBox();
    const sharedTripsSectionBox = await page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Trips you share" }) })
      .boundingBox();

    expect(viewport).not.toBeNull();
    expect(profileCardBox).not.toBeNull();
    expect(sharedTripsSectionBox).not.toBeNull();

    const viewportCenterX = viewport!.width / 2;
    const profileCardCenterX = profileCardBox!.x + profileCardBox!.width / 2;
    const sharedSectionCenterX = sharedTripsSectionBox!.x + sharedTripsSectionBox!.width / 2;

    expect(Math.abs(profileCardCenterX - viewportCenterX)).toBeLessThanOrEqual(4);
    expect(Math.abs(sharedSectionCenterX - viewportCenterX)).toBeLessThanOrEqual(4);
    expect(sharedTripsSectionBox!.y).toBeGreaterThan(profileCardBox!.y + profileCardBox!.height - 1);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});
