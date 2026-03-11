export interface ImageSearchResult {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  photographerName: string;
  photographerUrl: string;
}

type UnsplashSearchResponse = {
  results?: {
    alt_description?: string;
    links?: { html?: string };
    urls?: { regular?: string; small?: string };
    user?: { links?: { html?: string }; name?: string };
  }[];
};

export async function searchImages(query: string): Promise<ImageSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    throw new Error("Missing environment variable: UNSPLASH_ACCESS_KEY");
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", normalizedQuery);
  url.searchParams.set("per_page", "3");
  url.searchParams.set("content_filter", "high");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;

    try {
      const body = (await response.json()) as { errors?: string[] };
      if (body.errors?.[0]) {
        detail = body.errors[0];
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new Error(`Unsplash image search failed. ${detail}`);
  }

  const data = (await response.json()) as UnsplashSearchResponse;

  return (data.results ?? [])
    .map((item) => ({
      imageUrl: item.urls?.small ?? item.urls?.regular ?? "",
      photographerName: item.user?.name?.trim() ?? "Unknown",
      photographerUrl: item.user?.links?.html
        ? `${item.user.links.html}?utm_source=yonderia&utm_medium=referral`
        : "https://unsplash.com",
      sourceUrl: item.links?.html
        ? `${item.links.html}?utm_source=yonderia&utm_medium=referral`
        : "",
      title: item.alt_description?.trim() ?? "Suggested image",
    }))
    .filter((item) => item.imageUrl.length > 0);
}
