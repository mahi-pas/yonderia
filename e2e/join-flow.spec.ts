import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { createTestInviteCode, createTestTrip } from "./helpers/seed";
import type { Database } from "@/lib/types";

loadE2EEnv();

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

async function createParticipantUser(
  adminClient: ReturnType<typeof createAdminClient>,
  displayName: string,
) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: `join-flow-${Date.now()}-${Math.random()}@yonderia.test`,
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
    throw new Error("Expected created test user.");
  }

  return userId;
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

async function deleteUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

async function seedJoinScenario(adminClient: ReturnType<typeof createAdminClient>) {
  const organizerId = await createParticipantUser(adminClient, "Trip Organizer");

  await markProfileReady(adminClient, organizerId, "Trip Organizer");

  const seededTrip = await createTestTrip(organizerId);
  const joinInvite = await createTestInviteCode(seededTrip.trip.id, "join");
  const viewInvite = await createTestInviteCode(seededTrip.trip.id, "view");

  return {
    joinInvite,
    organizerId,
    trip: seededTrip.trip,
    viewInvite,
  };
}

test("Visiting /trip/{tripId}?code={join_code} when not logged in redirects to invite landing", async ({
  browser,
  request,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);
  let context: import("@playwright/test").BrowserContext | undefined;

  try {
    const response = await request.get(`/trip/${seeded.trip.id}?code=${seeded.joinInvite.code}`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(
      `/trip/${seeded.trip.id}/invite-landing?code=${seeded.joinInvite.code}`,
    );

    context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/trip/${seeded.trip.id}?code=${seeded.joinInvite.code}`);

    await expect(page).toHaveURL(
      new RegExp(`/trip/${seeded.trip.id}/invite-landing\\?code=${seeded.joinInvite.code}$`),
    );
    await expect(page.getByRole("heading", { name: "You're invited!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: seeded.trip.name })).toBeVisible();
    await expect(page.getByText("Hosted by")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Google to join" })).toBeVisible();
  } finally {
    await context?.close();
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Visiting /trip/{tripId}?code={join_code} when logged in auto-validates, shows nickname modal, then redirects to trip page", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    await markProfileReady(adminClient, user.id, "Joining Friend");

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.trip.id}?code=${seeded.joinInvite.code}`);
    const nicknameModal = page.getByRole("dialog", { name: "What should people call you on this trip?" });

    await expect(nicknameModal).toBeVisible();

    await nicknameModal.getByRole("textbox").first().fill("Snack Captain");
    await nicknameModal.locator('input[type="date"]').first().fill("2026-05-01");
    await nicknameModal.locator('input[type="time"]').first().fill("14:30");
    await nicknameModal.getByRole("textbox", { name: "Arrival location" }).fill("JFK Airport");
    await nicknameModal.locator('input[type="date"]').nth(1).fill("2026-05-05");
    await nicknameModal.locator('input[type="time"]').nth(1).fill("09:15");
    await nicknameModal.getByRole("textbox", { name: "Departure location" }).fill("LAX Airport");
    await nicknameModal.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.trip.id}$`));
    await expect(page.getByRole("heading", { name: seeded.trip.name })).toBeVisible();

    const { data: participant, error } = await adminClient
      .from("trip_participants")
      .select("nickname, role, arrival_location, departure_location")
      .eq("trip_id", seeded.trip.id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw error;
    }

    expect(participant.nickname).toBe("Snack Captain");
    expect(participant.role).toBe("member");
    expect(participant.arrival_location).toBe("JFK Airport");
    expect(participant.departure_location).toBe("LAX Airport");
  } finally {
    await context.close();
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
    await deleteUser(adminClient, user.id);
  }
});

test("Visiting /trip/{tripId}/join with no code shows manual code entry form", async ({ page }) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}/join`);

    await expect(page.getByRole("heading", { name: "Join this trip" })).toBeVisible();
    await expect(page.getByLabel("Invite code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join trip" })).toBeVisible();
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Entering a valid code manually works the same as the URL flow", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    await markProfileReady(adminClient, user.id, "Manual Joiner");

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.trip.id}/join`);
    await page.getByLabel("Invite code").fill(seeded.joinInvite.code);
    await page.getByRole("button", { name: "Join trip" }).click();

    const nicknameModal = page.getByRole("dialog", { name: "What should people call you on this trip?" });

    await expect(nicknameModal).toBeVisible();

    await nicknameModal.getByRole("textbox").first().fill("Manual Entry");
    await nicknameModal.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.trip.id}$`));
    await expect(page.getByRole("heading", { name: seeded.trip.name })).toBeVisible();
  } finally {
    await context.close();
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
    await deleteUser(adminClient, user.id);
  }
});

test("Entering an invalid code shows an error message", async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    await markProfileReady(adminClient, user.id, "Invalid Code Tester");

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.trip.id}/join`);
    await page.getByLabel("Invite code").fill("bad-code");
    await page.getByRole("button", { name: "Join trip" }).click();

    await expect(page.getByText("That invite code is invalid or no longer active.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.trip.id}/join$`));
  } finally {
    await context.close();
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
    await deleteUser(adminClient, user.id);
  }
});

test('Nickname modal fields are optional — clicking "Skip" still completes the join', async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    await markProfileReady(adminClient, user.id, "Skip Tester");

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.trip.id}?code=${seeded.joinInvite.code}`);

    await expect(
      page.getByRole("heading", { name: "What should people call you on this trip?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Skip" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.trip.id}$`));

    const { data: participant, error } = await adminClient
      .from("trip_participants")
      .select("nickname, arrival_location, departure_location")
      .eq("trip_id", seeded.trip.id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw error;
    }

    expect(participant.nickname).toBeNull();
    expect(participant.arrival_location).toBeNull();
    expect(participant.departure_location).toBeNull();
  } finally {
    await context.close();
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
    await deleteUser(adminClient, user.id);
  }
});

test("Visiting /trip/{tripId}?code={view_code} when not logged in does NOT trigger the join flow", async ({
  page,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedJoinScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}?code=${seeded.viewInvite.code}`);

    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.trip.id}\\?code=${seeded.viewInvite.code}$`));
    await expect(page.getByRole("heading", { name: seeded.trip.name })).toBeVisible();
    await expect(
      page.getByText("You're viewing this trip as a guest. Have an invite code?"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Join this trip" })).toHaveCount(0);
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});
