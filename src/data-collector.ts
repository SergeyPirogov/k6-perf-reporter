import { DataSource } from "./datasources";
import { ReporterResponse } from "./types";
import {
  extractHttpReqsFromData,
  extractHttpReqFailedFromData,
  extractHttpReqDurationFromData,
  extractHttpReqDurationSuccessFromData,
  extractErrorResponsesFromData,
  extractTopSlowUrlsFromData,
  extractErrorRequestsFromData,
  extractSuccessRequestsFromData,
  extractRpsPerUrlFromData,
  extractRpsAggregatedFromData,
} from "./metrics";
import { Loader } from "./loader";
import { Cache } from "./cache";

export { ReporterResponse } from "./types";

export class DataCollector {
  private dataSource: DataSource;
  private loader = new Loader();
  private cache: Cache | null;

  constructor(dataSource: DataSource, cacheTtl?: number) {
    this.dataSource = dataSource;
    this.cache = cacheTtl != null && cacheTtl > 0 ? new Cache(cacheTtl) : null;
  }

  private formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  async collect(
    runId: string,
    startTime: string = "-1h",
    endTime: string = "now()",
    data: unknown = {}
  ): Promise<ReporterResponse> {
    if (this.cache) {
      const cached = this.cache.get(runId, startTime, endTime);
      if (cached) {
        this.loader.success("Loaded report from cache");
        return cached;
      }
    }

    // Phase 1: Parallel bulk fetch — all independent queries at once
    this.loader.start("Fetching all data in parallel...");
    const fetchStart = Date.now();
    const [
      httpReqsData,
      httpReqDurationData,
      duration,
      vus,
      vusMax,
      iterations,
      checks,
      iterationDuration,
      errorResponsesText,
    ] = await Promise.all([
      this.dataSource.fetchHttpReqsData(runId, startTime, endTime),
      this.dataSource.fetchHttpReqDurationData(runId, startTime, endTime),
      this.dataSource.calculateTestDuration(runId, startTime, endTime),
      this.dataSource.extractVus(runId, startTime, endTime),
      this.dataSource.extractVusMax(runId, startTime, endTime),
      this.dataSource.extractIterations(runId, startTime, endTime),
      this.dataSource.extractChecks(runId, startTime, endTime),
      this.dataSource.extractIterationDuration(runId, startTime, endTime),
      this.dataSource.extractErrorResponsesText(runId, startTime, endTime),
    ]);
    this.loader.success(`Data fetching finished in ${this.formatElapsed(Date.now() - fetchStart)}`);

    // Phase 2: Derive metrics from cached data (no additional queries)
    this.loader.start("Computing metrics...");

    // Update iterations with duration info
    if (iterations.total > 0 && duration.durationSeconds > 0) {
      iterations.rate = iterations.total / duration.durationSeconds;
    }

    const httpReqs = extractHttpReqsFromData(httpReqsData, duration);
    const httpReqFailed = extractHttpReqFailedFromData(httpReqsData);
    const httpReqDuration = extractHttpReqDurationFromData(httpReqDurationData);
    const httpReqDurationSuccess = extractHttpReqDurationSuccessFromData(httpReqDurationData);
    const errorResponses = extractErrorResponsesFromData(httpReqsData, duration);
    const topSlowUrls = extractTopSlowUrlsFromData(httpReqDurationData);
    const errorRequests = extractErrorRequestsFromData(httpReqsData);
    const successRequests = extractSuccessRequestsFromData(httpReqDurationData);
    const rpsPerUrl = extractRpsPerUrlFromData(httpReqsData);
    const rpsAggregated = extractRpsAggregatedFromData(httpReqsData);

    this.loader.success("Computed all metrics");

    const reportData = {
      ...(typeof data === "object" && data !== null ? data : {}),
      httpReqs,
      vus,
      vusMax,
      iterations,
      duration,
      checks,
      httpReqFailed,
      httpReqDuration,
      httpReqDurationSuccess,
      iterationDuration,
      errorResponses,
      rpsPerUrl,
      topSlowUrls,
      errorRequests,
      successRequests,
      errorResponsesText,
      rpsAggregated,
    };

    const result: ReporterResponse = {
      runId,
      startTime: duration.startTime || startTime,
      endTime: duration.endTime || endTime,
      timestamp: new Date().toISOString(),
      data: reportData,
    };

    if (this.cache) {
      this.cache.set(runId, startTime, endTime, result);
    }

    return result;
  }
}
