import {
  DurationMetric,
  VusMetric,
  VusMaxMetric,
  IterationsMetric,
  ChecksMetric,
  IterationDurationMetric,
  ErrorResponsesTextMetric,
  HttpReqsMetric,
  HttpReqFailedMetric,
  HttpReqDurationMetric,
  HttpReqDurationSuccessMetric,
  ErrorResponsesMetric,
  ErrorRequestsMetric,
  RequestsMetric,
  RpsAggregatedMetric,
} from "../types";

export interface DataSource {
  calculateTestDuration(runId: string, startTime: string, endTime: string): Promise<DurationMetric>;
  extractVus(runId: string, startTime: string, endTime: string): Promise<VusMetric>;
  extractVusMax(runId: string, startTime: string, endTime: string): Promise<VusMaxMetric>;
  extractIterations(runId: string, startTime: string, endTime: string): Promise<IterationsMetric>;
  extractChecks(runId: string, startTime: string, endTime: string): Promise<ChecksMetric>;
  extractIterationDuration(runId: string, startTime: string, endTime: string): Promise<IterationDurationMetric>;
  extractErrorResponsesText(runId: string, startTime: string, endTime: string): Promise<ErrorResponsesTextMetric>;
  extractHttpReqs(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<HttpReqsMetric>;
  extractHttpReqFailed(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<HttpReqFailedMetric>;
  extractHttpReqDuration(runId: string, startTime: string, endTime: string): Promise<HttpReqDurationMetric>;
  extractHttpReqDurationSuccess(runId: string, startTime: string, endTime: string): Promise<HttpReqDurationSuccessMetric>;
  extractErrorResponses(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<ErrorResponsesMetric>;
  extractErrorRequests(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<ErrorRequestsMetric>;
  extractRequests(runId: string, startTime: string, endTime: string): Promise<RequestsMetric>;
  extractRpsAggregated(runId: string, startTime: string, endTime: string): Promise<RpsAggregatedMetric>;
}
