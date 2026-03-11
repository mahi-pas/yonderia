import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
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

function formatInputSummary(prefix: string, timestamp: string, location: string): string {
  return `${prefix} ${format(new Date(timestamp), "EEE h:mmaaa")} at ${location}`;
}

function formatTimeInputValue(timestamp: string): string {
  return format(new Date(timestamp), "HH:mm");
}

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type AuthPool = {
  member: AuthSession;
  organizer: AuthSession;
  planner: AuthSession;
};

type SeededScenario = {
  memberContext: AuthSession["context"];
  memberUserId: string;
  organizerContext: AuthSession["context"];
  plannerContext: AuthSession["context"];
  tripId: string;
};

let authPool: AuthPool | null = null;

async function seedScenario(options?: {
  memberParticipant?: Partial<TripParticipant>;
  organizerParticipant?: Partial<TripParticipant>;
  plannerParticipant?: Partial<TripParticipant>;
}) {
  if (!authPool) {
    throw new Error("Expected auth pool to be initialized.");
  }

  const adminClient = createAdminClient();
  const organizerAuth = authPool.organizer;
  const plannerAuth = authPool.planner;
  const memberAuth = authPool.member;
  const createdTrip = await createTestTrip(organizerAuth.user.id);
  const tripId = createdTrip.trip.id;

  await addParticipant(tripId, plannerAuth.user.id, "planner");
  await addParticipant(tripId, memberAuth.user.id, "member");

  await updateParticipant(adminClient, tripId, organizerAuth.user.id, {
    nickname: "Olivia Organizer",
    ...options?.organizerParticipant,
  });
  await updateParticipant(adminClient, tripId, plannerAuth.user.id, {
    nickname: "Peter Planner",
    ...options?.plannerParticipant,
  });
  await updateParticipant(adminClient, tripId, memberAuth.user.id, {
    nickname: "Maya Member",
    ...options?.memberParticipant,
  });

  return {
    memberContext: memberAuth.context,
    memberUserId: memberAuth.user.id,
    organizerContext: organizerAuth.context,
    plannerContext: plannerAuth.context,
    tripId,
  } satisfies SeededScenario;
}

async function cleanupScenario(scenario: SeededScenario | null) {
  if (!scenario) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient.from("trips").delete().eq("id", scenario.tripId);
}

function getTripInfoBanner(page: Page) {
  return page.getByRole("button", { name: /your trip details/i });
}

function getParticipantsSection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Who's in" }) })
    .first();
}

function getParticipantsList(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Your crew" }) })
    .locator("li");
}

async function openTripPage(page: Page, tripId: string) {
  await page.goto(`/trip/${tripId}`);
}

async function openNicknameModalFromBanner(page: Page, heading: string) {
  await page.getByRole("button", { name: new RegExp(heading, "i") }).click();
  await expect(page.getByRole("heading", { name: "Edit your trip details" })).toBeVisible();
}

async function saveOwnInfo(page: Page, values: {
  nickname?: string;
  arrivalDate?: string;
  arrivalLocation?: string;
  arrivalTime?: string;
  departureDate?: string;
  departureLocation?: string;
  departureTime?: string;
}) {
  if (values.nickname !== undefined) {
    await page.getByRole("textbox", { name: "Trip nickname" }).fill(values.nickname);
  }

  if (values.arrivalDate !== undefined) {
    await page.getByLabel("Arrival date").fill(values.arrivalDate);
  }

  if (values.arrivalTime !== undefined) {
    await page.getByLabel("Arrival time").fill(values.arrivalTime);
  }

  if (values.arrivalLocation !== undefined) {
    await page.getByRole("textbox", { name: "Arrival location", exact: true }).fill(values.arrivalLocation);
  }

  if (values.departureDate !== undefined) {
    await page.getByLabel("Departure date").fill(values.departureDate);
  }

  if (values.departureTime !== undefined) {
    await page.getByLabel("Departure time").fill(values.departureTime);
  }

  if (values.departureLocation !== undefined) {
    await page.getByRole("textbox", { name: "Departure location", exact: true }).fill(values.departureLocation);
  }

  await page.getByRole("button", { name: "Save changes" }).click();
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

test('"Set your travel details" banner appears when arrival/departure are empty', async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await expect(page.getByRole("button", { name: /Set your travel details/i })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Tapping the banner opens the NicknameModal", async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await openNicknameModalFromBanner(page, "Set your travel details");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("NicknameModal fields are pre-filled with current data", async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario({
      memberParticipant: {
        arrival_location: "JFK Airport",
        arrival_time: "2026-05-01T09:30:00.000Z",
        departure_location: "LAX Airport",
        departure_time: "2026-05-05T20:15:00.000Z",
        nickname: "MJ",
      },
    });
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await openNicknameModalFromBanner(page, "Update your info");

    await expect(page.getByRole("textbox", { name: "Trip nickname" })).toHaveValue("MJ");
    await expect(page.getByLabel("Arrival date")).toHaveValue("2026-05-01");
    await expect(page.getByLabel("Arrival time")).toHaveValue(formatTimeInputValue("2026-05-01T09:30:00.000Z"));
    await expect(page.getByRole("textbox", { name: "Arrival location", exact: true })).toHaveValue("JFK Airport");
    await expect(page.getByLabel("Departure date")).toHaveValue("2026-05-05");
    await expect(page.getByLabel("Departure time")).toHaveValue(formatTimeInputValue("2026-05-05T20:15:00.000Z"));
    await expect(page.getByRole("textbox", { name: "Departure location", exact: true })).toHaveValue("LAX Airport");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Saving nickname updates the participant's display in the participants row", async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await openNicknameModalFromBanner(page, "Set your travel details");
    await saveOwnInfo(page, { nickname: "Snack Captain" });

    await expect(getParticipantsSection(page).getByText("Snack Captain")).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Saving arrival/departure shows the summary in the trip info banner", async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await openNicknameModalFromBanner(page, "Set your travel details");
    await saveOwnInfo(page, {
      arrivalDate: "2026-05-03",
      arrivalLocation: "JFK",
      arrivalTime: "15:00",
      departureDate: "2026-05-04",
      departureLocation: "LAX",
      departureTime: "14:00",
    });

    const banner = getTripInfoBanner(page);
    await expect(banner).toContainText(formatInputSummary("Arriving", "2026-05-03T15:00", "JFK"));
    await expect(banner).toContainText(formatInputSummary("Leaving", "2026-05-04T14:00", "LAX"));
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Departure before arrival shows a validation error", async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await openNicknameModalFromBanner(page, "Set your travel details");
    await saveOwnInfo(page, {
      arrivalDate: "2026-05-05",
      arrivalTime: "18:00",
      departureDate: "2026-05-05",
      departureTime: "10:00",
    });

    await expect(page.getByText("Departure must be after arrival.")).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('"Clear" button resets a field to empty', async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario({
      memberParticipant: {
        arrival_location: "JFK Airport",
        arrival_time: "2026-05-01T09:30:00.000Z",
      },
    });
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await openNicknameModalFromBanner(page, "Update your info");
    await page
      .locator("label")
      .filter({ has: page.getByRole("textbox", { name: "Arrival location", exact: true }) })
      .locator("button")
      .click();
    await expect(page.getByRole("textbox", { name: "Arrival location", exact: true })).toHaveValue("");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Organizer sees "Edit Name" option in participant action dropdown', async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.organizerContext.newPage();

    await page.goto(`/trip/${scenario.tripId}/participants`);
    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Edit Name" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Organizer clicks "Edit Name" -> edits nickname -> saves -> nickname updates in the list', async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.organizerContext.newPage();

    await page.goto(`/trip/${scenario.tripId}/participants`);
    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await page.getByRole("button", { name: "Edit Name" }).click();
    await page.getByRole("dialog", { name: "Edit nickname" }).getByRole("textbox", { name: /Nickname/i }).fill("Map Master");
    await page.getByRole("button", { name: "Save nickname" }).click();

    await expect(getParticipantsList(page).getByText("Map Master")).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test('Non-organizer does NOT see "Edit Name" option', async () => {
  let scenario: SeededScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedScenario();
    page = await scenario.plannerContext.newPage();

    await page.goto(`/trip/${scenario.tripId}/participants`);
    await page.getByRole("button", { name: "Open actions for Maya Member" }).click();
    await expect(page.getByRole("button", { name: "Edit Name" })).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Real-time: organizer changes nickname -> updated immediately in other user's view", async () => {
  let scenario: SeededScenario | null = null;
  let organizerPage: Page | null = null;
  let memberPage: Page | null = null;

  try {
    scenario = await seedScenario();
    organizerPage = await scenario.organizerContext.newPage();
    memberPage = await scenario.memberContext.newPage();

    await openTripPage(organizerPage, scenario.tripId);
    await openTripPage(memberPage, scenario.tripId);

    await expect(getParticipantsSection(memberPage).getByText("Peter Planner")).toBeVisible();

    await organizerPage.goto(`/trip/${scenario.tripId}/participants`);
    await organizerPage.getByRole("button", { name: "Open actions for Peter Planner" }).click();
    await organizerPage.getByRole("button", { name: "Edit Name" }).click();
    await organizerPage
      .getByRole("dialog", { name: "Edit nickname" })
      .getByRole("textbox", { name: /Nickname/i })
      .fill("Plan Wizard");
    await organizerPage.getByRole("button", { name: "Save nickname" }).click();

    await expect(getParticipantsSection(memberPage).getByText("Plan Wizard")).toBeVisible({ timeout: 15000 });
  } finally {
    await organizerPage?.close();
    await memberPage?.close();
    await cleanupScenario(scenario);
  }
});
