import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestInviteCode, createTestTrip } from "./helpers/seed";
import type { Database, TripParticipant } from "@/lib/types";

loadE2EEnv();

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;

type SeededRealtimeScenario = {
  extraUserIds: string[];
  targetParticipantName: string;
  targetUserId: string;
  tripId: string;
  viewCode: string;
};

let adminClient: ReturnType<typeof createAdminClient>;
let organizerAuth: AuthSession;
let viewerAuth: AuthSession;

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

async function deleteUser(userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

async function markProfileReady(userId: string, options: { avatarUrl?: string | null; displayName: string }) {
  const { error } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      avatar_url: options.avatarUrl ?? null,
      display_name: options.displayName,
      has_completed_onboarding: true,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

async function createParticipantUser(options: { avatarUrl?: string | null; displayName: string }) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: `realtime-${Date.now()}-${Math.random()}@yonderia.test`,
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
    throw new Error("Expected created realtime test user.");
  }

  await markProfileReady(userId, options);

  return userId;
}

async function updateParticipant(tripId: string, userId: string, values: Partial<TripParticipant>) {
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

async function routeImageSearch(page: Page) {
  await page.route("**/api/images/search**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ results: [] }),
      contentType: "application/json",
      status: 200,
    });
  });
}

function buildTripUrl(tripId: string, options?: { code?: string }) {
  const params = new URLSearchParams({ mapMock: "1" });

  if (options?.code) {
    params.set("code", options.code);
  }

  return `/trip/${tripId}?${params.toString()}`;
}

function getParticipantsSection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Who's in" }) })
    .first();
}

function getDayToggle(page: Page, dayNumber: number, dayLabel: string) {
  return page
    .locator("button")
    .filter({ has: page.getByRole("heading", { name: `Day ${dayNumber} — ${dayLabel}` }) })
    .first();
}

function getDaySection(page: Page, dayNumber: number, dayLabel: string) {
  return getDayToggle(page, dayNumber, dayLabel).locator("..");
}

async function seedRealtimeScenario(): Promise<SeededRealtimeScenario> {
  const createdTrip = await createTestTrip(organizerAuth.user.id);
  const tripId = createdTrip.trip.id;
  const targetParticipantName = "Beacon Buddy";
  const targetUserId = await createParticipantUser({
    displayName: targetParticipantName,
  });

  await addParticipant(tripId, viewerAuth.user.id, "member");
  await addParticipant(tripId, targetUserId, "member");

  await updateParticipant(tripId, organizerAuth.user.id, { nickname: "Olive Organizer" });
  await updateParticipant(tripId, viewerAuth.user.id, { nickname: "Violet Viewer" });
  await updateParticipant(tripId, targetUserId, { nickname: targetParticipantName });

  const viewCode = (await createTestInviteCode(tripId, "view")).code;

  return {
    extraUserIds: [targetUserId],
    targetParticipantName,
    targetUserId,
    tripId,
    viewCode,
  };
}

async function cleanupScenario(scenario: SeededRealtimeScenario | null) {
  if (!scenario) {
    return;
  }

  const { error } = await adminClient.from("trips").delete().eq("id", scenario.tripId);

  if (error) {
    throw error;
  }

  for (const userId of scenario.extraUserIds) {
    await deleteUser(userId);
  }
}

test.beforeAll(async ({ baseURL, browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser, { baseURL });
  viewerAuth = await createAuthenticatedContext(browser, { baseURL });

  await markProfileReady(organizerAuth.user.id, {
    displayName: "Olive Organizer",
  });
  await markProfileReady(viewerAuth.user.id, {
    displayName: "Violet Viewer",
  });
});

test.afterAll(async () => {
  await organizerAuth.context.close();
  await viewerAuth.context.close();
  await deleteUser(viewerAuth.user.id);
  await deleteUser(organizerAuth.user.id);
});

test("local Supabase config enables Realtime", async () => {
  const config = readFileSync(path.resolve(process.cwd(), "supabase/config.toml"), "utf8");

  expect(config).toMatch(/\[realtime\][\s\S]*?enabled = true/u);
});

test("organizer adds an event and it appears in another participant context without refresh", async () => {
  let scenario: SeededRealtimeScenario | null = null;
  let organizerPage: Page | null = null;
  let viewerPage: Page | null = null;

  try {
    scenario = await seedRealtimeScenario();
    organizerPage = await organizerAuth.context.newPage();
    viewerPage = await viewerAuth.context.newPage();

    await routeImageSearch(organizerPage);
    await organizerPage.goto(buildTripUrl(scenario.tripId));
    await viewerPage.goto(buildTripUrl(scenario.tripId));

    await expect(viewerPage.getByTestId("trip-map-pin")).toHaveCount(0);

    await getDayToggle(organizerPage, 2, "Sat, May 2").click();
    await getDaySection(organizerPage, 2, "Sat, May 2").getByRole("button", { name: "Add Event" }).click();

    const dialog = organizerPage.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Realtime River Walk");
    await dialog.getByLabel("Time").fill("15:30");
    await dialog.getByLabel("Location").fill("Seine River Bank");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(getDaySection(organizerPage, 2, "Sat, May 2").getByText("Realtime River Walk")).toBeVisible();
    await expect(getDaySection(viewerPage, 2, "Sat, May 2").getByText("Realtime River Walk")).toBeVisible({
      timeout: 15000,
    });
    await expect(viewerPage.getByTestId("trip-map-pin")).toHaveCount(1, { timeout: 15000 });
  } finally {
    await organizerPage?.close();
    await viewerPage?.close();
    await cleanupScenario(scenario);
  }
});

test("adding a participant via seed helper updates another participant context in realtime", async () => {
  let scenario: SeededRealtimeScenario | null = null;
  let organizerPage: Page | null = null;
  let viewerPage: Page | null = null;

  try {
    scenario = await seedRealtimeScenario();
    organizerPage = await organizerAuth.context.newPage();
    viewerPage = await viewerAuth.context.newPage();

    await organizerPage.goto(buildTripUrl(scenario.tripId));
    await viewerPage.goto(buildTripUrl(scenario.tripId));

    const newParticipantName = "Nova Neighbor";
    const newParticipantId = await createParticipantUser({
      avatarUrl: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      displayName: newParticipantName,
    });
    scenario.extraUserIds.push(newParticipantId);

    await addParticipant(scenario.tripId, newParticipantId, "member");

    await expect(getParticipantsSection(viewerPage).getByText(newParticipantName)).toBeVisible({
      timeout: 15000,
    });
    await expect(getParticipantsSection(viewerPage).getByAltText(newParticipantName)).toBeVisible({
      timeout: 15000,
    });
  } finally {
    await organizerPage?.close();
    await viewerPage?.close();
    await cleanupScenario(scenario);
  }
});

test("kicking a participant updates another participant context in realtime", async () => {
  let scenario: SeededRealtimeScenario | null = null;
  let organizerPage: Page | null = null;
  let viewerPage: Page | null = null;

  try {
    scenario = await seedRealtimeScenario();
    organizerPage = await organizerAuth.context.newPage();
    viewerPage = await viewerAuth.context.newPage();

    await organizerPage.goto(buildTripUrl(scenario.tripId));
    await viewerPage.goto(buildTripUrl(scenario.tripId));

    await expect(getParticipantsSection(viewerPage).getByText(scenario.targetParticipantName)).toBeVisible();

    await organizerPage.goto(`/trip/${scenario.tripId}/participants`);
    await organizerPage.getByRole("button", { name: `Open actions for ${scenario.targetParticipantName}` }).click();
    await organizerPage.getByRole("button", { name: "Kick from Trip" }).click();
    await organizerPage.getByRole("button", { name: "Remove from trip" }).click();

    await expect(getParticipantsSection(viewerPage).getByText(scenario.targetParticipantName)).toHaveCount(0, {
      timeout: 15000,
    });
  } finally {
    await organizerPage?.close();
    await viewerPage?.close();
    await cleanupScenario(scenario);
  }
});

test("changing a participant role updates the badge in another participant context", async () => {
  let scenario: SeededRealtimeScenario | null = null;
  let organizerPage: Page | null = null;
  let viewerPage: Page | null = null;

  try {
    scenario = await seedRealtimeScenario();
    organizerPage = await organizerAuth.context.newPage();
    viewerPage = await viewerAuth.context.newPage();

    await organizerPage.goto(buildTripUrl(scenario.tripId));
    await viewerPage.goto(buildTripUrl(scenario.tripId));

    const targetLink = getParticipantsSection(viewerPage).getByRole("link", {
      name: new RegExp(scenario.targetParticipantName, "u"),
    });

    await expect(targetLink).toBeVisible();
    await expect(targetLink).not.toContainText("★");

    await organizerPage.goto(`/trip/${scenario.tripId}/participants`);
    await organizerPage.getByRole("button", { name: `Open actions for ${scenario.targetParticipantName}` }).click();
    await organizerPage.getByRole("button", { name: "Make Planner" }).click();

    await expect(targetLink).toContainText("★", { timeout: 15000 });
  } finally {
    await organizerPage?.close();
    await viewerPage?.close();
    await cleanupScenario(scenario);
  }
});

test("view-only visitors keep a snapshot and do not receive realtime updates", async ({ browser }) => {
  let scenario: SeededRealtimeScenario | null = null;
  let organizerPage: Page | null = null;
  let guestPage: Page | null = null;
  let guestContext = null as Awaited<ReturnType<typeof browser.newContext>> | null;

  try {
    scenario = await seedRealtimeScenario();
    organizerPage = await organizerAuth.context.newPage();
    guestContext = await browser.newContext();
    guestPage = await guestContext.newPage();

    await routeImageSearch(organizerPage);
    await organizerPage.goto(buildTripUrl(scenario.tripId));
    await guestPage.goto(buildTripUrl(scenario.tripId, { code: scenario.viewCode }));

    await expect(guestPage.getByText("You're viewing this trip as a guest.")).toBeVisible();
    await expect(guestPage.getByTestId("trip-map-pin")).toHaveCount(0);

    await getDayToggle(organizerPage, 2, "Sat, May 2").click();
    await getDaySection(organizerPage, 2, "Sat, May 2").getByRole("button", { name: "Add Event" }).click();

    const dialog = organizerPage.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Snapshot Stays Still");
    await dialog.getByLabel("Time").fill("16:15");
    await dialog.getByLabel("Location").fill("Tokyo Tower");
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(guestPage.getByText("Snapshot Stays Still")).toHaveCount(0, { timeout: 5000 });
    await expect(guestPage.getByTestId("trip-map-pin")).toHaveCount(0, { timeout: 5000 });

    await guestPage.reload();

    await expect(guestPage.getByText("Snapshot Stays Still")).toBeVisible();
  } finally {
    await organizerPage?.close();
    await guestPage?.close();
    await guestContext?.close();
    await cleanupScenario(scenario);
  }
});
