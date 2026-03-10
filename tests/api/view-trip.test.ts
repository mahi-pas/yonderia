import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { TripPageData } from "@/lib/trips";

const { createAdminClientMock, getInviteCodeLookupMock, getTripPageDataMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  getInviteCodeLookupMock: vi.fn(),
  getTripPageDataMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/trips", () => ({
  getInviteCodeLookup: getInviteCodeLookupMock,
  getTripPageData: getTripPageDataMock,
}));

import { GET } from "@/app/api/trip/[tripId]/view/route";

function createRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
  } as NextRequest;
}

function createTripPayload(): TripPageData {
  return {
    itineraryItems: [
      {
        day_date: "2026-09-05",
        description: "Lunch by the water.",
        destination_latitude: null,
        destination_longitude: null,
        destination_name: null,
        end_time: null,
        id: "item-1",
        image_url: null,
        item_type: "event",
        latitude: 38.7223,
        location_name: "Lisbon waterfront",
        longitude: -9.1393,
        sort_order: 0,
        start_time: null,
        title: "Waterfront lunch",
      },
    ],
    participants: [
      {
        avatarUrl: "https://example.com/avery.png",
        name: "Avery Planner",
        profilePath: null,
        role: "planner",
      },
      {
        avatarUrl: null,
        name: "Jordan Member",
        profilePath: null,
        role: "member",
      },
    ],
    trip: {
      description: "A sunny weekend away.",
      end_date: "2026-09-08",
      id: "trip-123",
      image_url: "https://example.com/trip.jpg",
      location_name: "Lisbon, Portugal",
      name: "Lisbon Escape",
      start_date: "2026-09-04",
    },
  };
}

describe("GET /api/trip/[tripId]/view", () => {
  beforeEach(() => {
    createAdminClientMock.mockReturnValue({ client: "admin" });
  });

  it("returns trip data for a valid view code", async () => {
    const tripPayload = createTripPayload();
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "view",
      tripId: "trip-123",
    });
    getTripPageDataMock.mockResolvedValue(tripPayload);

    const response = await GET(createRequest("http://localhost:3000/api/trip/trip-123/view?code=view-ok"), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(tripPayload);
    expect(getInviteCodeLookupMock).toHaveBeenCalledWith({ client: "admin" }, "trip-123", "view-ok");
    expect(getTripPageDataMock).toHaveBeenCalledWith({ client: "admin" }, "trip-123", {
      includeProfilePaths: false,
    });
  });

  it("returns 403 for an invalid code", async () => {
    getInviteCodeLookupMock.mockResolvedValue(null);

    const response = await GET(createRequest("http://localhost:3000/api/trip/trip-123/view?code=bad-code"), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid invite code.",
    });
  });

  it("returns 403 for a revoked code", async () => {
    getInviteCodeLookupMock.mockResolvedValue(null);

    const response = await GET(
      createRequest("http://localhost:3000/api/trip/trip-123/view?code=revoked-code"),
      {
        params: Promise.resolve({ tripId: "trip-123" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid invite code.",
    });
  });

  it("returns 403 when a join code is used as a view code", async () => {
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "join",
      tripId: "trip-123",
    });

    const response = await GET(
      createRequest("http://localhost:3000/api/trip/trip-123/view?code=join-code"),
      {
        params: Promise.resolve({ tripId: "trip-123" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid invite code.",
    });
  });

  it("does not include participant arrival or departure details", async () => {
    const tripPayload = createTripPayload();
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "view",
      tripId: "trip-123",
    });
    getTripPageDataMock.mockResolvedValue(tripPayload);

    const response = await GET(createRequest("http://localhost:3000/api/trip/trip-123/view?code=view-ok"), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });
    const json = await response.json();

    expect(json.participants[0]).not.toHaveProperty("arrival_time");
    expect(json.participants[0]).not.toHaveProperty("departure_time");
    expect(json.participants[0]).not.toHaveProperty("arrival_location");
    expect(json.participants[0]).not.toHaveProperty("departure_location");
  });

  it("includes participant names and avatars", async () => {
    const tripPayload = createTripPayload();
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "view",
      tripId: "trip-123",
    });
    getTripPageDataMock.mockResolvedValue(tripPayload);

    const response = await GET(createRequest("http://localhost:3000/api/trip/trip-123/view?code=view-ok"), {
      params: Promise.resolve({ tripId: "trip-123" }),
    });
    const json = await response.json();

    expect(json.participants).toEqual([
      expect.objectContaining({
        avatarUrl: "https://example.com/avery.png",
        name: "Avery Planner",
      }),
      expect.objectContaining({
        avatarUrl: null,
        name: "Jordan Member",
      }),
    ]);
  });
});
