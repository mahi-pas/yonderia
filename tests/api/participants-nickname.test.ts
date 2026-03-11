import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockSupabaseClient } from "../helpers/supabase-mock";

const {
  createAdminClientMock,
  createClientMock,
  getParticipantMembershipMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  getParticipantMembershipMock: vi.fn(),
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
}));

import { POST } from "@/app/api/participants/nickname/route";

function createRequest(body: { nickname?: string; participantId?: string; tripId?: string }): Request {
  return new Request("http://localhost:3000/api/participants/nickname", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

function createUser(userId = "user-123"): User {
  return {
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-03-10T00:00:00.000Z",
    email: `${userId}@example.com`,
    id: userId,
    user_metadata: {},
  } as User;
}

function getUpdateCallCount(adminClient: MockSupabaseClient): number {
  return adminClient.getHistory().filter((entry) => entry.table === "trip_participants" && entry.action === "update")
    .length;
}

describe("POST /api/participants/nickname", () => {
  let adminClient: MockSupabaseClient;
  let serverClient: MockSupabaseClient;

  beforeEach(() => {
    adminClient = createSupabaseMock();
    serverClient = createSupabaseMock();
    createAdminClientMock.mockReturnValue(adminClient.toClient());
    createClientMock.mockResolvedValue(serverClient.toClient());
  });

  it("Organizer can change any participant's nickname -> returns success", async () => {
    const user = createUser("organizer-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "organizer",
      trip_id: "trip-123",
      user_id: user.id,
    });
    adminClient.queueQuery("trip_participants", "select", {
      data: {
        id: "participant-456",
        nickname: "Maya Member",
        role: "member",
        trip_id: "trip-123",
        user_id: "member-456",
      },
    });
    adminClient.queueQuery("trip_participants", "update", {
      data: null,
    });

    const response = await POST(
      createRequest({ nickname: "Road Runner", participantId: "participant-456", tripId: "trip-123" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      previousNickname: "Maya Member",
      success: true,
      updatedNickname: "Road Runner",
    });
    expect(getUpdateCallCount(adminClient)).toBe(1);
  });

  it("Organizer cannot change their own nickname via this endpoint -> returns 403", async () => {
    const user = createUser("organizer-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "organizer",
      trip_id: "trip-123",
      user_id: user.id,
    });
    adminClient.queueQuery("trip_participants", "select", {
      data: {
        id: "participant-123",
        nickname: "Olivia Organizer",
        role: "organizer",
        trip_id: "trip-123",
        user_id: user.id,
      },
    });

    const response = await POST(
      createRequest({ nickname: "Captain Olivia", participantId: "participant-123", tripId: "trip-123" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "The organizer can't change their own nickname here.",
    });
    expect(getUpdateCallCount(adminClient)).toBe(0);
  });

  it("Planner cannot change anyone's nickname -> returns 403", async () => {
    const user = createUser("planner-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "planner",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await POST(
      createRequest({ nickname: "Road Runner", participantId: "participant-456", tripId: "trip-123" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the organizer can change participant nicknames.",
    });
    expect(getUpdateCallCount(adminClient)).toBe(0);
  });

  it("Member cannot change anyone's nickname -> returns 403", async () => {
    const user = createUser("member-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "member",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await POST(
      createRequest({ nickname: "Road Runner", participantId: "participant-456", tripId: "trip-123" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the organizer can change participant nicknames.",
    });
    expect(getUpdateCallCount(adminClient)).toBe(0);
  });

  it("Non-participant cannot change nicknames -> returns 403", async () => {
    const user = createUser("visitor-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue(null);

    const response = await POST(
      createRequest({ nickname: "Road Runner", participantId: "participant-456", tripId: "trip-123" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the organizer can change participant nicknames.",
    });
    expect(getUpdateCallCount(adminClient)).toBe(0);
  });

  it("Empty nickname is rejected -> returns 400", async () => {
    const response = await POST(
      createRequest({ nickname: "   ", participantId: "participant-456", tripId: "trip-123" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Nickname cannot be empty.",
    });
  });
});
