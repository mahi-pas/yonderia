import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockSupabaseClient } from "../helpers/supabase-mock";

const {
  createAdminClientMock,
  createClientMock,
  getInviteCodeLookupMock,
  getParticipantMembershipMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  getInviteCodeLookupMock: vi.fn(),
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
  getInviteCodeLookup: getInviteCodeLookupMock,
  getParticipantMembership: getParticipantMembershipMock,
}));

import { POST } from "@/app/api/invite/validate/route";

function createRequest(body: { code?: string; tripId?: string }): Request {
  return new Request("http://localhost:3000/api/invite/validate", {
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

function getTripParticipantsBuilder(adminClient: MockSupabaseClient) {
  const tripParticipantsCallIndex = adminClient.from.mock.calls.findIndex(
    ([tableName]) => tableName === "trip_participants",
  );

  if (tripParticipantsCallIndex === -1) {
    return null;
  }

  return adminClient.from.mock.results[tripParticipantsCallIndex]?.value ?? null;
}

describe("POST /api/invite/validate", () => {
  let adminClient: MockSupabaseClient;
  let serverClient: MockSupabaseClient;

  beforeEach(() => {
    adminClient = createSupabaseMock();
    serverClient = createSupabaseMock();
    createAdminClientMock.mockReturnValue(adminClient.toClient());
    createClientMock.mockResolvedValue(serverClient.toClient());
  });

  it("POST with valid join code adds user as member, returns success", async () => {
    const user = createUser();
    serverClient.setAuthUser(user);
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "join",
      tripId: "trip-123",
    });
    getParticipantMembershipMock.mockResolvedValue(null);
    adminClient.queueQuery("trips", "select", {
      data: {
        default_planner_permission: false,
        id: "trip-123",
      },
    });
    adminClient.queueQuery("trip_participants", "insert", {
      data: {
        id: "participant-123",
      },
    });

    const response = await POST(createRequest({ code: "join-code", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      alreadyParticipant: false,
      participantId: "participant-123",
      redirectTo: "/trip/trip-123",
      success: true,
      tripId: "trip-123",
    });

    const builder = getTripParticipantsBuilder(adminClient);
    expect(builder?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "member",
        trip_id: "trip-123",
        user_id: user.id,
      }),
    );
  });

  it("POST with valid join_planner code adds user as planner, returns success", async () => {
    const user = createUser();
    serverClient.setAuthUser(user);
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "join_planner",
      tripId: "trip-123",
    });
    getParticipantMembershipMock.mockResolvedValue(null);
    adminClient.queueQuery("trips", "select", {
      data: {
        default_planner_permission: false,
        id: "trip-123",
      },
    });
    adminClient.queueQuery("trip_participants", "insert", {
      data: {
        id: "participant-456",
      },
    });

    const response = await POST(createRequest({ code: "planner-code", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      alreadyParticipant: false,
      participantId: "participant-456",
      redirectTo: "/trip/trip-123",
      success: true,
      tripId: "trip-123",
    });

    const builder = getTripParticipantsBuilder(adminClient);
    expect(builder?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "planner",
        trip_id: "trip-123",
        user_id: user.id,
      }),
    );
  });

  it("POST with view code returns 400 (view codes can't be used to join)", async () => {
    serverClient.setAuthUser(createUser());
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "view",
      tripId: "trip-123",
    });

    const response = await POST(createRequest({ code: "view-code", tripId: "trip-123" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "That invite code is view-only. Use a join invite instead.",
    });
    expect(getTripParticipantsBuilder(adminClient)).toBeNull();
  });

  it("POST with inactive code returns 403", async () => {
    serverClient.setAuthUser(createUser());
    getInviteCodeLookupMock.mockResolvedValue(null);

    const response = await POST(createRequest({ code: "inactive-code", tripId: "trip-123" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "That invite code is invalid or no longer active.",
    });
  });

  it("POST with code belonging to different trip returns 403", async () => {
    serverClient.setAuthUser(createUser());
    getInviteCodeLookupMock.mockResolvedValue(null);

    const response = await POST(createRequest({ code: "other-trip-code", tripId: "trip-123" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "That invite code is invalid or no longer active.",
    });
  });

  it("POST when user is already a participant returns 200 with redirect (idempotent)", async () => {
    const user = createUser();
    serverClient.setAuthUser(user);
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "join",
      tripId: "trip-123",
    });
    getParticipantMembershipMock.mockResolvedValue({
      id: "participant-existing",
      role: "member",
      trip_id: "trip-123",
      user_id: user.id,
    });

    const response = await POST(createRequest({ code: "join-code", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      alreadyParticipant: true,
      participantId: "participant-existing",
      redirectTo: "/trip/trip-123",
      success: true,
      tripId: "trip-123",
    });
    expect(getTripParticipantsBuilder(adminClient)).toBeNull();
  });

  it("POST without authentication returns 401", async () => {
    serverClient.setAuthUser(null);

    const response = await POST(createRequest({ code: "join-code", tripId: "trip-123" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "You need to sign in before joining a trip.",
    });
    expect(getInviteCodeLookupMock).not.toHaveBeenCalled();
  });

  it("User gets planner role when trip.default_planner_permission is true, even with a 'join' code", async () => {
    const user = createUser();
    serverClient.setAuthUser(user);
    getInviteCodeLookupMock.mockResolvedValue({
      codeType: "join",
      tripId: "trip-123",
    });
    getParticipantMembershipMock.mockResolvedValue(null);
    adminClient.queueQuery("trips", "select", {
      data: {
        default_planner_permission: true,
        id: "trip-123",
      },
    });
    adminClient.queueQuery("trip_participants", "insert", {
      data: {
        id: "participant-planner",
      },
    });

    const response = await POST(createRequest({ code: "join-code", tripId: "trip-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      alreadyParticipant: false,
      participantId: "participant-planner",
      redirectTo: "/trip/trip-123",
      success: true,
      tripId: "trip-123",
    });

    const builder = getTripParticipantsBuilder(adminClient);
    expect(builder?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "planner",
        trip_id: "trip-123",
        user_id: user.id,
      }),
    );
  });
});
