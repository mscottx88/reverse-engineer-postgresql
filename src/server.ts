/**
 * This simple express server simulates a typical bare-bones CRUD API with POST/GET.
 * More verbs could be added and supported, but the idea is to exercise the database and prove that
 * a row can be added and retrieved in an end-to-end test.
 */

import * as db from './db';
import * as express from 'express';
import HttpStatus from 'http-status-codes';
import type * as types from './types';
import * as utils from './utils';

export const API_PATH = '/report';
export const BASE_URL = '/api/v1';

const router = express.Router();

/**
 * Handle a request to create an entity.
 */
router.post(
  API_PATH,
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> => {
    const { body }: express.Request = req;
    const { owner, date, data, type }: types.Report = body;
    try {
      const { rows } = await db.pool.query(utils.sql`
        INSERT INTO reports
          (report_owner, report_date, report_data, report_parsed, report_type)
        VALUES
          (:${owner}, :${new Date(date)}, :${data}, :${JSON.parse(data)}, :${type})
        RETURNING *
      `);
      res.status(HttpStatus.CREATED).json({ data: rows[0] });
      next();
    } catch (err: any) {
      next(err);
    }
  },
);

/**
 * Handle a request to read an entity.
 */
router.get(
  `${API_PATH}/:id`,
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> => {
    const {
      params: { id },
    }: express.Request = req;
    try {
      const { rows } = await db.pool.query(utils.sql`
        SELECT *
        FROM reports
        WHERE id = :${id}
      `);
      res.status(HttpStatus.OK).json({ data: { rows } });
      next();
    } catch (err: any) {
      next(err);
    }
  },
);

/**
 * Create the express app.
 *
 * @returns express.Application
 */
export function app(): express.Application {
  return express()
    .use(express.json())
    .use(BASE_URL, [
      router,
      (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error(err);
        res
          .status(err?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR)
          .json({ message: err?.message });
      },
    ]);
}
