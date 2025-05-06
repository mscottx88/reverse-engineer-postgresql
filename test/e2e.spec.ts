import * as express from 'express';
import HttpStatus from 'http-status-codes';
import * as supertest from 'supertest';
import * as src from '../src';
import * as fixtures from './fixtures';

describe('e2e', () => {
  let app: express.Application;
  let reportId: number;

  beforeAll(async () => {
    await src.setupTestSchema();
    await src.cloneInputSchema();
    app = await src.app();
  });

  test('post', async () => {
    const { body } = await supertest(app)
      .post(`${src.BASE_URL}${src.API_PATH}`)
      .send(fixtures.testReport)
      .set('accept', 'application/json')
      .expect(HttpStatus.CREATED);

    reportId = body.data.id;
  });

  test('get', async () => {
    const { body } = await supertest(app)
      .get(`${src.BASE_URL}${src.API_PATH}/${reportId}`)
      .set('accept', 'application/json')
      .expect(HttpStatus.OK);

    expect(body.data.rows[0].id).toEqual(reportId);
  });

  afterAll(async () => {
    await src.dropTestSchema();
  });
});
