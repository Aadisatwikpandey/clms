import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Library closes at 8 PM. Any visit still open past that point (today's or an
// earlier day's) is auto-closed so "currently inside" never shows stale entries.
export async function closeStaleVisits() {
  await db.execute(sql`
    UPDATE library_visits
    SET exit_time = date_trunc('day', entry_time) + interval '20 hours',
        duration_minutes = extract(epoch from (
          (date_trunc('day', entry_time) + interval '20 hours') - entry_time
        )) / 60,
        auto_closed = true
    WHERE exit_time IS NULL
      AND now() > date_trunc('day', entry_time) + interval '20 hours'
  `);
}
