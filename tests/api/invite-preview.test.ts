import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { InvitePreview } from "@/lib/trips";

const { createAdminClientMock, getInvitePreviewMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  getInvitePreviewMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/trips", () => ({
  getInvitePreview: getInvitePreviewMock,
}));

import { GET } from "@/app/api/invite/preview/route";

function createRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
  } as NextRequest;
}

function createInvitePreview(codeType: "join" | "view"): InvitePreview {
  return {
    codeType,
    organizer: {
      avatarUrl: "https://example.com/organizer.png",
      displayName: "Morgan Organizer",
    },
    trip: {
      end_date: "2026-03-18",
      image_url: "https://example.com/trip.jpg",
      location_name: "Lisbon, Portugal",
      name: "Spring in Lisbon",
      start_date: "2026-03-14",
    },
    tripId: "trip-123",
  };
}

describe("GET /api/invite/preview", () => {
  beforeEach(() => {
    createAdminClientMock.mockReturnValue({ client: "admin" });
  });

  it("returns trip and organizer preview data for a valid join code", async () => {
    getInvitePreviewMock.mockResolvedValue(createInvitePreview("join"));

    const response = await GET(
      createRequest("http://localhost:3000/api/invite/preview?code=valid-join-code"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      code_type: "join",
      organizer: {
        avatar_url: "https://example.com/organizer.png",
        display_name: "Morgan Organizer",
      },
      trip: {
        end_date: "2026-03-18",
        image_url: "https://example.com/trip.jpg",
        location_name: "Lisbon, Portugal",
        name: "Spring in Lisbon",
        start_date: "2026-03-14",
      },
    });
    expect(getInvitePreviewMock).toHaveBeenCalledWith({ client: "admin" }, "valid-join-code");
  });

  it("returns trip info with code_type='view' for a valid view code", async () => {
    getInvitePreviewMock.mockResolvedValue(createInvitePreview("view"));

    const response = await GET(
      createRequest("http://localhost:3000/api/invite/preview?code=valid-view-code"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code_type: "view",
      }),
    );
  });

  it("returns 404 for an invalid code", async () => {
    getInvitePreviewMock.mockResolvedValue(null);

    const response = await GET(createRequest("http://localhost:3000/api/invite/preview?code=invalid-code"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Invite not found.",
    });
  });

  it("returns 404 for a revoked code", async () => {
    getInvitePreviewMock.mockResolvedValue(null);

    const response = await GET(createRequest("http://localhost:3000/api/invite/preview?code=revoked-code"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Invite not found.",
    });
  });

  it("does not include participant list, itinerary, or description", async () => {
    getInvitePreviewMock.mockResolvedValue(createInvitePreview("join"));

    const response = await GET(
      createRequest("http://localhost:3000/api/invite/preview?code=valid-join-code"),
    );
    const json = await response.json();

    expect(json).not.toHaveProperty("participants");
    expect(json).not.toHaveProperty("itinerary");
    expect(json).not.toHaveProperty("participant_list");
    expect(json.trip).not.toHaveProperty("description");
  });

  it("includes the organizer display_name and avatar_url", async () => {
    getInvitePreviewMock.mockResolvedValue(createInvitePreview("join"));

    const response = await GET(
      createRequest("http://localhost:3000/api/invite/preview?code=valid-join-code"),
    );
    const json = await response.json();

    expect(json.organizer).toEqual({
      avatar_url: "https://example.com/organizer.png",
      display_name: "Morgan Organizer",
    });
  });
});
