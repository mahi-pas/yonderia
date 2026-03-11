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

import { POST } from "@/app/api/participants/kick/route";

function createRequest(body: { participantId?: string; tripId?: string }): Request {
  return new Request("http://localhost:3000/api/participants/kick", {
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

function getDeleteCallCount(adminClient: MockSupabaseClient): number {
  return adminClient.getHistory().filter((entry) => entry.table === "trip_participants" && entry.action === "delete")
    .length;
}

describe("POST /api/participants/kick v2", () => {
  let adminClient: MockSupabaseClient;
  let serverClient: MockSupabaseClient;

  beforeEach(() => {
    adminClient = createSupabaseMock();
    serverClient = createSupabaseMock();
    createAdminClientMock.mockReturnValue(adminClient.toClient());
    createClientMock.mockResolvedValue(serverClient.toClient());
  });

  it("Organizer kicks member -> success", async () => {
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
        id: "participant-member",
        role: "member",
        trip_id: "trip-123",
        user_id: "member-456",
      },
    });
    adminClient.queueQuery("trip_participants", "delete", {
      data: null,
    });

    const response = await POST(createRequest({ participantId: "participant-member", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getDeleteCallCount(adminClient)).toBe(1);
  });

  it("Organizer kicks planner -> success", async () => {
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
        id: "participant-planner",
        role: "planner",
        trip_id: "trip-123",
        user_id: "planner-456",
      },
    });
    adminClient.queueQuery("trip_participants", "delete", {
      data: null,
    });

    const response = await POST(createRequest({ participantId: "participant-planner", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getDeleteCallCount(adminClient)).toBe(1);
  });

  it("Organizer kicks self -> 403", async () => {
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
        id: "participant-organizer",
        role: "organizer",
        trip_id: "trip-123",
        user_id: user.id,
      },
    });

    const response = await POST(createRequest({ participantId: "participant-organizer", tripId: "trip-123" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You can't remove yourself from the trip.",
    });
    expect(getDeleteCallCount(adminClient)).toBe(0);
  });

  it("Planner kicks member -> success", async () => {
    const user = createUser("planner-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "planner",
      trip_id: "trip-123",
      user_id: user.id,
    });
    adminClient.queueQuery("trip_participants", "select", {
      data: {
        id: "participant-member",
        role: "member",
        trip_id: "trip-123",
        user_id: "member-456",
      },
    });
    adminClient.queueQuery("trip_participants", "delete", {
      data: null,
    });

    const response = await POST(createRequest({ participantId: "participant-member", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getDeleteCallCount(adminClient)).toBe(1);
  });

  it("Planner kicks another planner -> 403 with descriptive error", async () => {
    const user = createUser("planner-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "planner",
      trip_id: "trip-123",
      user_id: user.id,
    });
    adminClient.queueQuery("trip_participants", "select", {
      data: {
        id: "participant-planner",
        role: "planner",
        trip_id: "trip-123",
        user_id: "planner-456",
      },
    });

    const response = await POST(createRequest({ participantId: "participant-planner", tripId: "trip-123" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Planners can only remove members from the trip.",
    });
    expect(getDeleteCallCount(adminClient)).toBe(0);
  });

  it("Planner kicks organizer -> 403 with descriptive error", async () => {
    const user = createUser("planner-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "planner",
      trip_id: "trip-123",
      user_id: user.id,
    });
    adminClient.queueQuery("trip_participants", "select", {
      data: {
        id: "participant-organizer",
        role: "organizer",
        trip_id: "trip-123",
        user_id: "organizer-456",
      },
    });

    const response = await POST(createRequest({ participantId: "participant-organizer", tripId: "trip-123" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "The organizer can't be removed from the trip.",
    });
    expect(getDeleteCallCount(adminClient)).toBe(0);
  });

  it("Member kicks anyone -> 403", async () => {
    const user = createUser("member-123");
    serverClient.setAuthUser(user);
    getParticipantMembershipMock.mockResolvedValue({
      id: "membership-1",
      role: "member",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await POST(createRequest({ participantId: "participant-member", tripId: "trip-123" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only organizers and planners can remove participants.",
    });
    expect(getDeleteCallCount(adminClient)).toBe(0);
  });
});
