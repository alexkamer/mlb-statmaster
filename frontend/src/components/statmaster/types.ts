export interface StatmasterResponse {
  query: string;
  answerText: string;
  primaryImage?: string;
  secondaryImage?: string;
  primaryImageAlt?: string;
  subjectName?: string;
  subjectType?: 'player' | 'team';
  subjectId?: number;
  columns: string[];
  rows: any[][];
  rowLinks?: string[];
  relatedQueries?: string[];
  primaryColumnIndex?: number;
  heroStats?: { label: string; value: string }[];
  recentGames?: {
    columns: string[];
    rows: any[][];
    rowLinks?: string[];
  };
}
