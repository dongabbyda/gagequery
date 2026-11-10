// Runs every PostgreSQL snippet on the "In other databases" cards in a real PostgreSQL (PGlite, in-process).
// Used by tests/test_content.py; prints a JSON list of problems (empty when all snippets run).
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const content = JSON.parse(readFileSync(new URL('../build/content.json', import.meta.url), 'utf8'));
const problems = [];
let checked = 0;
for (const m of content.modules) {
  for (const d of m.dialects || []) {
    const db = new PGlite();
    try {
      if (d.pg_setup) await db.exec(d.pg_setup);
      await db.exec(d.postgres);
      checked++;
    } catch (e) {
      problems.push(`${m.id} "${d.topic}": ${e.message}`);
    } finally {
      await db.close();
    }
  }
}
console.log(JSON.stringify({ checked, problems }));
