import { DataSource } from "./datasources";
import { ReporterResponse } from "./types";
import {
  extractHttpReqsFromData,
  extractHttpReqFailedFromData,
  extractHttpReqDurationFromData,
  extractHttpReqDurationSuccessFromData,
  extractErrorResponsesFromData,
  extractErrorRequestsFromData,
  extractRequestsFromData,
  extractRpsAggregatedFromData,
} from "./metrics";
import { Loader } from "./loader";
import { Cache } from "./cache";
import { logger } from "./logger";

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
    logger.info(`DataCollector.collect: runId=${runId}, range=[${startTime}, ${endTime}]`);

    if (this.cache) {
      const cached = this.cache.get(runId, startTime, endTime);
      if (cached) {
        logger.info("DataCollector.collect: cache hit, skipping data fetch");
        this.loader.success("Loaded report from cache");
        return cached;
      }
      logger.debug("DataCollector.collect: cache miss, fetching from datasource");
    }

    // Phase 1: Parallel bulk fetch — all independent queries at once
    this.loader.start("Fetching all data in parallel...");
    const fetchStart = Date.now();
    logger.info("DataCollector.collect: starting parallel data fetch (9 queries)");
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
    const fetchElapsed = Date.now() - fetchStart;
    logger.info(`DataCollector.collect: parallel fetch completed in ${fetchElapsed}ms`);
    logger.debug(
      `DataCollector.collect: fetched rows — httpReqs=${httpReqsData.length}, httpReqDuration=${httpReqDurationData.length}, ` +
      `errorResponsesText=${errorResponsesText.responses.length}`
    );
    this.loader.success(`Data fetching finished in ${this.formatElapsed(fetchElapsed)}`);

    // Phase 2: Derive metrics from cached data (no additional queries)
    this.loader.start("Computing metrics...");
    logger.info("DataCollector.collect: computing derived metrics");

    // Update iterations with duration info
    if (iterations.total > 0 && duration.durationSeconds > 0) {
      iterations.rate = iterations.total / duration.durationSeconds;
    }

    const httpReqs = extractHttpReqsFromData(httpReqsData, duration);
    const httpReqFailed = extractHttpReqFailedFromData(httpReqsData);
    const httpReqDuration = extractHttpReqDurationFromData(httpReqDurationData);
    const httpReqDurationSuccess = extractHttpReqDurationSuccessFromData(httpReqDurationData);
    const errorResponses = extractErrorResponsesFromData(httpReqsData, duration);
    const errorRequests = extractErrorRequestsFromData(httpReqsData, httpReqDurationData);
    const requests = extractRequestsFromData(httpReqsData, httpReqDurationData);
    const rpsAggregated = extractRpsAggregatedFromData(httpReqsData);

    logger.info("DataCollector.collect: all metrics computed");
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
      requests,
      errorRequests,
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
      logger.debug("DataCollector.collect: result cached");
    }

    return result;
  }
}
