import fs from 'fs/promises';
import pg from 'pg';
import url from 'url';
import * as Queries from './queries.js';
import sql from './utils.js';

const dirname = url.fileURLToPath(new url.URL('.', import.meta.url));

if (import.meta.url === url.pathToFileURL(process.argv[1]).href)
  (async () => {
    const pool: pg.Pool = new pg.Pool({ allowExitOnIdle: true, max: 100 });

    const queries = [
      Queries.listFunctions,
      Queries.listEnums,
      Queries.listTableSequences,
      Queries.listTables,
      Queries.listTablePartitions,
      Queries.listTableIndexes,
      Queries.listTableConstraints,
      Queries.listTriggers,
      Queries.listViews,
    ];

    const path: string = `${dirname}/reversed.sql`;
    try {
      await fs.truncate(path);
    } catch {}

    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const statements: string[] = [
        sql`DROP SCHEMA IF EXISTS :I${process.env.OUTPUT_SCHEMA} CASCADE`,
        sql`CREATE SCHEMA :I${process.env.OUTPUT_SCHEMA}`,
        'SET check_function_bodies = FALSE',
        'SET search_path = reversed',
      ];
      for (const query of queries) {
        const { rows } = await client.query<{ statement: string }>(
          query(process.env.INPUT_SCHEMA!),
        );
        for (const { statement } of rows)
          statements.push(
            statement
              .replaceAll(sql`:I${process.env.INPUT_SCHEMA}`, sql`:I${process.env.OUTPUT_SCHEMA}`)
              .replaceAll('\t', '  '),
          );
      }
      await fs.appendFile(path, `${statements.join(';\n\n')};\n`);
      await client.query(await fs.readFile(path, 'utf-8'));
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })().catch((err: any) => {
    console.error(err);
    process.exit(1);
  });
