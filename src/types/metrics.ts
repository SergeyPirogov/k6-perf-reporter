export interface HttpReqsMetric {
  total: number;
  rate: number;
}

export interface VusMetric {
  current: number;
  min: number;
  max: number;
}

export interface VusMaxMetric {
  min: number;
  max: number;
}

export interface IterationsMetric {
  total: number;
  rate: number;
}

export interface DurationMetric {
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

export interface ChecksMetric {
  passes: number;
  fails: number;
  passRate: number;
}

export interface HttpReqFailedMetric {
  total: number;
  failed: number;
  failureRate: number;
}

export interface HttpReqDurationMetric {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
}

export interface HttpReqDurationSuccessMetric {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
}

export interface IterationDurationMetric {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
}

export interface ErrorResponsesMetric {
  count: number;
  rate: number;
}

export interface RpsMetric {
  avg: number;
  p95: number;
  max: number;
}

export interface ErrorRequestMetric {
  method: string;
  url: string;
  status: number;
  count: number;
  min: number;
  avg: number;
  p95: number;
}

export interface ErrorRequestsMetric {
  errors: ErrorRequestMetric[];
}

export interface RequestMetric {
  method: string;
  url: string;
  status: number;
  count: number;
  rps: RpsMetric;
  min: number;
  avg: number;
  p95: number;
}

export interface RequestsMetric {
  requests: RequestMetric[];
}

export interface ErrorResponseMetric {
  url: string;
  method: string;
  status: number;
  error: string;
  count: number;
}

export interface ErrorResponsesTextMetric {
  responses: ErrorResponseMetric[];
}

export interface RpsAggregatedMetric {
  dataPoints: Array<{
    timestamp: string;
    rps: number;
  }>;
  avg: number;
  p95: number;
  max: number;
}

export interface HttpReqsRow {
  _value: number;
  _time: string;
  url: string;
  method: string;
  status: number;
}

export interface HttpReqDurationRow {
  _value: number;
  url: string;
  method: string;
  status: number;
}

export interface ReporterResponse {
  runId: string;
  startTime: string;
  endTime: string;
  timestamp: string;
  data: unknown;
}
