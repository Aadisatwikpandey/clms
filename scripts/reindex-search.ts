// Backfills the Elasticsearch catalogue index from Postgres. Needed any time the
// ES index is empty/recreated (e.g. after a version upgrade) or after a bulk
// import predates indexing being wired into that code path.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureIndices, indexCatalogueItem } from "../lib/search/elasticsearch";

const conn = postgres(process.env.DATABASE_URL!);
const db = drizzle(conn, { schema });

async function main() {
  await ensureIndices();

  const items = await db.select().from(schema.catalogueItems).where(eq(schema.catalogueItems.isActive, true));
  console.log(`Indexing ${items.length} catalogue items...`);

  let done = 0;
  for (const item of items) {
    await indexCatalogueItem(item);
    done++;
    if (done % 200 === 0) process.stdout.write(`\r   ${done}/${items.length}...`);
  }

  console.log(`\n✅ Indexed ${done} items.`);
  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
