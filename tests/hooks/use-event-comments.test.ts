import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../helpers/supabase-mock";
import { useEventComments } from "@/hooks/useEventComments";

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

const commentRow = (
  id: string,
  userId: string,
  content: string | null,
  gifUrl: string | null,
  createdAt: string,
) => ({
  id,
  trip_id: "trip-1",
  itinerary_item_id: "item-1",
  user_id: userId,
  content,
  gif_url: gifUrl,
  is_announcement: false,
  created_at: createdAt,
  updated_at: createdAt,
});

describe("useEventComments", () => {
  it("returns comments sorted by created_at ascending", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_comments", "select", {
      data: [
        commentRow("c1", "u1", "First", null, "2026-01-01T10:00:00Z"),
        commentRow("c2", "u2", "Second", null, "2026-01-01T11:00:00Z"),
        commentRow("c3", "u1", "Third", null, "2026-01-01T12:00:00Z"),
      ],
      error: null,
    });
    mock.queueQuery("trip_participants", "select", {
      data: [
        { user_id: "u1", nickname: "Alice" },
        { user_id: "u2", nickname: "Bob" },
      ],
      error: null,
    });
    mock.queueQuery("profiles", "select", {
      data: [
        { id: "u1", display_name: "Alice Doe", avatar_url: "https://a.com/1.jpg" },
        { id: "u2", display_name: "Bob Smith", avatar_url: null },
      ],
      error: null,
    });

    const { result } = renderHook(() =>
      useEventComments({
        itineraryItemId: "item-1",
        tripId: "trip-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.comments.length).toBe(3);
    });

    expect(result.current.comments[0].content).toBe("First");
    expect(result.current.comments[1].content).toBe("Second");
    expect(result.current.comments[2].content).toBe("Third");
    expect(result.current.comments[0].created_at).toBe("2026-01-01T10:00:00Z");
  });

  it("joins user profile info (avatar, nickname) with each comment", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_comments", "select", {
      data: [commentRow("c1", "u1", "Hi", null, "2026-01-01T10:00:00Z")],
      error: null,
    });
    mock.queueQuery("trip_participants", "select", {
      data: [{ user_id: "u1", nickname: "Trip Nickname" }],
      error: null,
    });
    mock.queueQuery("profiles", "select", {
      data: [
        {
          id: "u1",
          display_name: "Display Name",
          avatar_url: "https://example.com/avatar.jpg",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() =>
      useEventComments({
        itineraryItemId: "item-1",
        tripId: "trip-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.comments.length).toBe(1);
    });

    expect(result.current.comments[0].author).toEqual({
      display_name: "Display Name",
      avatar_url: "https://example.com/avatar.jpg",
      nickname: "Trip Nickname",
    });
  });

  it("addComment creates a new comment and updates the list", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);
    mock.setAuthUser({ id: "current-user" } as never);

    mock.queueQuery("event_comments", "select", { data: [], error: null });
    mock.queueQuery("trip_participants", "select", {
      data: [{ user_id: "current-user", nickname: "Me" }],
      error: null,
    });
    mock.queueQuery("event_comments", "insert", {
      data: commentRow(
        "new-id",
        "current-user",
        "New comment",
        null,
        "2026-01-02T10:00:00Z",
      ),
      error: null,
    });
    mock.queueQuery("event_comments", "select", {
      data: [
        commentRow(
          "new-id",
          "current-user",
          "New comment",
          null,
          "2026-01-02T10:00:00Z",
        ),
      ],
      error: null,
    });
    mock.queueQuery("trip_participants", "select", {
      data: [{ user_id: "current-user", nickname: "Me" }],
      error: null,
    });
    mock.queueQuery("profiles", "select", {
      data: [
        {
          id: "current-user",
          display_name: "Me",
          avatar_url: null,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() =>
      useEventComments({
        itineraryItemId: "item-1",
        tripId: "trip-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.comments.length).toBe(0);
    });

    await act(async () => {
      await result.current.addComment("New comment", null);
    });

    await waitFor(() => {
      expect(result.current.comments.some((c) => c.content === "New comment")).toBe(true);
    });

    const history = mock.getHistory();
    const insertCalls = history.filter(
      (h) => h.table === "event_comments" && h.action === "insert",
    );
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("deleteComment removes the comment from the list", async () => {
    const createClient = await getCreateClientMock();
    const { client, mock } = createMockClientWithChannel();
    createClient.mockReturnValue(client);

    mock.queueQuery("event_comments", "select", {
      data: [
        commentRow("c1", "u1", "To delete", null, "2026-01-01T10:00:00Z"),
      ],
      error: null,
    });
    mock.queueQuery("trip_participants", "select", {
      data: [{ user_id: "u1", nickname: "User" }],
      error: null,
    });
    mock.queueQuery("profiles", "select", {
      data: [{ id: "u1", display_name: "User", avatar_url: null }],
      error: null,
    });
    mock.queueQuery("event_comments", "delete", { error: null });

    const { result } = renderHook(() =>
      useEventComments({
        itineraryItemId: "item-1",
        tripId: "trip-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.comments.length).toBe(1);
    });

    await act(async () => {
      await result.current.deleteComment("c1");
    });

    expect(result.current.comments.length).toBe(0);

    const history = mock.getHistory();
    const deleteCalls = history.filter(
      (h) => h.table === "event_comments" && h.action === "delete",
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });
});
