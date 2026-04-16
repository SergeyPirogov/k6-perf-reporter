import {
  HttpReqsRow,
  HttpReqDurationRow,
  DurationMetric,
  VusMetric,
  VusMaxMetric,
  IterationsMetric,
  ChecksMetric,
  IterationDurationMetric,
  ErrorResponsesTextMetric,
} from "../types";

export interface DataSource {
  fetchHttpReqsData(runId: string, startTime: string, endTime: string): Promise<HttpReqsRow[]>;
  fetchHttpReqDurationData(runId: string, startTime: string, endTime: string): Promise<HttpReqDurationRow[]>;
  calculateTestDuration(runId: string, startTime: string, endTime: string): Promise<DurationMetric>;
  extractVus(runId: string, startTime: string, endTime: string): Promise<VusMetric>;
  extractVusMax(runId: string, startTime: string, endTime: string): Promise<VusMaxMetric>;
  extractIterations(runId: string, startTime: string, endTime: string): Promise<IterationsMetric>;
  extractChecks(runId: string, startTime: string, endTime: string): Promise<ChecksMetric>;
  extractIterationDuration(runId: string, startTime: string, endTime: string): Promise<IterationDurationMetric>;
  extractErrorResponsesText(runId: string, startTime: string, endTime: string): Promise<ErrorResponsesTextMetric>;
}
