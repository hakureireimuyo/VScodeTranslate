// models.ts
export interface TranslationData {
  hash: string;
  original_text: string;
  translated_text: string;
  create_time: number;
  last_access_time: number;
  access_count: number;
}

export interface DataStats {
  totalRecords: number;
  totalAccessCount: number;
  oldestRecordTime: number;
  databaseSize: number;
}