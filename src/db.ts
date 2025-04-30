import * as fs from 'fs/promises';
import * as pg from 'pg';
import * as Queries from './queries';
import * as utils from './utils';

export const pool: pg.Pool = new pg.Pool({ allowExitOnIdle: true, max: 100 });

export async function cloneInputSchema(): Promise<void> {
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

  const path: string = `${__dirname}/output.sql`;
  try {
    await fs.truncate(path);
  } catch {}

  const client: pg.PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const statements: string[] = [
      'SET check_function_bodies = FALSE',
      utils.sql`SET search_path = :I${process.env.OUTPUT_SCHEMA}`,
    ];
    for (const query of queries) {
      const { rows } = await client.query<{ statement: string }>(query(process.env.INPUT_SCHEMA!));
      for (const { statement } of rows)
        statements.push(
          statement
            .replaceAll(utils.sql`:I${process.env.INPUT_SCHEMA}`, utils.sql`:I${process.env.OUTPUT_SCHEMA}`)
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
}

export async function setupTestSchema(): Promise<void> {
  await pool.query('CREATE SEQUENCE IF NOT EXISTS public.test_schema');
  const { rows } = await pool.query<{ nextval: string }>(
    `SELECT nextval('public.test_schema'::regclass)::text`,
  );
  const [{ nextval = '1' }] = rows;
  const testSchema: string = `test_${nextval.padStart(10, '0')}`;

  await pool.query(utils.sql`CREATE SCHEMA :I${testSchema}`);
  process.env.OUTPUT_SCHEMA = testSchema;
}

export async function teardownTestSchema(): Promise<void> {
  await pool.query(utils.sql`DROP SCHEMA :I${process.env.OUTPUT_SCHEMA} CASCADE`);
}
