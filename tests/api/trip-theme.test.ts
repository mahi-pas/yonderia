import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { TripPageData } from "@/lib/trips";
import type { TripTheme } from "@/lib/types";
import { createSupabaseMock, type MockSupabaseClient } from "../helpers/supabase-mock";

const {
  createAdminClientMock,
  createClientMock,
  getInviteCodeLookupMock,
  getParticipantMembershipMock,
  getTripPageDataMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  getInviteCodeLookupMock: vi.fn(),
  getParticipantMembershipMock: vi.fn(),
  getTripPageDataMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/trips", () => ({
  getParticipantMembership: getParticipantMembershipMock,
  getInviteCodeLookup: getInviteCodeLookupMock,
  getTripPageData: getTripPageDataMock,
}));

import { PATCH } from "@/app/api/trip/[tripId]/theme/route";
import { GET } from "@/app/api/trip/[tripId]/view/route";

function createUser(userId = "user-organizer"): User {
  return {
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-03-10T00:00:00.000Z",
    email: `${userId}@example.com`,
    id: userId,
    user_metadata: {},
  } as User;
}

function createThemePayload(overrides: Partial<TripTheme> = {}): TripTheme {
  return {
    accent_color: "#8b5cf6",
    background: {
      type: "gradient",
      value: "linear-gradient(180deg, #1a0a2e, #0f1a2e)",
      overlay_opacity: 0.2,
    },
    card_style: "glass",
    effect: "sparkles",
    font: { display: "Sora", body: "DM Sans" },
    ...overrides,
  };
}

function createViewRequest(tripId: string, code: string): NextRequest {
  return {
    nextUrl: new URL(`http://localhost:3000/api/trip/${tripId}/view?code=${code}`),
  } as NextRequest;
}

function createPatchRequest(tripId: string, body: { theme: TripTheme }): Request {
  return new Request(`http://localhost:3000/api/trip/${tripId}/theme`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/trip/[tripId]/theme", () => {
  let serverClient: MockSupabaseClient;

  beforeEach(() => {
    serverClient = createSupabaseMock();
    createClientMock.mockResolvedValue(serverClient.toClient());
  });

  it("organizer can update the theme column with valid JSON", async () => {
    const user = createUser("organizer-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "organizer",
      trip_id: "trip-123",
      user_id: user.id,
    });
    serverClient.queueQuery("trips", "update", { data: null });

    const theme = createThemePayload();
    const response = await PATCH(createPatchRequest("trip-123", { theme }), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    const history = serverClient.getHistory();
    const updateCall = history.find((e) => e.table === "trips" && e.action === "update");
    expect(updateCall).toBeDefined();
  });

  it("non-organizer cannot update the theme column → returns 403", async () => {
    const user = createUser("member-456");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-2",
      role: "member",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const theme = createThemePayload();
    const response = await PATCH(createPatchRequest("trip-123", { theme }), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the trip organizer can update the theme.",
    });
    const history = serverClient.getHistory();
    expect(history.some((e) => e.table === "trips" && e.action === "update")).toBe(false);
  });

  it("unauthenticated user cannot update theme → returns 401", async () => {
    serverClient.setAuthUser(null);
    getParticipantMembershipMock.mockResolvedValue(null);

    const response = await PATCH(createPatchRequest("trip-123", { theme: createThemePayload() }), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("invalid theme JSON structure is rejected", async () => {
    const user = createUser("organizer-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "organizer",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await PATCH(
      createPatchRequest("trip-123", {
        theme: { effect: "invalid_effect" } as unknown as TripTheme,
      }),
      { params: Promise.resolve({ tripId: "trip-123" }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/effect/);
    const history = serverClient.getHistory();
    expect(history.some((e) => e.table === "trips" && e.action === "update")).toBe(false);
  });

  it("invalid background type is rejected", async () => {
    const user = createUser("organizer-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "organizer",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await PATCH(
      createPatchRequest("trip-123", {
        theme: {
          background: { type: "invalid", value: "#000" },
        } as unknown as TripTheme,
      }),
      { params: Promise.resolve({ tripId: "trip-123" }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/background/);
  });

  it("non-JSON body returns 400", async () => {
    const user = createUser("organizer-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "organizer",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await PATCH(
      new Request("http://localhost:3000/api/trip/trip-123/theme", {
        method: "PATCH",
        body: "not json",
      }),
      { params: Promise.resolve({ tripId: "trip-123" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });
});

describe("GET /api/trip/[tripId]/view – theme data", () => {
  beforeEach(() => {
    createAdminClientMock.mockReturnValue(createSupabaseMock().toClient());
  });

  it("view endpoint includes the theme data", async () => {
    const theme: TripTheme = {
      accent_color: "#ec4899",
      effect: "aurora",
      font: { display: "Playfair Display", body: "Raleway" },
    };
    const tripPayload: TripPageData = {
      itineraryItems: [],
      participants: [],
      trip: {
        id: "trip-123",
        name: "Themed Trip",
        description: null,
        image_url: null,
        location_name: "Paris",
        start_date: "2026-06-01",
        end_date: "2026-06-05",
        theme,
      },
    };
    getInviteCodeLookupMock.mockResolvedValue({ codeType: "view", tripId: "trip-123" });
    getTripPageDataMock.mockResolvedValue(tripPayload);

    const response = await GET(createViewRequest("trip-123", "view-code"), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.trip).toBeDefined();
    expect(json.trip.theme).toEqual(theme);
    expect(json.trip.theme.effect).toBe("aurora");
    expect(json.trip.theme.font?.display).toBe("Playfair Display");
  });
});
