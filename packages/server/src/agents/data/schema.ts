export interface DataPoint {
  metric: string;
  value: string | number;
  source: string;
  confidence: number;
}

export interface DataOutput {
  summary: string;
  dataPoints: DataPoint[];
  dataGaps: string[];
  assumptions: string[];
  confidence: number;
}
