export interface ImageSearchResult {
  title: string;
  imageUrl: string;
  sourceUrl: string;
}

export async function searchImages(query: string): Promise<ImageSearchResult[]> {
  void query;
  return [];
}
