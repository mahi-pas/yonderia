import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

function createRequest(url: string): Request {
  return new Request(url);
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

const giphySearchResponse = {
  data: [
    {
      id: "giphy-1",
      images: {
        fixed_height_small: {
          url: "https://example.com/tiny.gif",
          width: "100",
          height: "100",
        },
        original: {
          url: "https://example.com/full.gif",
          width: "200",
          height: "200",
        },
      },
    },
    {
      id: "giphy-2",
      images: {
        fixed_height_small: {
          url: "https://example.com/tiny2.gif",
          width: "80",
          height: "80",
        },
        original: {
          url: "https://example.com/full2.gif",
          width: "160",
          height: "160",
        },
      },
    },
  ],
  pagination: { offset: 0, count: 2, total_count: 50 },
};

const giphyTrendingResponse = {
  data: [
    {
      id: "trending-1",
      images: {
        fixed_height_small: {
          url: "https://example.com/trend-tiny.gif",
          width: "90",
          height: "90",
        },
        original: {
          url: "https://example.com/trend-full.gif",
          width: "180",
          height: "180",
        },
      },
    },
  ],
  pagination: { offset: 0, count: 1, total_count: 25 },
};

describe("GET /api/gifs/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GIPHY_API_KEY = "test-key";
  });

  it("GET /api/gifs/search?q=happy returns GIF results", async () => {
    const { GET } = await import("@/app/api/gifs/search/route");
    createClientMock.mockResolvedValue(createAuthClient("user-123"));

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(giphySearchResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const req = createRequest("http://localhost:3000/api/gifs/search?q=happy");
    const response = await GET(req as import("next/server").NextRequest);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual({
      id: "giphy-1",
      url: "https://example.com/tiny.gif",
      fullUrl: "https://example.com/full.gif",
      width: 100,
      height: 100,
    });
    expect(body.next).toBe("2");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("api.giphy.com/v1/gifs/search"),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]q=happy/),
    );
    fetchSpy.mockRestore();
  });

  it("GET /api/gifs/search without auth returns 401", async () => {
    const { GET } = await import("@/app/api/gifs/search/route");
    createClientMock.mockResolvedValue(createAuthClient(null));

    const req = createRequest("http://localhost:3000/api/gifs/search?q=happy");
    const response = await GET(req as import("next/server").NextRequest);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });

  it("GET /api/gifs/search without ?q= returns 400", async () => {
    const { GET } = await import("@/app/api/gifs/search/route");
    createClientMock.mockResolvedValue(createAuthClient("user-123"));

    const req = createRequest("http://localhost:3000/api/gifs/search");
    const response = await GET(req as import("next/server").NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing search query (q).",
    });
  });
});

describe("GET /api/gifs/trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GIPHY_API_KEY = "test-key";
  });

  it("GET /api/gifs/trending returns trending GIFs", async () => {
    const { GET } = await import("@/app/api/gifs/trending/route");
    createClientMock.mockResolvedValue(createAuthClient("user-123"));

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(giphyTrendingResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const req = createRequest("http://localhost:3000/api/gifs/trending");
    const response = await GET(req as import("next/server").NextRequest);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual({
      id: "trending-1",
      url: "https://example.com/trend-tiny.gif",
      fullUrl: "https://example.com/trend-full.gif",
      width: 90,
      height: 90,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("api.giphy.com/v1/gifs/trending"),
    );
    fetchSpy.mockRestore();
  });

  it("GET /api/gifs/trending without auth returns 401", async () => {
    const { GET } = await import("@/app/api/gifs/trending/route");
    createClientMock.mockResolvedValue(createAuthClient(null));

    const req = createRequest("http://localhost:3000/api/gifs/trending");
    const response = await GET(req as import("next/server").NextRequest);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
