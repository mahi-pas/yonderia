import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestInviteCode, createTestTrip } from "./helpers/seed";
import type { Database, Trip } from "@/lib/types";

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
    email: `trip-page-${Date.now()}-${Math.random()}@yonderia.test`,
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

type SeededTripContext = {
  inviteCodes: {
    join: string;
    view: string;
  };
  organizerId: string;
  plannerId: string;
  tripId: string;
};

async function seedTripScenario(
  adminClient: ReturnType<typeof createAdminClient>,
  organizerId: string,
): Promise<SeededTripContext> {
  const createdTrip = await createTestTrip(organizerId);
  const tripId = createdTrip.trip.id;
  const plannerId = await createParticipantUser(adminClient, {
    avatarUrl: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    displayName: "Avery Planner",
  });

  await addParticipant(tripId, plannerId, "planner");
  await updateTrip(adminClient, tripId, {
    description: "A long sunny weekend with a packed food list.",
    image_url: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    location_name: "Lisbon, Portugal",
    name: "Trip Page Verification",
    start_date: "2026-09-04",
    end_date: "2026-09-09",
  });

  const joinCode = await createTestInviteCode(tripId, "join");
  const viewCode = await createTestInviteCode(tripId, "view");

  return {
    inviteCodes: {
      join: joinCode.code,
      view: viewCode.code,
    },
    organizerId,
    plannerId,
    tripId,
  };
}

async function deleteUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

test("Participant sees full trip page: hero, description, participants row, and itinerary", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let seeded: SeededTripContext | null = null;

  try {
    await markProfileReady(adminClient, user.id, "Organizer User");
    seeded = await seedTripScenario(adminClient, user.id);

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await expect(page.getByRole("heading", { name: "Trip Page Verification" })).toBeVisible();
    await expect(page.getByText("Sep 4, 2026 - Sep 9, 2026")).toBeVisible();
    await expect(page.getByText("Lisbon, Portugal")).toBeVisible();
    await expect(page.getByText("A long sunny weekend with a packed food list.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who's in" })).toBeVisible();
    await expect(page.getByText("The trip map is coming next.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Day 1/i })).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Participant sees edit button if they are the organizer", async ({ baseURL, browser }) => {
  test.fail(true, "Trip edit button has not been implemented yet.");

  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let seeded: SeededTripContext | null = null;

  try {
    await markProfileReady(adminClient, user.id, "Organizer User");
    seeded = await seedTripScenario(adminClient, user.id);

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await expect(page.getByRole("link", { name: /edit/i })).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Non-participant without code sees the invite code entry form", async ({ page }) => {
  const adminClient = createAdminClient();
  const organizer = await createParticipantUser(adminClient, {
    displayName: "Trip Organizer",
  });
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedTripScenario(adminClient, organizer);

    await page.goto(`/trip/${seeded.tripId}`);

    await expect(page.getByRole("heading", { name: "Enter your invite code" })).toBeVisible();
    await expect(page.getByLabel("Invite code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to join" })).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await deleteUser(adminClient, organizer);
  }
});

test("Non-participant with valid view code sees the read-only page", async ({ page }) => {
  const adminClient = createAdminClient();
  const organizer = await createParticipantUser(adminClient, {
    displayName: "Trip Organizer",
  });
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedTripScenario(adminClient, organizer);

    await page.goto(`/trip/${seeded.tripId}?code=${seeded.inviteCodes.view}`);

    await expect(page.getByRole("heading", { name: "Trip Page Verification" })).toBeVisible();
    await expect(page.getByText("A long sunny weekend with a packed food list.")).toBeVisible();
    await expect(page.getByText("Who's in")).toBeVisible();
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await deleteUser(adminClient, organizer);
  }
});

test("Read-only page shows the guest banner with link to join page", async ({ page }) => {
  const adminClient = createAdminClient();
  const organizer = await createParticipantUser(adminClient, {
    displayName: "Trip Organizer",
  });
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedTripScenario(adminClient, organizer);

    await page.goto(`/trip/${seeded.tripId}?code=${seeded.inviteCodes.view}`);

    await expect(
      page.getByText("You're viewing this trip as a guest. Have an invite code?"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Enter it to join!" })).toHaveAttribute(
      "href",
      `/trip/${seeded.tripId}/join`,
    );
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await deleteUser(adminClient, organizer);
  }
});

test("Read-only page does NOT have clickable avatars", async ({ page }) => {
  const adminClient = createAdminClient();
  const organizer = await createParticipantUser(adminClient, {
    displayName: "Trip Organizer",
  });
  let seeded: SeededTripContext | null = null;

  try {
    seeded = await seedTripScenario(adminClient, organizer);

    await page.goto(`/trip/${seeded.tripId}?code=${seeded.inviteCodes.view}`);

    await expect(page.getByRole("link", { name: /Avery Planner/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Organizer/i })).toHaveCount(0);
    await expect(page.getByText("See all")).toHaveCount(0);
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await deleteUser(adminClient, organizer);
  }
});

test("Clicking an avatar (as participant) navigates to /profile/{userId}", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let seeded: SeededTripContext | null = null;

  try {
    await markProfileReady(adminClient, user.id, "Organizer User");
    seeded = await seedTripScenario(adminClient, user.id);

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await page.getByRole("link").filter({ hasText: "Avery Planner" }).click();
    await expect(page).toHaveURL(new RegExp(`/profile/${seeded.plannerId}$`));
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test('Clicking "See All" navigates to /trip/{tripId}/participants', async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let seeded: SeededTripContext | null = null;

  try {
    await markProfileReady(adminClient, user.id, "Organizer User");
    seeded = await seedTripScenario(adminClient, user.id);

    const page = await context.newPage();
    await page.goto(`/trip/${seeded.tripId}`);

    await page.locator("button").filter({ hasText: "See all" }).click();
    await expect(page).toHaveURL(new RegExp(`/trip/${seeded.tripId}/participants$`));
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Avatar click and row click are distinct interactions", async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let seeded: SeededTripContext | null = null;

  try {
    await markProfileReady(adminClient, user.id, "Organizer User");
    seeded = await seedTripScenario(adminClient, user.id);

    const profilePage = await context.newPage();
    await profilePage.goto(`/trip/${seeded.tripId}`);
    await profilePage.getByRole("link").filter({ hasText: "Avery Planner" }).click();
    await expect(profilePage).toHaveURL(new RegExp(`/profile/${seeded.plannerId}$`));

    const rowPage = await context.newPage();
    await rowPage.goto(`/trip/${seeded.tripId}`);
    await rowPage.getByRole("button").filter({ hasText: "Organizer" }).first().click({
      position: { x: 10, y: 10 },
    });
    await expect(rowPage).toHaveURL(new RegExp(`/trip/${seeded.tripId}/participants$`));
  } finally {
    if (seeded) {
      await adminClient.from("trips").delete().eq("id", seeded.tripId);
      await deleteUser(adminClient, seeded.plannerId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});
