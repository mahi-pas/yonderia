import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { createTestInviteCode, createTestTrip } from "./helpers/seed";
import type { Database, InviteCode, Trip } from "@/lib/types";

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
  options: {
    avatarUrl?: string | null;
    displayName: string;
  },
) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: `invite-landing-${Date.now()}-${Math.random()}@yonderia.test`,
    email_confirm: true,
    password: "PlaywrightPassword123!",
    user_metadata: {
      full_name: options.displayName,
    },
  });

  if (error) {
    throw error;
  }

  const userId = data.user?.id;

  if (!userId) {
    throw new Error("Expected created test user.");
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      avatar_url: options.avatarUrl ?? null,
      display_name: options.displayName,
      has_completed_onboarding: true,
    })
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

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

async function revokeInviteCode(
  adminClient: ReturnType<typeof createAdminClient>,
  inviteCodeId: string,
) {
  const { error } = await adminClient
    .from("invite_codes")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      is_active: false,
    })
    .eq("id", inviteCodeId);

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

type SeededInviteLandingScenario = {
  joinInvite: InviteCode;
  organizerId: string;
  trip: Trip;
  viewInvite: InviteCode;
};

async function seedInviteLandingScenario(
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<SeededInviteLandingScenario> {
  const organizerId = await createParticipantUser(adminClient, {
    avatarUrl: "https://lh3.googleusercontent.com/a/default-user=s256-c",
    displayName: "Morgan Organizer",
  });
  const seededTrip = await createTestTrip(organizerId);

  await updateTrip(adminClient, seededTrip.trip.id, {
    end_date: "2026-03-18",
    image_url: "https://lh3.googleusercontent.com/a/default-user=s2048-c",
    location_name: "Lisbon, Portugal",
    name: "Spring in Lisbon",
    start_date: "2026-03-14",
  });

  const joinInvite = await createTestInviteCode(seededTrip.trip.id, "join");
  const viewInvite = await createTestInviteCode(seededTrip.trip.id, "view");

  return {
    joinInvite,
    organizerId,
    trip: {
      ...seededTrip.trip,
      end_date: "2026-03-18",
      image_url: "https://lh3.googleusercontent.com/a/default-user=s2048-c",
      location_name: "Lisbon, Portugal",
      name: "Spring in Lisbon",
      start_date: "2026-03-14",
    },
    viewInvite,
  };
}

test("Unauthenticated user with join code sees the invite landing page instead of the login page", async ({
  page,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}?code=${seeded.joinInvite.code}`);

    await expect(page).toHaveURL(
      new RegExp(`/trip/${seeded.trip.id}/invite-landing\\?code=${seeded.joinInvite.code}$`),
    );
    await expect(page.getByRole("heading", { name: "You're invited!" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign in with Google$/ })).toHaveCount(0);
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Invite landing page shows trip details, organizer, image, and a prominent join button", async ({
  page,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=${seeded.joinInvite.code}`);

    await expect(page.getByRole("heading", { name: "You're invited!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: seeded.trip.name })).toBeVisible();
    await expect(page.getByText("Mar 14 - 18, 2026")).toBeVisible();
    await expect(page.getByText("Lisbon, Portugal")).toBeVisible();
    await expect(page.getByText("Hosted by")).toBeVisible();
    await expect(page.getByText("Morgan Organizer")).toBeVisible();

    const heroImage = page.getByRole("img", { name: `${seeded.trip.name} invite image` });
    const cta = page.getByRole("button", { name: "Sign in with Google to join" });
    const ctaBox = await cta.boundingBox();
    const imageBox = await heroImage.boundingBox();

    await expect(heroImage).toBeVisible();
    await expect(cta).toBeVisible();
    expect(ctaBox?.height ?? 0).toBeGreaterThanOrEqual(56);
    expect(ctaBox?.width ?? 0).toBeGreaterThan(220);
    expect(imageBox?.width ?? 0).toBeGreaterThan(300);
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Clicking sign-in starts Google OAuth with the join flow as the post-login redirect", async ({
  page,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=${seeded.joinInvite.code}`);

    const oauthRequestPromise = page.waitForRequest((request) => {
      return request.url().includes("/auth/v1/authorize") && request.url().includes("provider=google");
    });

    await page.getByRole("button", { name: "Sign in with Google to join" }).click();

    const oauthRequest = await oauthRequestPromise;
    const oauthUrl = new URL(oauthRequest.url());
    const callbackUrl = new URL(oauthUrl.searchParams.get("redirect_to") ?? "");

    expect(callbackUrl.pathname).toBe("/auth/callback");
    expect(callbackUrl.searchParams.get("redirectTo")).toBe(
      `/trip/${seeded.trip.id}/join?code=${seeded.joinInvite.code}`,
    );
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Unauthenticated user with view code sees the shared-trip variant", async ({ page }) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=${seeded.viewInvite.code}`);

    await expect(page.getByRole("heading", { name: "You've been shared a trip!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Google to view" })).toBeVisible();
    await expect(page.getByText("Sign in to explore the full itinerary and map.")).toBeVisible();
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Invalid or revoked code shows the no-longer-valid message", async ({ page }) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=bad-code`);
    await expect(page.getByRole("heading", { name: "This invite link is no longer valid" })).toBeVisible();

    await revokeInviteCode(adminClient, seeded.joinInvite.id);
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=${seeded.joinInvite.code}`);
    await expect(page.getByRole("heading", { name: "This invite link is no longer valid" })).toBeVisible();
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Authenticated user with join code skips the landing page and goes straight to the join flow", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    await markProfileReady(adminClient, user.id, "Returning Joiner");

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.trip.id}?code=${seeded.joinInvite.code}`);

    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.trip.id}/join\\?code=${seeded.joinInvite.code}$`));
    await expect(page.getByRole("heading", { name: "What should people call you on this trip?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You're invited!" })).toHaveCount(0);
  } finally {
    await context.close();
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
    await deleteUser(adminClient, user.id);
  }
});

test("Mobile landing page stays readable in a single-column 375px layout", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 375, "Mobile-only viewport assertion.");

  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=${seeded.joinInvite.code}`);

    const section = page.locator("main section").first();
    const heroImage = page.getByRole("img", { name: `${seeded.trip.name} invite image` });
    const heading = page.getByRole("heading", { name: seeded.trip.name });
    const sectionBox = await section.boundingBox();
    const imageBox = await heroImage.boundingBox();
    const headingBox = await heading.boundingBox();

    await expect(heading).toBeVisible();
    expect(sectionBox?.width ?? 0).toBeLessThanOrEqual(360);
    expect(imageBox?.width ?? 0).toBeGreaterThanOrEqual((sectionBox?.width ?? 0) - 4);
    expect(headingBox?.height ?? 0).toBeGreaterThanOrEqual(40);
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});

test("Landing page keeps the hero image optimized and loads quickly even with a large image", async ({
  page,
}) => {
  const adminClient = createAdminClient();
  const seeded = await seedInviteLandingScenario(adminClient);

  try {
    const startedAt = Date.now();
    await page.goto(`/trip/${seeded.trip.id}/invite-landing?code=${seeded.joinInvite.code}`, {
      waitUntil: "domcontentloaded",
    });
    const elapsedMs = Date.now() - startedAt;

    const heroImage = page.getByRole("img", { name: `${seeded.trip.name} invite image` });
    const imageSrc = await heroImage.getAttribute("src");

    expect(elapsedMs).toBeLessThan(5000);
    expect(imageSrc).toContain("/_next/image?url=");
    expect(imageSrc).toContain(encodeURIComponent(seeded.trip.image_url ?? ""));
  } finally {
    await adminClient.from("trips").delete().eq("id", seeded.trip.id);
    await deleteUser(adminClient, seeded.organizerId);
  }
});
