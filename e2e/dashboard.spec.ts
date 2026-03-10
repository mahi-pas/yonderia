import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestTrip } from "./helpers/seed";
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

async function completeOnboarding(page: Page, displayName: string) {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", {
      name: "Your trips live here",
    }),
  ).toBeVisible();

  await page.waitForTimeout(750);

  const onboardingHeading = page.getByRole("heading", {
    name: "Make your profile feel like you",
  });

  if (await onboardingHeading.isVisible()) {
    await page.getByLabel("Display name").fill(displayName);
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(onboardingHeading).toHaveCount(0);
  }
}

async function createSeedParticipant(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  role: "planner" | "member",
  displayName: string,
  avatarUrl: string,
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: `participant-${randomUUID()}@yonderia.test`,
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
    throw new Error("Failed to create dashboard participant.");
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      avatar_url: avatarUrl,
      display_name: displayName,
      has_completed_onboarding: true,
    })
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  await addParticipant(tripId, userId, role);

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

async function deleteUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

test('Dashboard shows "Create New Trip" card when user has no trips', async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    const page = await context.newPage();

    await completeOnboarding(page, "Dashboard Empty State");

    await expect(page.getByRole("button", { name: /Create New Trip/i })).toBeVisible();
    await expect(page.getByText("No trips yet. Start with one warm little plan, then invite everyone in.")).toBeVisible();
    await expect(page.getByRole("link")).toHaveCount(0);
  } finally {
    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Dashboard shows trip cards for trips the user is participating in", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  const tripIds: string[] = [];

  try {
    const firstTrip = await createTestTrip(user.id);
    const secondTrip = await createTestTrip(user.id);
    tripIds.push(firstTrip.trip.id, secondTrip.trip.id);

    await updateTrip(adminClient, firstTrip.trip.id, {
      name: "Barcelona Birthday Sprint",
      start_date: "2026-06-12",
    });
    await updateTrip(adminClient, secondTrip.trip.id, {
      name: "Lisbon Food Weekend",
      start_date: "2026-07-03",
    });

    const page = await context.newPage();
    await completeOnboarding(page, "Dashboard Trip Member");

    await expect(page.getByRole("link", { name: /Barcelona Birthday Sprint/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lisbon Food Weekend/i })).toBeVisible();
  } finally {
    for (const tripId of tripIds) {
      await adminClient.from("trips").delete().eq("id", tripId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Trip card displays image, name, dates, location, and participant avatars", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  const createdUserIds: string[] = [];
  let tripId: string | null = null;

  try {
    const seededTrip = await createTestTrip(user.id);
    tripId = seededTrip.trip.id;

    await updateTrip(adminClient, tripId, {
      end_date: "2026-06-18",
      image_url: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      location_name: "Lisbon, Portugal",
      name: "Lisbon Summer Escape",
      start_date: "2026-06-12",
    });

    await adminClient
      .from("profiles")
      // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
      .update({
        avatar_url: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        display_name: "Harper Vale",
        has_completed_onboarding: true,
      })
      .eq("id", user.id);

    createdUserIds.push(
      await createSeedParticipant(
        adminClient,
        tripId,
        "planner",
        "Avery Pine",
        "https://lh3.googleusercontent.com/a/default-user=s96-c",
      ),
    );

    createdUserIds.push(
      await createSeedParticipant(
        adminClient,
        tripId,
        "member",
        "Jordan Reef",
        "https://lh3.googleusercontent.com/a/default-user=s96-c",
      ),
    );

    const page = await context.newPage();
    await completeOnboarding(page, "Harper Vale");

    await expect(page.getByAltText("Lisbon Summer Escape cover")).toBeVisible();
    await expect(page.getByRole("link", { name: /Lisbon Summer Escape/i })).toBeVisible();
    await expect(page.getByText("Jun 12, 2026 - Jun 18, 2026")).toBeVisible();
    await expect(page.getByText("Lisbon, Portugal")).toBeVisible();
    await expect(page.getByAltText("Harper Vale")).toBeVisible();
    await expect(page.getByAltText("Avery Pine")).toBeVisible();
    await expect(page.getByAltText("Jordan Reef")).toBeVisible();
  } finally {
    if (tripId) {
      await adminClient.from("trips").delete().eq("id", tripId);
    }

    for (const createdUserId of createdUserIds) {
      await deleteUser(adminClient, createdUserId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Clicking a trip card navigates to /trip/{tripId}", async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let tripId: string | null = null;

  try {
    const seededTrip = await createTestTrip(user.id);
    tripId = seededTrip.trip.id;

    await updateTrip(adminClient, tripId, {
      name: "Navigation Check Trip",
    });

    const page = await context.newPage();
    await completeOnboarding(page, "Dashboard Navigator");

    await page.getByRole("link", { name: /Navigation Check Trip/i }).click();
    await expect(page).toHaveURL(new RegExp(`/trip/${tripId}$`));
  } finally {
    if (tripId) {
      await adminClient.from("trips").delete().eq("id", tripId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});
