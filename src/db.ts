import * as fs from 'fs/promises';
import * as pg from 'pg';
import * as Queries from './queries';
import * as utils from './utils';

export const pool: pg.Pool = new pg.Pool({ allowExitOnIdle: true, max: 100 });

/**
 * This function executes the queries located in ./src/queries.ts against the source schema
 * declared in the environment variable INPUT_SCHEMA. Those queries in turn produce DDL statements
 * that are executed against the target schema declared in the OUTPUT_SCHEMA environment variable.
 *
 * The outcome is the source schema is replicated in its object structure into the target schema,
 * thereby generating a pristine database for an end-to-end test.
 *
 * @returns Promise<void>
 */
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
            .replaceAll(
              utils.sql`:I${process.env.INPUT_SCHEMA}`,
              utils.sql`:I${process.env.OUTPUT_SCHEMA}`,
            )
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

/**
 * Drop the test schema.
 *
 * **WARNING**
 * The schema identified by the OUTPUT_SCHEMA environment variable is literally dropped.
 *
 * @returns Promise<void>
 */
export async function dropTestSchema(): Promise<void> {
  await pool.query(utils.sql`DROP SCHEMA :I${process.env.OUTPUT_SCHEMA} CASCADE`);
}

/**
 * Initialize the source schema.
 *
 * **WARNING**
 * The schema identified by the INPUT_SCHEMA environment variable is actually dropped and recreated.
 *
 * This function can be executed using the command `npm run init`.
 *
 * @returns Promise<void>
 */
export async function initSourceSchema(): Promise<void> {
  await pool.query(utils.sql`DROP SCHEMA IF EXISTS :I${process.env.INPUT_SCHEMA} CASCADE`);
  await pool.query(utils.sql`CREATE SCHEMA :I${process.env.INPUT_SCHEMA}`);
  const path = `${__dirname}/source.sql`;
  const statements: string = await fs.readFile(path, 'utf8');
  await pool.query(statements);
}

/**
 * Setup the source schema.
 *
 * This function can be executed using the command `npm run init`.
 *
 * @returns Promise<void>
 */
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
