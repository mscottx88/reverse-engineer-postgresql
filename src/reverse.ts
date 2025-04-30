import * as db from './db';

if (require.main === module)
  (async () => await db.cloneInputSchema())().catch((err: any) => {
    console.error(err);
    process.exit(1);
  });
