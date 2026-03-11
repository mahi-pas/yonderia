import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestTrip } from "./helpers/seed";
import type { Database, TripParticipant } from "@/lib/types";

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

async function createExtraUser(
  adminClient: ReturnType<typeof createAdminClient>,
  displayName: string,
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: `planner-kick-${Date.now()}-${Math.random()}@yonderia.test`,
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
    throw new Error("Expected created planner-kick test user.");
  }

  await markProfileReady(adminClient, userId, displayName);
  return userId;
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

async function getParticipant(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  userId: string,
) {
  const { data, error } = await adminClient
    .from("trip_participants")
    .select("id, role, trip_id, user_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type AuthPool = {
  member: AuthSession;
  organizer: AuthSession;
  planner: AuthSession;
};

type SeededPlannerKickScenario = {
  extraUserIds: string[];
  memberContext: AuthSession["context"];
  memberUserId: string;
  organizerContext: AuthSession["context"];
  organizerUserId: string;
  otherPlannerName: string;
  otherPlannerUserId: string;
  plannerContext: AuthSession["context"];
  plannerUserId: string;
  tripId: string;
};

let authPool: AuthPool | null = null;

async function seedPlannerKickScenario(): Promise<SeededPlannerKickScenario> {
  if (!authPool) {
    throw new Error("Expected shared auth pool to be initialized.");
  }

  const adminClient = createAdminClient();
  const organizerAuth = authPool.organizer;
  const plannerAuth = authPool.planner;
  const memberAuth = authPool.member;
  const otherPlannerName = `Priya Planner ${randomUUID().slice(0, 4)}`;
  const otherPlannerUserId = await createExtraUser(adminClient, otherPlannerName);
  const createdTrip = await createTestTrip(organizerAuth.user.id);
  const tripId = createdTrip.trip.id;

  await addParticipant(tripId, plannerAuth.user.id, "planner");
  await addParticipant(tripId, memberAuth.user.id, "member");
  await addParticipant(tripId, otherPlannerUserId, "planner");

  await updateParticipant(adminClient, tripId, organizerAuth.user.id, {
    nickname: "Olivia Organizer",
  });
  await updateParticipant(adminClient, tripId, plannerAuth.user.id, {
    nickname: "Peter Planner",
  });
  await updateParticipant(adminClient, tripId, memberAuth.user.id, {
    nickname: "Maya Member",
  });
  await updateParticipant(adminClient, tripId, otherPlannerUserId, {
    nickname: otherPlannerName,
  });

  return {
    extraUserIds: [otherPlannerUserId],
    memberContext: memberAuth.context,
    memberUserId: memberAuth.user.id,
    organizerContext: organizerAuth.context,
    organizerUserId: organizerAuth.user.id,
    otherPlannerName,
    otherPlannerUserId,
    plannerContext: plannerAuth.context,
    plannerUserId: plannerAuth.user.id,
    tripId,
  };
}

async function cleanupScenario(scenario: SeededPlannerKickScenario | null) {
  if (!scenario) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient.from("trips").delete().eq("id", scenario.tripId);

  for (const userId of scenario.extraUserIds) {
    await deleteUser(adminClient, userId);
  }
}

test.beforeAll(async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const organizer = await createAuthenticatedContext(browser, { baseURL });
  const planner = await createAuthenticatedContext(browser, { baseURL });
  const member = await createAuthenticatedContext(browser, { baseURL });

  await markProfileReady(adminClient, organizer.user.id, "Olivia Organizer");
  await markProfileReady(adminClient, planner.user.id, "Peter Planner");
  await markProfileReady(adminClient, member.user.id, "Maya Member");

  authPool = {
    member,
    organizer,
    planner,
  };
});

test.afterAll(async () => {
  if (!authPool) {
    return;
  }

  const adminClient = createAdminClient();

  try {
    await authPool.organizer.context.close();
    await authPool.planner.context.close();
    await authPool.member.context.close();
  } finally {
    await deleteUser(adminClient, authPool.organizer.user.id);
    await deleteUser(adminClient, authPool.planner.user.id);
    await deleteUser(adminClient, authPool.member.user.id);
    authPool = null;
  }
});

test('Planner sees "Kick from Trip" option on member rows', async () => {
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Kick from Trip" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Planner does NOT see "Kick from Trip" on other planner rows', async () => {
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("button", { name: `Open actions for ${scenario.otherPlannerName}` })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Planner does NOT see "Kick from Trip" on the organizer row', async () => {
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("button", { name: "Open actions for Olivia Organizer" })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Planner does NOT see role change options (Make Planner / Make Member)", async () => {
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Make Planner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Make Member" })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Planner clicks "Kick" on a member -> confirmation -> member is removed', async () => {
  const adminClient = createAdminClient();
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await page.getByRole("button", { name: "Kick from Trip" }).click();
    await expect(page.getByRole("heading", { name: "Kick participant" })).toBeVisible();
    await expect(
      page.getByText("Remove Maya Member from this trip? They'll lose access to the itinerary and all trip details."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Remove from trip" }).click();

    await expect(page.getByText("Participant removed from the trip.")).toBeVisible();
    await expect(page.getByText("Maya Member")).toHaveCount(0);
    await expect(await getParticipant(adminClient, scenario.tripId, scenario.memberUserId)).toBeNull();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Organizer still sees full action dropdown on all non-self participants", async () => {
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("button", { name: "Open actions for Olivia Organizer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open actions for Peter Planner" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: `Open actions for ${scenario.otherPlannerName}` })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Open actions for Maya Member" })).toHaveCount(1);

    await page.getByRole("button", { name: "Open actions for Peter Planner" }).click();
    await expect(page.getByRole("button", { name: "Make Member" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kick from Trip" })).toBeVisible();

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Make Planner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kick from Trip" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Member sees no action dropdown at all", async () => {
  let scenario: SeededPlannerKickScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedPlannerKickScenario();
    page = await scenario.memberContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("button", { name: /Open actions for/i })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});
