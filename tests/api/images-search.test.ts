import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { createClientMock, searchImagesMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  searchImagesMock: vi.fn(),
}));

vi.mock("@/lib/image-search", () => ({
  searchImages: searchImagesMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET } from "@/app/api/images/search/route";

function createRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
  } as NextRequest;
}

function createAuthClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId ? { id: userId } : null,
        },
      })),
    },
  };
}

describe("GET /api/images/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/images/search?q=eiffel+tower returns image URLs", async () => {
    const results = [
      {
        imageUrl: "https://example.com/eiffel-1.jpg",
        photographerName: "Annie Spratt",
        photographerUrl: "https://unsplash.com/@anniespratt?utm_source=yonderia&utm_medium=referral",
        sourceUrl: "https://unsplash.com/photos/abc123?utm_source=yonderia&utm_medium=referral",
        title: "Eiffel Tower at sunset",
      },
      {
        imageUrl: "https://example.com/eiffel-2.jpg",
        photographerName: "John Doe",
        photographerUrl: "https://unsplash.com/@johndoe?utm_source=yonderia&utm_medium=referral",
        sourceUrl: "https://unsplash.com/photos/def456?utm_source=yonderia&utm_medium=referral",
        title: "Picnic by the Eiffel Tower",
      },
    ];

    createClientMock.mockResolvedValue(createAuthClient("user-123"));
    searchImagesMock.mockResolvedValue(results);

    const response = await GET(createRequest("http://localhost:3000/api/images/search?q=eiffel+tower"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results });
    expect(searchImagesMock).toHaveBeenCalledWith("eiffel tower");
  });

  it("GET /api/images/search without auth returns 401", async () => {
    createClientMock.mockResolvedValue(createAuthClient(null));

    const response = await GET(createRequest("http://localhost:3000/api/images/search?q=eiffel+tower"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
    });
  });

  it("GET /api/images/search without ?q= returns 400", async () => {
    createClientMock.mockResolvedValue(createAuthClient("user-123"));

    const response = await GET(createRequest("http://localhost:3000/api/images/search"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing search query.",
    });
  });
});
