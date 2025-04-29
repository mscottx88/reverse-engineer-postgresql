import fs from 'fs/promises';
import url from 'url';
import * as Queries from './queries.js';
import sql from './utils.js';

const dirname = url.fileURLToPath(new url.URL('.', import.meta.url));

if (import.meta.url === url.pathToFileURL(process.argv[1]).href)
  (async () => {
    const path = `${dirname}/queries.sql`;
    try {
      await fs.truncate(path);
    } catch {}
    const statements: string[] = [];
    for (const x of Object.values(Queries))
      if (typeof x === 'function') statements.push(x(sql`:I${process.env.INPUT_SCHEMA}`));
    await fs.appendFile(path, `${statements.join(';\n\n')};\n`);
  })().catch((err: any) => {
    console.error(err);
    process.exit(1);
  });
