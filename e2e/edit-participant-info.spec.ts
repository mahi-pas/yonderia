import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
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

function formatTimestampForInput(value: string): string {
  const parsedDate = new Date(value);
  const pad = (segment: number) => String(segment).padStart(2, "0");

  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
}

function formatTravelMoment(prefix: string, timestamp: string, location: string): string {
  return `${prefix} ${format(parseISO(timestamp), "EEE h:mm a")} at ${location}`;
}

function formatTravelMomentFromLocalInput(prefix: string, timestamp: string, location: string): string {
  return `${prefix} ${format(new Date(timestamp), "EEE h:mm a")} at ${location}`;
}

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type AuthPool = {
  member: AuthSession;
  organizer: AuthSession;
};

type SeededParticipantInfoScenario = {
  memberContext: AuthSession["context"];
  memberUserId: string;
  organizerContext: AuthSession["context"];
  tripId: string;
};

let authPool: AuthPool | null = null;

async function seedParticipantInfoScenario(): Promise<SeededParticipantInfoScenario> {
  if (!authPool) {
    throw new Error("Expected shared auth pool to be initialized.");
  }

  const adminClient = createAdminClient();
  const organizerAuth = authPool.organizer;
  const memberAuth = authPool.member;
  const createdTrip = await createTestTrip(organizerAuth.user.id);
  const tripId = createdTrip.trip.id;

  await addParticipant(tripId, memberAuth.user.id, "member");
  await updateParticipant(adminClient, tripId, memberAuth.user.id, {
    arrival_location: "JFK Airport",
    arrival_time: "2026-05-01T09:30:00.000Z",
    departure_location: "LAX Airport",
    departure_time: "2026-05-05T20:15:00.000Z",
    nickname: "MJ",
  });

  return {
    memberContext: memberAuth.context,
    memberUserId: memberAuth.user.id,
    organizerContext: organizerAuth.context,
    tripId,
  };
}

async function cleanupScenario(scenario: SeededParticipantInfoScenario | null) {
  if (!scenario) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient.from("trips").delete().eq("id", scenario.tripId);
}

async function openTripPage(page: Page, tripId: string) {
  await page.goto(`/trip/${tripId}`);
  await expect(page.getByRole("button", { name: "Edit my info" })).toBeVisible();
}

async function saveParticipantEdits(page: Page, values: {
  arrivalLocation: string;
  arrivalTime: string;
  departureLocation: string;
  departureTime: string;
  nickname: string;
}) {
  await page.getByRole("button", { name: "Edit my info" }).click();
  await expect(page.getByRole("heading", { name: "Edit your trip details" })).toBeVisible();
  await page.getByLabel("What should people call you on this trip?").fill(values.nickname);
  await page.getByLabel("Arrival date and time").fill(values.arrivalTime);
  await page.getByLabel("Arrival location").fill(values.arrivalLocation);
  await page.getByLabel("Departure date and time").fill(values.departureTime);
  await page.getByLabel("Departure location").fill(values.departureLocation);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Edit your trip details" })).toHaveCount(0);
}

test.beforeAll(async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const organizer = await createAuthenticatedContext(browser, { baseURL });
  const member = await createAuthenticatedContext(browser, { baseURL });

  await markProfileReady(adminClient, organizer.user.id, "Olivia Organizer");
  await markProfileReady(adminClient, member.user.id, "Maya Member");

  authPool = {
    member,
    organizer,
  };
});

test.afterAll(async () => {
  if (!authPool) {
    return;
  }

  const adminClient = createAdminClient();

  try {
    await authPool.organizer.context.close();
    await authPool.member.context.close();
  } finally {
    await deleteUser(adminClient, authPool.member.user.id);
    await deleteUser(adminClient, authPool.organizer.user.id);
    authPool = null;
  }
});

test('Participant can click "Edit my info" on the trip page', async () => {
  let scenario: SeededParticipantInfoScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantInfoScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await page.getByRole("button", { name: "Edit my info" }).click();
    await expect(page.getByRole("heading", { name: "Edit your trip details" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("NicknameModal opens pre-filled with their current nickname and arrival/departure info", async () => {
  let scenario: SeededParticipantInfoScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantInfoScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await page.getByRole("button", { name: "Edit my info" }).click();

    await expect(page.getByLabel("What should people call you on this trip?")).toHaveValue("MJ");
    await expect(page.getByLabel("Arrival date and time")).toHaveValue(
      formatTimestampForInput("2026-05-01T09:30:00.000Z"),
    );
    await expect(page.getByLabel("Arrival location")).toHaveValue("JFK Airport");
    await expect(page.getByLabel("Departure date and time")).toHaveValue(
      formatTimestampForInput("2026-05-05T20:15:00.000Z"),
    );
    await expect(page.getByLabel("Departure location")).toHaveValue("LAX Airport");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Saving updates their info (verify the participants row shows new nickname)", async () => {
  const adminClient = createAdminClient();
  let scenario: SeededParticipantInfoScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantInfoScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await saveParticipantEdits(page, {
      arrivalLocation: "Boston Logan",
      arrivalTime: "2026-05-02T10:45",
      departureLocation: "San Diego Airport",
      departureTime: "2026-05-06T18:20",
      nickname: "Snack Captain",
    });

    await expect(page.getByText("Snack Captain")).toBeVisible();

    const { data: updatedParticipant } = await adminClient
      .from("trip_participants")
      .select("nickname")
      .eq("trip_id", scenario.tripId)
      .eq("user_id", scenario.memberUserId)
      .single();

    expect(updatedParticipant?.nickname).toBe("Snack Captain");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Changes are reflected in the participants page as well", async () => {
  let scenario: SeededParticipantInfoScenario | null = null;
  let page: Page | null = null;

  try {
    scenario = await seedParticipantInfoScenario();
    page = await scenario.memberContext.newPage();

    await openTripPage(page, scenario.tripId);
    await saveParticipantEdits(page, {
      arrivalLocation: "Heathrow",
      arrivalTime: "2026-05-03T08:15",
      departureLocation: "Gatwick",
      departureTime: "2026-05-07T21:40",
      nickname: "Road Runner",
    });

    await page.goto(`/trip/${scenario.tripId}/participants`);
    await expect(page.getByText("Road Runner")).toBeVisible();
    await expect(
      page.getByText(formatTravelMomentFromLocalInput("Arriving", "2026-05-03T08:15", "Heathrow")),
    ).toBeVisible();
    await expect(
      page.getByText(formatTravelMomentFromLocalInput("Leaving", "2026-05-07T21:40", "Gatwick")),
    ).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});
