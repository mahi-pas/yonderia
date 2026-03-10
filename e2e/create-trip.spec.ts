import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
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

async function deleteUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
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

async function openCreateTripModal(page: Page) {
  await page.getByRole("button", { name: /Create New Trip/i }).click();
  await expect(page.getByRole("heading", { name: "Create a trip" })).toBeVisible();
}

async function fillValidTripForm(page: Page, tripName: string) {
  await page.getByLabel("Trip name").fill(tripName);
  await page.getByLabel("Start date").fill("2026-08-12");
  await page.getByLabel("End date").fill("2026-08-18");
  await page.getByLabel("Location").fill("Lisbon, Portugal");
  await page.getByLabel("Description").fill("Playwright created trip.");
}

test("Create trip modal opens when clicking Create New Trip", async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    const page = await context.newPage();
    await completeOnboarding(page, "Create Trip Modal");
    await openCreateTripModal(page);
  } finally {
    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("All fields are present: name, image upload, date range, location, description", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    const page = await context.newPage();
    await completeOnboarding(page, "Create Trip Fields");
    await openCreateTripModal(page);

    await expect(page.getByLabel("Trip name")).toBeVisible();
    await expect(page.getByText("Trip cover image")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.getByLabel("Start date")).toBeVisible();
    await expect(page.getByLabel("End date")).toBeVisible();
    await expect(page.getByLabel("Location")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
  } finally {
    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Submitting with valid data creates the trip and redirects to /trip/{tripId}/participants?tab=invites", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let tripId: string | null = null;

  try {
    const page = await context.newPage();
    const tripName = `Create Trip Redirect ${Date.now()}`;

    await completeOnboarding(page, "Create Trip Redirect");
    await openCreateTripModal(page);
    await fillValidTripForm(page, tripName);
    await page.getByRole("button", { name: "Create trip" }).click();

    await page.waitForURL(/\/trip\/.*\/participants\?tab=invites$/);

    const url = new URL(page.url());
    tripId = url.pathname.split("/")[2] ?? null;

    expect(tripId).toBeTruthy();

    const { data: trip } = await adminClient
      .from("trips")
      .select("id, name")
      .eq("id", tripId ?? "")
      .single();

    expect(trip?.name).toBe(tripName);
  } finally {
    if (tripId) {
      await adminClient.from("trips").delete().eq("id", tripId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("The creating user is automatically added as organizer", async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });
  let tripId: string | null = null;

  try {
    const page = await context.newPage();
    const tripName = `Organizer Trip ${Date.now()}`;

    await completeOnboarding(page, "Create Trip Organizer");
    await openCreateTripModal(page);
    await fillValidTripForm(page, tripName);
    await page.getByRole("button", { name: "Create trip" }).click();

    await page.waitForURL(/\/trip\/.*\/participants\?tab=invites$/);

    const url = new URL(page.url());
    tripId = url.pathname.split("/")[2] ?? null;

    const { data: participant } = await adminClient
      .from("trip_participants")
      .select("trip_id, user_id, role")
      .eq("trip_id", tripId ?? "")
      .eq("user_id", user.id)
      .single();

    expect(participant?.role).toBe("organizer");
  } finally {
    if (tripId) {
      await adminClient.from("trips").delete().eq("id", tripId);
    }

    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Submitting without required fields shows validation errors", async ({
  baseURL,
  browser,
}) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    const page = await context.newPage();
    await completeOnboarding(page, "Create Trip Validation");
    await openCreateTripModal(page);

    await page.getByRole("button", { name: "Create trip" }).click();
    await expect(page.getByText("Give your trip a name before you create it.")).toBeVisible();

    await page.getByLabel("Trip name").fill("Validation Trip");
    await page.getByRole("button", { name: "Create trip" }).click();
    await expect(page.getByText("Choose both a start and end date.")).toBeVisible();
  } finally {
    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("Image upload validates file type and size", async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    const page = await context.newPage();
    await completeOnboarding(page, "Create Trip Upload Validation");
    await openCreateTripModal(page);

    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from("plain text content", "utf8"),
      mimeType: "text/plain",
      name: "not-an-image.txt",
    });

    await expect(page.getByText("Please choose a JPG, PNG, or WebP image.")).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      mimeType: "image/png",
      name: "too-large.png",
    });

    await expect(page.getByText("Images must be 5MB or smaller.")).toBeVisible();
  } finally {
    await context.close();
    await deleteUser(adminClient, user.id);
  }
});

test("On mobile (375px viewport), form renders as full-screen bottom sheet", async ({
  baseURL,
  browser,
}) => {
  test.skip(test.info().project.name !== "mobile", "This check only applies to the mobile project.");

  const adminClient = createAdminClient();
  const { context, user } = await createAuthenticatedContext(browser, { baseURL });

  try {
    const page = await context.newPage();
    await page.setViewportSize({ height: 812, width: 375 });

    await completeOnboarding(page, "Create Trip Mobile Sheet");
    await openCreateTripModal(page);

    const dialog = page.locator("section[role='dialog']");
    const box = await dialog.boundingBox();

    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(360);
    expect(box?.height).toBeGreaterThanOrEqual(760);
    expect(box?.y).toBeLessThanOrEqual(4);
  } finally {
    await context.close();
    await deleteUser(adminClient, user.id);
  }
});
