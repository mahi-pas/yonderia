import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../helpers/supabase-mock";
import { computeSummary, useEventRsvps } from "@/hooks/useEventRsvps";
import type { EventRsvp } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

async function getCreateClientMock() {
  const { createClient } = await import("@/lib/supabase/client");
  return vi.mocked(createClient);
}

function createMockClientWithChannel() {
  const mock = createSupabaseMock();
  const client = mock.toClient() as ReturnType<typeof mock.toClient> & {
    channel: ReturnType<typeof vi.fn>;
    removeChannel: ReturnType<typeof vi.fn>;
  };
  client.channel = vi.fn(() => ({
    on: vi.fn(() => ({ subscribe: vi.fn() })),
  }));
  client.removeChannel = vi.fn();
  return { client, mock };
}

describe("computeSummary", () => {
  it("returns correct counts for going/interested/not_going", () => {
    const rsvps: EventRsvp[] = [
      {
        id: "1",
        itinerary_item_id: "item-1",
        user_id: "user-a",
        status: "going",
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        itinerary_item_id: "item-1",
        user_id: "user-b",
        status: "going",
        created_at: "",
        updated_at: "",
      },
      {
        id: "3",
        itinerary_item_id: "item-1",
        user_id: "user-c",
        status: "interested",
        created_at: "",
        updated_at: "",
      },
      {
        id: "4",
        itinerary_item_id: "item-1",
        user_id: "user-d",
        status: "not_going",
        created_at: "",
        updated_at: "",
      },
    ];
    const summary = computeSummary(rsvps, null);
    expect(summary.going).toBe(2);
    expect(summary.interested).toBe(1);
    expect(summary.not_going).toBe(1);
    expect(summary.userStatus).toBeNull();
  });

  it("returns current user's status", () => {
    const rsvps: EventRsvp[] = [
      {
        id: "1",
        itinerary_item_id: "item-1",
        user_id: "user-a",
        status: "interested",
        created_at: "",
        updated_at: "",
      },
    ];
    const summary = computeSummary(rsvps, "user-a");
    expect(summary.userStatus).toBe("interested");
    expect(summary.going).toBe(0);
    expect(summary.interested).toBe(1);
  });

  it("handles the case where user has no RSVP (status = null)", () => {
    const rsvps: EventRsvp[] = [
      {
        id: "1",
        itinerary_item_id: "item-1",
        user_id: "other-user",
        status: "going",
        created_at: "",
        updated_at: "",
      },
    ];
    const summary = computeSummary(rsvps, "current-user");
    expect(summary.userStatus).toBeNull();
    expect(summary.going).toBe(1);
  });
});

describe("useEventRsvps", () => {
  it("hook returns correct counts for going/interested/not_going after fetch", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_rsvps", "select", {
      data: [
        {
          id: "r1",
          itinerary_item_id: "item-1",
          user_id: "u1",
          status: "going",
          created_at: "",
          updated_at: "",
        },
        {
          id: "r2",
          itinerary_item_id: "item-1",
          user_id: "u2",
          status: "interested",
          created_at: "",
          updated_at: "",
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () =>
        useEventRsvps({
          itineraryItemId: "item-1",
          currentUserId: "user-1",
        }),
    );

    await waitFor(() => {
      expect(result.current.summary.going).toBe(1);
      expect(result.current.summary.interested).toBe(1);
      expect(result.current.summary.not_going).toBe(0);
    });
  });

  it("hook returns current user's status", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_rsvps", "select", {
      data: [
        {
          id: "r1",
          itinerary_item_id: "item-1",
          user_id: "user-1",
          status: "going",
          created_at: "",
          updated_at: "",
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () =>
        useEventRsvps({
          itineraryItemId: "item-1",
          currentUserId: "user-1",
        }),
    );

    await waitFor(() => {
      expect(result.current.summary.userStatus).toBe("going");
    });
  });

  it("setRsvp('going') creates/updates the RSVP row", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_rsvps", "select", { data: [], error: null });
    mock.queueQuery("event_rsvps", "upsert", { error: null });

    const { result } = renderHook(
      () =>
        useEventRsvps({
          itineraryItemId: "item-1",
          currentUserId: "user-1",
        }),
    );

    await waitFor(() => {
      expect(result.current.summary.going).toBe(0);
    });

    await act(async () => {
      await result.current.setRsvp("going");
    });

    expect(result.current.summary.userStatus).toBe("going");
    expect(result.current.summary.going).toBe(1);
    const history = mock.getHistory();
    const upsertCalls = history.filter(
      (h) => h.table === "event_rsvps" && h.action === "upsert",
    );
    expect(upsertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("calling setRsvp with the same status deletes the RSVP (toggle off)", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_rsvps", "select", {
      data: [
        {
          id: "r1",
          itinerary_item_id: "item-1",
          user_id: "user-1",
          status: "going",
          created_at: "",
          updated_at: "",
        },
      ],
      error: null,
    });
    mock.queueQuery("event_rsvps", "delete", { error: null });

    const { result } = renderHook(
      () =>
        useEventRsvps({
          itineraryItemId: "item-1",
          currentUserId: "user-1",
        }),
    );

    await waitFor(() => {
      expect(result.current.summary.userStatus).toBe("going");
    });

    await act(async () => {
      await result.current.setRsvp(null);
    });

    expect(result.current.summary.userStatus).toBeNull();
    expect(result.current.summary.going).toBe(0);
    const history = mock.getHistory();
    const deleteCalls = history.filter(
      (h) => h.table === "event_rsvps" && h.action === "delete",
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("hook handles the case where user has no RSVP (status = null)", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_rsvps", "select", {
      data: [
        {
          id: "r1",
          itinerary_item_id: "item-1",
          user_id: "other-user",
          status: "going",
          created_at: "",
          updated_at: "",
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () =>
        useEventRsvps({
          itineraryItemId: "item-1",
          currentUserId: "user-1",
        }),
    );

    await waitFor(() => {
      expect(result.current.summary.going).toBe(1);
      expect(result.current.summary.userStatus).toBeNull();
    });
  });
});
