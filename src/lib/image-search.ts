export interface ImageSearchResult {
  title: string;
  imageUrl: string;
  sourceUrl: string;
}

type GoogleCustomSearchResponse = {
  items?: {
    image?: {
      contextLink?: string;
    };
    link?: string;
    title?: string;
  }[];
};

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function searchImages(query: string): Promise<ImageSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const apiKey = getRequiredEnv("GOOGLE_CUSTOM_SEARCH_API_KEY", process.env.GOOGLE_CUSTOM_SEARCH_API_KEY);
  const cx = getRequiredEnv("GOOGLE_CUSTOM_SEARCH_CX", process.env.GOOGLE_CUSTOM_SEARCH_CX);
  const url = new URL("https://www.googleapis.com/customsearch/v1");

  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "3");
  url.searchParams.set("safe", "active");
  url.searchParams.set("fields", "items(title,link,image/contextLink)");

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google image search request failed.");
  }

  const data = (await response.json()) as GoogleCustomSearchResponse;

  return (data.items ?? [])
    .map((item) => ({
      imageUrl: item.link?.trim() ?? "",
      sourceUrl: item.image?.contextLink?.trim() ?? "",
      title: item.title?.trim() ?? "Suggested image",
    }))
    .filter((item) => item.imageUrl.length > 0);
}
