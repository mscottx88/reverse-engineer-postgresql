/**
 * This script can be executed to initialize the source database.
 *
 * You can execute this script from the command line:
 *
 * ```sh
 * npm run init
 * ```
 *
 * Or interactively with the VS Code debugger using the Launch File w/ ts-node configuration.
 * Set this file as the focus in VS Code and press F5.
 */

import * as db from './db';

if (require.main === module)
  (async () => await db.initSourceSchema())().catch((err: any) => {
    console.error(err);
    process.exit(1);
  });
