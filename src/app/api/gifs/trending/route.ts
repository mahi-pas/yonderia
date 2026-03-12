import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GIPHY_TRENDING = "https://api.giphy.com/v1/gifs/trending";

export type GifSearchItem = {
  id: string;
  url: string;
  fullUrl: string;
  width: number;
  height: number;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GIF search is not configured." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = 20;
  const offset = Math.max(0, parseInt(searchParams.get("pos") ?? "0", 10) || 0);

  const params = new URLSearchParams({
    api_key: key,
    limit: String(limit),
    offset: String(offset),
    rating: "g",
  });

  const url = `${GIPHY_TRENDING}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    return NextResponse.json(
      { error: "Trending GIFs failed." },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      images?: {
        fixed_height_small?: { url: string; width: string; height: string };
        original?: { url: string; width: string; height: string };
      };
    }>;
    pagination?: { offset: number; count: number; total_count: number };
  };

  const results: GifSearchItem[] = [];
  const pagination = data.pagination ?? { offset: 0, count: 0, total_count: 0 };
  const nextOffset = pagination.offset + pagination.count;
  const next =
    nextOffset < pagination.total_count ? String(nextOffset) : undefined;

  for (const r of data.data ?? []) {
    const small = r.images?.fixed_height_small;
    const original = r.images?.original;
    if (!small?.url || !original?.url) continue;
    results.push({
      id: r.id,
      url: small.url,
      fullUrl: original.url,
      width: parseInt(small.width, 10) || 0,
      height: parseInt(small.height, 10) || 0,
    });
  }

  return NextResponse.json({ next, results });
}
