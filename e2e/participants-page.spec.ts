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

async function getParticipantNickname(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  userId: string,
) {
  const { data, error } = await adminClient
    .from("trip_participants")
    .select("nickname")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.nickname ?? null;
}

async function getInviteCodes(adminClient: ReturnType<typeof createAdminClient>, tripId: string) {
  const { data, error } = await adminClient
    .from("invite_codes")
    .select("id, code, code_type, is_active")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type AuthPool = {
  member: AuthSession;
  organizer: AuthSession;
  planner: AuthSession;
};

type SeededParticipantsScenario = {
  memberContext: AuthSession["context"];
  memberUserId: string;
  organizerContext: AuthSession["context"];
  organizerUserId: string;
  plannerContext: AuthSession["context"];
  plannerUserId: string;
  tripId: string;
};

let authPool: AuthPool | null = null;

function getPeopleList(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Your crew" }) })
    .locator("li");
}

async function seedParticipantsScenario(): Promise<SeededParticipantsScenario> {
  if (!authPool) {
    throw new Error("Expected shared auth pool to be initialized.");
  }

  const adminClient = createAdminClient();
  const organizerAuth = authPool.organizer;
  const plannerAuth = authPool.planner;
  const memberAuth = authPool.member;
  const createdTrip = await createTestTrip(organizerAuth.user.id);
  const tripId = createdTrip.trip.id;

  await updateParticipant(adminClient, tripId, organizerAuth.user.id, {
    arrival_location: "JFK",
    arrival_time: "2026-05-01T15:00:00.000Z",
    departure_location: "LAX",
    departure_time: "2026-05-05T10:00:00.000Z",
    nickname: "Olivia Organizer",
  });

  await addParticipant(tripId, plannerAuth.user.id, "planner");
  await addParticipant(tripId, memberAuth.user.id, "member");

  await updateParticipant(adminClient, tripId, plannerAuth.user.id, {
    arrival_location: "SFO",
    arrival_time: "2026-05-01T17:00:00.000Z",
    nickname: "Peter Planner",
  });
  await updateParticipant(adminClient, tripId, memberAuth.user.id, {
    departure_location: "SEA",
    departure_time: "2026-05-05T12:00:00.000Z",
    nickname: "Maya Member",
  });

  return {
    memberContext: memberAuth.context,
    memberUserId: memberAuth.user.id,
    organizerContext: organizerAuth.context,
    organizerUserId: organizerAuth.user.id,
    plannerContext: plannerAuth.context,
    plannerUserId: plannerAuth.user.id,
    tripId,
  };
}

async function cleanupScenario(scenario: SeededParticipantsScenario | null) {
  if (!scenario) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient.from("trips").delete().eq("id", scenario.tripId);
}

test.beforeAll(async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const organizer = await createAuthenticatedContext(browser, { baseURL });
  const planner = await createAuthenticatedContext(browser, { baseURL });
  const member = await createAuthenticatedContext(browser, { baseURL });
  const origin = baseURL ?? "http://localhost:3000";

  await organizer.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await planner.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await member.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });

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
    await authPool.organizer?.context?.close();
    await authPool.planner?.context?.close();
    await authPool.member?.context?.close();
  } finally {
    await deleteUser(adminClient, authPool.organizer.user.id);
    await deleteUser(adminClient, authPool.planner.user.id);
    await deleteUser(adminClient, authPool.member.user.id);
    authPool = null;
  }
});

test('Page shows "People" tab with all participants sorted correctly (organizer first, then planners, then members)', async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("link", { name: "People" })).toBeVisible();

    const rows = getPeopleList(page);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Olivia Organizer");
    await expect(rows.nth(1)).toContainText("Peter Planner");
    await expect(rows.nth(2)).toContainText("Maya Member");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Organizer sees action menus on all participants except themselves", async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("button", { name: "Open actions for Olivia Organizer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open actions for Peter Planner" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Open actions for Maya Member" })).toHaveCount(1);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Organizer can kick a participant: click kick -> confirmation dialog -> confirm -> participant disappears", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Peter Planner" }).click();
    await page.getByRole("button", { name: "Kick from Trip" }).click();
    await expect(page.getByRole("heading", { name: "Kick participant" })).toBeVisible();
    await expect(
      page.getByText("Remove Peter Planner from this trip? They'll lose access to the itinerary and all trip details."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Remove from trip" }).click();

    await expect(page.getByText("Participant removed from the trip.")).toBeVisible();
    await expect(page.getByText("Peter Planner")).toHaveCount(0);
    await expect(await getParticipant(adminClient, scenario.tripId, scenario.plannerUserId)).toBeNull();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Organizer can change a participant\'s role: click "Make Planner" -> role badge updates', async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await page.getByRole("button", { name: "Make Planner" }).click();

    await expect(page.getByText("Participant is now a planner.")).toBeVisible();
    await expect(getPeopleList(page).nth(1)).toContainText("Maya Member");
    await expect(await getParticipant(adminClient, scenario.tripId, scenario.memberUserId)).toMatchObject({
      role: "planner",
    });
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Organizer can change a participant\'s nickname: click "Edit Name" -> save -> name updates', async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await page.getByRole("button", { name: "Edit Name" }).click();
    await page.getByRole("dialog", { name: "Edit nickname" }).getByRole("textbox", { name: /Nickname/i }).fill("Map Master");
    await page.getByRole("button", { name: "Save nickname" }).click();

    await expect(page.getByText("Updated Maya Member to Map Master")).toBeVisible();
    await expect(getPeopleList(page).getByText("Map Master")).toBeVisible();
    await expect(await getParticipantNickname(adminClient, scenario.tripId, scenario.memberUserId)).toBe("Map Master");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Planner only sees action menus on member rows", async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(getPeopleList(page)).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Open actions for Olivia Organizer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open actions for Peter Planner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open actions for Maya Member" })).toHaveCount(1);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Planner can kick a member but cannot change roles", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Make Planner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Make Member" })).toHaveCount(0);
    await page.getByRole("button", { name: "Kick from Trip" }).click();
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

test('Planner sees the "Invites" tab', async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.plannerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(page.getByRole("link", { name: "Invites" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Member sees the participant list but no action menus and no "Invites" tab', async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.memberContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await expect(getPeopleList(page)).toHaveCount(3);
    await expect(page.getByRole("button", { name: /Open actions for/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Invites" })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('"Invites" tab: organizer can generate all three code types (join, join_planner, view)', async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants?tab=invites`);

    await page.getByRole("radio", { name: "Join as Member" }).check();
    await page.getByRole("button", { name: "Generate invite" }).click();
    await page.getByText("New invite generated.").waitFor();

    await page.getByRole("radio", { name: "Join as Planner" }).check();
    await page.getByRole("button", { name: "Generate invite" }).click();
    await page.getByText("New invite generated.").waitFor();

    await page.getByRole("radio", { name: "View Only" }).check();
    await page.getByRole("button", { name: "Generate invite" }).click();
    await page.getByText("New invite generated.").waitFor();

    await expect
      .poll(async () => (await getInviteCodes(adminClient, scenario.tripId)).map((invite) => invite.code_type).sort())
      .toEqual(["join", "join_planner", "view"]);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('"Invites" tab: copy button works (copies link to clipboard)', async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants?tab=invites`);

    await page.getByLabel("Join as Member").check();
    await page.getByRole("button", { name: "Generate invite" }).click();
    await page.getByRole("button", { name: "Copy link" }).click();

    const copiedValue = await page.evaluate(async () => navigator.clipboard.readText());
    expect(copiedValue).toContain(`/trip/${scenario.tripId}?code=`);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('"Invites" tab: organizer can revoke a code (confirmation -> code moves to revoked section)', async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants?tab=invites`);

    await page.getByRole("radio", { name: "Join as Member" }).check();
    await page.getByRole("button", { name: "Generate invite" }).click();
    await page.getByText("New invite generated.").waitFor();
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByRole("heading", { name: "Revoke invite" })).toBeVisible();
    await page.getByRole("button", { name: "Revoke invite" }).click();

    await expect(page.getByText("Invite revoked.")).toBeVisible();
    await page.getByRole("button", { name: "Show" }).click();
    await expect(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Past links" }) })
        .locator("li"),
    ).toHaveCount(1);

    await expect.poll(async () => (await getInviteCodes(adminClient, scenario.tripId))[0]?.is_active).toBe(false);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Back arrow navigates to /trip/{tripId}", async () => {
  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    await page.getByRole("link", { name: "Back to trip" }).click();
    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("On mobile: tabs are full-width and tappable, action menus are usable", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction check.");

  let scenario: SeededParticipantsScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantsScenario();
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/participants`);

    const peopleTab = page.getByRole("link", { name: "People" });
    const invitesTab = page.getByRole("link", { name: "Invites" });
    const peopleBox = await peopleTab.boundingBox();
    const invitesBox = await invitesTab.boundingBox();

    expect(peopleBox?.width).toBeGreaterThan(120);
    expect(invitesBox?.width).toBeGreaterThan(120);

    await invitesTab.click();
    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}/participants\\?tab=invites$`));
    await peopleTab.click();
    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}/participants$`));

    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Make Planner" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});
