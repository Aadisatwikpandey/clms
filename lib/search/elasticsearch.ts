import { Client } from "@elastic/elasticsearch";

const globalForEs = globalThis as unknown as { esClient: Client };

export const esClient =
  globalForEs.esClient ??
  new Client({
    node: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME ?? "elastic",
      password: process.env.ELASTICSEARCH_PASSWORD ?? "elastic_password",
    },
  });

if (process.env.NODE_ENV !== "production") globalForEs.esClient = esClient;

export const CATALOGUE_INDEX = "clms_catalogue";
export const MEMBERS_INDEX = "clms_members";

export async function ensureIndices() {
  const catalogueExists = await esClient.indices.exists({ index: CATALOGUE_INDEX });
  if (!catalogueExists) {
    await esClient.indices.create({
      index: CATALOGUE_INDEX,
      mappings: {
        properties: {
          id: { type: "integer" },
          accessionNo: { type: "keyword" },
          title: { type: "text", analyzer: "standard", fields: { keyword: { type: "keyword" } } },
          subtitle: { type: "text" },
          authors: { type: "text" },
          publisher: { type: "text" },
          subjects: { type: "text" },
          keywords: { type: "text" },
          isbn: { type: "keyword" },
          deweyNo: { type: "keyword" },
          materialType: { type: "keyword" },
          language: { type: "keyword" },
          publicationYear: { type: "integer" },
          availableCopies: { type: "integer" },
          totalCopies: { type: "integer" },
          location: { type: "keyword" },
          abstract: { type: "text" },
          coverImageUrl: { type: "keyword", index: false },
          callNumber: { type: "keyword" },
          isActive: { type: "boolean" },
          createdAt: { type: "date" },
        },
      },
    });
  }
}

export async function indexCatalogueItem(item: Record<string, unknown>) {
  await esClient.index({
    index: CATALOGUE_INDEX,
    id: String(item.id),
    document: item,
  });
}

export async function searchCatalogue(query: string, filters: {
  materialType?: string;
  language?: string;
  available?: boolean;
  from?: number;
  size?: number;
}) {
  const { from = 0, size = 20, ...rest } = filters;

  const mustClauses = query
    ? [{ multi_match: { query, fields: ["title^3", "authors^2", "subjects^2", "keywords^2", "publisher", "abstract", "isbn", "accessionNo"] as string[], fuzziness: "AUTO" } }]
    : [{ match_all: {} as Record<string, never> }];

  const filterClauses: Record<string, unknown>[] = [{ term: { isActive: true } }];
  if (rest.materialType) filterClauses.push({ term: { materialType: rest.materialType } });
  if (rest.language) filterClauses.push({ term: { language: rest.language } });
  if (rest.available) filterClauses.push({ range: { availableCopies: { gt: 0 } } });

  const result = await esClient.search({
    index: CATALOGUE_INDEX,
    from,
    size,
    query: { bool: { must: mustClauses as any, filter: filterClauses as any } },
    highlight: { fields: { title: {}, authors: {}, subjects: {} } },
    aggregations: {
      materialType: { terms: { field: "materialType", size: 10 } },
      language: { terms: { field: "language", size: 10 } },
      subjects: { terms: { field: "subjects.keyword", size: 20 } },
    },
  });

  return result;
}

export async function deleteCatalogueItem(id: number) {
  await esClient.delete({ index: CATALOGUE_INDEX, id: String(id) });
}
