import * as src from '../src';

export const testReport: src.Report = {
  owner: 'test user',
  date: new Date(),
  data: JSON.stringify({ rows: [{ col: 'some-data' }] }),
  type: src.ReportType.manual,
};
