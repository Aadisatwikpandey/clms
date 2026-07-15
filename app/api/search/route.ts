import { NextRequest, NextResponse } from "next/server";
import { searchCatalogue, ensureIndices } from "@/lib/search/elasticsearch";
import { getCached } from "@/lib/redis";

export async function GET(req: NextRequest) {
  await ensureIndices();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? undefined;
  const lang = searchParams.get("lang") ?? undefined;
  const available = searchParams.get("available") === "true";
  const from = parseInt(searchParams.get("from") ?? "0");
  const size = Math.min(parseInt(searchParams.get("size") ?? "20"), 100);

  const cacheKey = `search:${q}:${type}:${lang}:${available}:${from}:${size}`;

  const result = await getCached(cacheKey, 60, () =>
    searchCatalogue(q, { materialType: type, language: lang, available, from, size })
  );

  const hits = (result.hits.hits as any[]).map((h) => ({
    ...h._source,
    highlight: h.highlight,
    score: h._score,
  }));

  return NextResponse.json({
    hits,
    total: typeof result.hits.total === "object" ? result.hits.total.value : result.hits.total,
    aggregations: result.aggregations,
  });
}
