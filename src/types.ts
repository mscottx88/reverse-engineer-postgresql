export enum ReportType {
  'classic' = 'classic',
  'cron' = 'cron',
  'manual' = 'manual',
  'ad-hoc' = 'ad-hoc',
  'event' = 'event',
}

export interface Report {
  owner: string;
  date: Date;
  data: string;
  type: ReportType;
}
