import { InfluxDataExtractor } from "./influx-data-extractor";
import { InfluxConfig } from "./config";
import { Loader } from "./loader";
import { Cache } from "./cache";

export interface ReporterResponse {
  runId: string;
  startTime: string;
  endTime: string;
  timestamp: string;
  data: unknown;
}

export class DataCollector {
  private extractor: InfluxDataExtractor;
  private loader = new Loader();
  private cache: Cache | null;

  constructor(config: InfluxConfig, cacheTtl?: number) {
    this.extractor = new InfluxDataExtractor(config);
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
      this.extractor.fetchHttpReqsData(runId, startTime, endTime),
      this.extractor.fetchHttpReqDurationData(runId, startTime, endTime),
      this.extractor.calculateTestDuration(runId, startTime, endTime),
      this.extractor.extractVus(runId, startTime, endTime),
      this.extractor.extractVusMax(runId, startTime, endTime),
      this.extractor.extractIterations(runId, startTime, endTime),
      this.extractor.extractChecks(runId, startTime, endTime),
      this.extractor.extractIterationDuration(runId, startTime, endTime),
      this.extractor.extractErrorResponsesText(runId, startTime, endTime),
    ]);
    this.loader.success(`Data fetching finished in ${this.formatElapsed(Date.now() - fetchStart)}`);

    // Phase 2: Derive metrics from cached data (no additional queries)
    this.loader.start("Computing metrics...");

    // Update iterations with duration info
    if (iterations.total > 0 && duration.durationSeconds > 0) {
      iterations.rate = iterations.total / duration.durationSeconds;
    }

    const httpReqs = this.extractor.extractHttpReqsFromData(httpReqsData, duration);
    const httpReqFailed = this.extractor.extractHttpReqFailedFromData(httpReqsData);
    const httpReqDuration = this.extractor.extractHttpReqDurationFromData(httpReqDurationData);
    const httpReqDurationSuccess = this.extractor.extractHttpReqDurationSuccessFromData(httpReqDurationData);
    const errorResponses = this.extractor.extractErrorResponsesFromData(httpReqsData, duration);
    const topSlowUrls = this.extractor.extractTopSlowUrlsFromData(httpReqDurationData);
    const errorRequests = this.extractor.extractErrorRequestsFromData(httpReqsData);
    const successRequests = this.extractor.extractSuccessRequestsFromData(httpReqDurationData);
    const rpsPerUrl = this.extractor.extractRpsPerUrlFromData(httpReqsData);
    const rpsAggregated = this.extractor.extractRpsAggregatedFromData(httpReqsData);

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
