export enum ReportType {
  'classic' = 'classic',
  'manual' = 'manual',
}

export interface Report {
  owner: string;
  date: Date;
  data: string;
  type: ReportType;
}
