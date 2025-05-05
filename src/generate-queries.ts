/**
 * This script can be executed to convert the programmatically generated queries into static
 * queries, and store them in a file for use.
 *
 * You can execute this script from the command line:
 *
 * ```sh
 * npm run generate-queries
 * ```
 *
 * Or interactively with the VS Code debugger using the Launch File w/ ts-node configuration.
 * Set this file as the focus in VS Code and press F5.
 */

import * as fs from 'fs/promises';
import * as queries from './queries';
import * as utils from './utils';

if (require.main === module)
  (async () => {
    const path = `${__dirname}/queries.sql`;
    try {
      await fs.truncate(path);
    } catch {}
    const statements: string[] = [];
    for (const x of Object.values(queries))
      if (typeof x === 'function') statements.push(x(utils.sql`:I${process.env.INPUT_SCHEMA}`));
    await fs.appendFile(path, `${statements.join(';\n\n')};\n`);
  })().catch((err: any) => {
    console.error(err);
    process.exit(1);
  });
