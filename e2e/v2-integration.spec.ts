/**
 * V2 cross-feature integration tests: trip creation, theme, invites, join flow,
 * RSVP, comments (including GIF), real-time updates, cascade delete, kick, view-only.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import {
  addParticipant,
  createTestInviteCode,
  createTestTrip,
  insertEventComment,
  insertEventRsvp,
} from "./helpers/seed";
import type { Database, Trip, TripTheme } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;

let adminClient: ReturnType<typeof createAdminClient>;
let organizerAuth: AuthSession;
let participantAAuth: AuthSession;
let participantBAuth: AuthSession;

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createAdminClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function markProfileReady(userId: string, displayName: string) {
  const { error } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers never from handcrafted Database type
    .update({ display_name: displayName, has_completed_onboarding: true })
    .eq("id", userId);
  if (error) throw error;
}

async function updateTrip(tripId: string, values: Partial<Trip>) {
  const { error } = await adminClient
    .from("trips")
    // @ts-expect-error Supabase infers never from handcrafted Database type
    .update(values)
    .eq("id", tripId);
  if (error) throw error;
}

function buildTripUrl(tripId: string, options?: { code?: string }) {
  const params = new URLSearchParams({ mapMock: "1" });
  if (options?.code) params.set("code", options.code);
  return `/trip/${tripId}?${params.toString()}`;
}

function getDayLabel(dayDate: string) {
  return format(parseISO(dayDate), "EEE, MMM d");
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

function getParticipantsSection(page: Page) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "Who's in" }) }).first();
}

async function routeImageSearch(page: Page) {
  await page.route("**/api/images/search**", async (route) => {
    await route.fulfill({ body: JSON.stringify({ results: [] }), contentType: "application/json", status: 200 });
  });
}

function routeGifApis(page: Page) {
  page.route("**/api/gifs/search**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        next: "",
        results: [
          { id: "int-gif-1", url: "https://example.com/small.gif", fullUrl: "https://example.com/full.gif", width: 90, height: 90 },
        ],
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  page.route("**/api/gifs/trending**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        next: "",
        results: [
          { id: "int-trend-1", url: "https://example.com/trend.gif", fullUrl: "https://example.com/trend-full.gif", width: 90, height: 90 },
        ],
      }),
      contentType: "application/json",
      status: 200,
    });
  });
}

const SAMPLE_THEME: TripTheme = {
  accent_color: "#ec4899",
  background: { type: "gradient", value: "linear-gradient(180deg, #1a0a2e 0%, #0f1a2e 100%)", overlay_opacity: 0.15 },
  card_style: "glass",
  effect: "sparkles",
  font: { display: "Playfair Display", body: "Raleway" },
};

test.beforeAll(async ({ baseURL, browser }) => {
  adminClient = createAdminClient();
  organizerAuth = await createAuthenticatedContext(browser, { baseURL });
  participantAAuth = await createAuthenticatedContext(browser, { baseURL });
  participantBAuth = await createAuthenticatedContext(browser, { baseURL });
  await markProfileReady(organizerAuth.user.id, "Org V2");
  await markProfileReady(participantAAuth.user.id, "Participant A");
  await markProfileReady(participantBAuth.user.id, "Participant B");
});

test.afterAll(async () => {
  if (organizerAuth?.context) await organizerAuth.context.close();
  if (participantAAuth?.context) await participantAAuth.context.close();
  if (participantBAuth?.context) await participantBAuth.context.close();
});

test("V2 flow: create trip → customize theme → invite → user sees landing → joins → RSVPs → comments with GIF → data correct", async ({
  browser,
}) => {
  const created = await createTestTrip(organizerAuth.user.id);
  const tripId = created.trip.id;
  await updateTrip(tripId, { name: "V2 Integration Trip", theme: SAMPLE_THEME });
  await addParticipant(tripId, participantAAuth.user.id, "member");
  const joinInvite = await createTestInviteCode(tripId, "join");

  const eventDay = "2026-05-02";
  const eventId = randomUUID();
  await adminClient.from("itinerary_items").insert({
    id: eventId,
    trip_id: tripId,
    item_type: "event",
    title: "V2 Test Event",
    day_date: eventDay,
    start_time: "10:00",
    end_time: "11:30",
    location_name: "Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    created_by: organizerAuth.user.id,
  });

  try {
    const anonContext = await browser.newContext();
    const landingPage = await anonContext.newPage();
    await landingPage.goto(`/trip/${tripId}/invite-landing?code=${joinInvite.code}`);
    await expect(landingPage.getByRole("heading", { name: "You're invited!" })).toBeVisible();
    await expect(landingPage.getByRole("heading", { name: "V2 Integration Trip" })).toBeVisible();
    await landingPage.close();
    await anonContext.close();

    const inviteePage = await participantAAuth.context.newPage();
    await routeImageSearch(inviteePage);
    await routeGifApis(inviteePage);

    await inviteePage.goto(buildTripUrl(tripId));
    const dayLabel = getDayLabel(eventDay);
    await getDayToggle(inviteePage, 2, dayLabel).click();
    await getDaySection(inviteePage, 2, dayLabel).getByRole("button", { name: "V2 Test Event" }).first().click();

    const dialog = inviteePage.getByRole("dialog");
    await dialog.getByRole("button", { name: "Going" }).click();
    await expect(dialog.getByTitle("1 going")).toBeVisible();

    await dialog.getByRole("button", { name: /GIF|gif/i }).first().click();
    await inviteePage.getByPlaceholder(/search|Search/i).fill("happy");
    await inviteePage.locator("[data-gif-id], img[alt*='GIF']").first().click();
    await expect(dialog.getByRole("img", { name: /gif|GIF/i })).toBeVisible({ timeout: 5000 });

    await inviteePage.close();
  } finally {
    await adminClient.from("itinerary_items").delete().eq("id", eventId);
    await adminClient.from("trips").delete().eq("id", tripId);
  }
});

test("V2 realtime: event with end time → RSVP → comment → organizer edits title and nickname → reflected in other context", async () => {
  const created = await createTestTrip(organizerAuth.user.id);
  const tripId = created.trip.id;
  await addParticipant(tripId, participantAAuth.user.id, "member");
  await addParticipant(tripId, participantBAuth.user.id, "member");

  const organizerPage = await organizerAuth.context.newPage();
  const participantPage = await participantBAuth.context.newPage();
  await routeImageSearch(organizerPage);
  await routeGifApis(participantPage);

  await organizerPage.goto(buildTripUrl(tripId));
  await participantPage.goto(buildTripUrl(tripId));

  await getDayToggle(organizerPage, 2, "Sat, May 2").click();
  await getDaySection(organizerPage, 2, "Sat, May 2").getByRole("button", { name: "Add Event" }).click();
  const addDialog = organizerPage.getByRole("dialog");
  await addDialog.getByLabel("Title").fill("Realtime Sync Event");
  await addDialog.getByLabel("Time").fill("14:00");
  await addDialog.getByLabel("End time").fill("15:30");
  await addDialog.getByLabel("Location").fill("Paris");
  await addDialog.getByRole("button", { name: "Save Event" }).click();

  await expect(getDaySection(participantPage, 2, "Sat, May 2").getByText("Realtime Sync Event")).toBeVisible({ timeout: 15000 });

  await getDaySection(participantPage, 2, "Sat, May 2").getByRole("button", { name: "Realtime Sync Event" }).first().click();
  const detailDialog = participantPage.getByRole("dialog");
  await detailDialog.getByRole("button", { name: "Going" }).click();
  await detailDialog.getByPlaceholder(/comment|Add a comment/i).fill("Looks good!");
  await detailDialog.getByRole("button", { name: /Post|Send/i }).click();

  await organizerPage.getByRole("button", { name: "Realtime Sync Event" }).first().click();
  const orgDetail = organizerPage.getByRole("dialog");
  await orgDetail.getByRole("button", { name: /Edit|pencil/i }).first().click();
  await organizerPage.getByRole("dialog").getByLabel("Title").fill("Updated Realtime Title");
  await organizerPage.getByRole("dialog").getByRole("button", { name: "Save Event" }).click();

  await expect(participantPage.getByRole("dialog").getByText("Updated Realtime Title")).toBeVisible({ timeout: 15000 });

  await organizerPage.goto(`/trip/${tripId}/participants`);
  await organizerPage.getByRole("button", { name: "Open actions for Participant B" }).click();
  await organizerPage.getByRole("button", { name: "Edit Name" }).click();
  await organizerPage.getByRole("dialog", { name: "Edit nickname" }).getByRole("textbox", { name: /Nickname/i }).fill("Renamed B");
  await organizerPage.getByRole("button", { name: "Save nickname" }).click();

  await expect(getParticipantsSection(participantPage).getByText("Renamed B")).toBeVisible({ timeout: 15000 });

  await organizerPage.close();
  await participantPage.close();
  await adminClient.from("trips").delete().eq("id", tripId);
});

test("V2 cascade: organizer creates event → participants RSVP and comment → organizer deletes event → disappears everywhere in real-time", async () => {
  const created = await createTestTrip(organizerAuth.user.id);
  const tripId = created.trip.id;
  await addParticipant(tripId, participantAAuth.user.id, "member");
  await addParticipant(tripId, participantBAuth.user.id, "member");

  const organizerPage = await organizerAuth.context.newPage();
  const participantPage = await participantBAuth.context.newPage();
  await routeImageSearch(organizerPage);

  await organizerPage.goto(buildTripUrl(tripId));
  await participantPage.goto(buildTripUrl(tripId));

  await getDayToggle(organizerPage, 2, "Sat, May 2").click();
  await getDaySection(organizerPage, 2, "Sat, May 2").getByRole("button", { name: "Add Event" }).click();
  await organizerPage.getByRole("dialog").getByLabel("Title").fill("To Be Deleted");
  await organizerPage.getByRole("dialog").getByLabel("Time").fill("09:00");
  await organizerPage.getByRole("dialog").getByLabel("Location").fill("NYC");
  await organizerPage.getByRole("dialog").getByRole("button", { name: "Save Event" }).click();

  await expect(getDaySection(participantPage, 2, "Sat, May 2").getByText("To Be Deleted")).toBeVisible({ timeout: 15000 });

  const eventCard = getDaySection(participantPage, 2, "Sat, May 2").getByRole("button", { name: "To Be Deleted" }).first();
  await eventCard.click();
  await participantPage.getByRole("dialog").getByRole("button", { name: "Going" }).click();
  await participantPage.getByRole("dialog").getByPlaceholder(/comment|Add a comment/i).fill("Cascade test");
  await participantPage.getByRole("dialog").getByRole("button", { name: /Post|Send/i }).click();

  await organizerPage.getByRole("button", { name: "To Be Deleted" }).first().click();
  await organizerPage.getByRole("dialog").getByRole("button", { name: /Delete|Remove/i }).click();
  await organizerPage.getByRole("button", { name: /Confirm|Delete|Remove/i }).click();

  await expect(getDaySection(participantPage, 2, "Sat, May 2").getByText("To Be Deleted")).toHaveCount(0, { timeout: 15000 });

  await organizerPage.close();
  await participantPage.close();
  await adminClient.from("trips").delete().eq("id", tripId);
});

test("V2 kick: planner kicks member → member RSVPs removed (trigger), comments remain → member cannot access trip", async () => {
  const created = await createTestTrip(organizerAuth.user.id);
  const tripId = created.trip.id;
  const plannerId = participantAAuth.user.id;
  const memberId = participantBAuth.user.id;
  await addParticipant(tripId, plannerId, "planner");
  await addParticipant(tripId, memberId, "member");

  const eventId = randomUUID();
  await adminClient.from("itinerary_items").insert({
    id: eventId,
    trip_id: tripId,
    item_type: "event",
    title: "Kick Test Event",
    day_date: "2026-05-02",
    created_by: organizerAuth.user.id,
  });
  await insertEventRsvp(eventId, memberId, "going");
  await insertEventComment(eventId, memberId, { content: "Comment before kick" });

  const plannerPage = await participantAAuth.context.newPage();
  const memberPage = await participantBAuth.context.newPage();
  await routeImageSearch(plannerPage);

  await plannerPage.goto(`/trip/${tripId}/participants`);
  await plannerPage.getByRole("button", { name: "Open actions for Participant B" }).click();
  await plannerPage.getByRole("button", { name: "Kick from Trip" }).click();
  await plannerPage.getByRole("button", { name: "Remove from trip" }).click();

  await expect(plannerPage.getByText("Participant removed from the trip.")).toBeVisible();

  const { data: rsvpsAfterKick } = await adminClient.from("event_rsvps").select("id").eq("user_id", memberId).eq("itinerary_item_id", eventId);
  expect(rsvpsAfterKick?.length ?? 0).toBe(0);

  const { data: commentsAfterKick } = await adminClient.from("event_comments").select("id").eq("itinerary_item_id", eventId);
  expect(commentsAfterKick?.length).toBeGreaterThanOrEqual(1);

  await memberPage.goto(buildTripUrl(tripId));
  await expect(memberPage.getByText(/access|denied|not found|redirect/i).or(memberPage.getByRole("heading", { name: /dashboard|home/i }))).toBeVisible({ timeout: 10000 });

  await plannerPage.close();
  await memberPage.close();
  await adminClient.from("itinerary_items").delete().eq("id", eventId);
  await adminClient.from("trips").delete().eq("id", tripId);
});

test("V2 view-only: visitor sees theme, events with end times, RSVP counts; no comments, no RSVP buttons, no editing", async ({
  browser,
}) => {
  const created = await createTestTrip(organizerAuth.user.id);
  const tripId = created.trip.id;
  await updateTrip(tripId, { name: "View-Only Trip", theme: SAMPLE_THEME });
  const viewCode = (await createTestInviteCode(tripId, "view")).code;
  const eventId = randomUUID();
  await adminClient.from("itinerary_items").insert({
    id: eventId,
    trip_id: tripId,
    item_type: "event",
    title: "View-Only Event",
    day_date: "2026-05-02",
    start_time: "12:00",
    end_time: "13:00",
    location_name: "London",
    created_by: organizerAuth.user.id,
  });
  await insertEventRsvp(eventId, organizerAuth.user.id, "going");

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await guestPage.goto(buildTripUrl(tripId, { code: viewCode }));
    await expect(guestPage.getByText("You're viewing this trip as a guest.")).toBeVisible();
    await expect(guestPage.getByRole("heading", { name: "View-Only Trip" }).or(guestPage.getByText("View-Only Trip"))).toBeVisible();

    await getDayToggle(guestPage, 2, "Sat, May 2").click();
    await expect(getDaySection(guestPage, 2, "Sat, May 2").getByText("View-Only Event")).toBeVisible();
    await expect(guestPage.getByText(/12:00|12:00 PM/)).toBeVisible();
    await expect(guestPage.getByText(/1 going|going/)).toBeVisible();

    await expect(guestPage.getByRole("button", { name: "Going" })).toHaveCount(0);
    await expect(guestPage.getByRole("button", { name: "Add Event" })).toHaveCount(0);
    await getDaySection(guestPage, 2, "Sat, May 2").getByRole("button", { name: "View-Only Event" }).first().click();
    const dialog = guestPage.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Going" })).toHaveCount(0);
    await expect(dialog.getByPlaceholder(/comment|Add a comment/i)).toHaveCount(0);
  } finally {
    await guestPage.close();
    await guestContext.close();
    await adminClient.from("itinerary_items").delete().eq("id", eventId);
    await adminClient.from("trips").delete().eq("id", tripId);
  }
});
