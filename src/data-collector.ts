import { DataSource } from "./datasources";
import { ReporterResponse } from "./types";
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
    data: unknown = {},
    ignoredStatusCodes: number[] = []
  ): Promise<ReporterResponse> {
    logger.info(`DataCollector.collect: runId=${runId}, range=[${startTime}, ${endTime}]${ignoredStatusCodes.length > 0 ? `, ignoredStatusCodes=[${ignoredStatusCodes.join(",")}]` : ""}`);

    if (this.cache) {
      const cached = this.cache.get(runId, startTime, endTime);
      if (cached) {
        logger.info("DataCollector.collect: cache hit, skipping data fetch");
        this.loader.success("Loaded report from cache");
        return cached;
      }
      logger.debug("DataCollector.collect: cache miss, fetching from datasource");
    }

    this.loader.start("Fetching all data in parallel...");
    const fetchStart = Date.now();
    logger.info("DataCollector.collect: starting parallel data fetch");

    const [
      duration,
      vus,
      vusMax,
      iterations,
      checks,
      iterationDuration,
      errorResponsesText,
      httpReqs,
      httpReqFailed,
      httpReqDuration,
      httpReqDurationSuccess,
      errorResponses,
      errorRequests,
      requests,
      rpsAggregated,
    ] = await Promise.all([
      this.dataSource.calculateTestDuration(runId, startTime, endTime),
      this.dataSource.extractVus(runId, startTime, endTime),
      this.dataSource.extractVusMax(runId, startTime, endTime),
      this.dataSource.extractIterations(runId, startTime, endTime),
      this.dataSource.extractChecks(runId, startTime, endTime),
      this.dataSource.extractIterationDuration(runId, startTime, endTime),
      this.dataSource.extractErrorResponsesText(runId, startTime, endTime),
      this.dataSource.extractHttpReqs(runId, startTime, endTime, ignoredStatusCodes),
      this.dataSource.extractHttpReqFailed(runId, startTime, endTime, ignoredStatusCodes),
      this.dataSource.extractHttpReqDuration(runId, startTime, endTime),
      this.dataSource.extractHttpReqDurationSuccess(runId, startTime, endTime),
      this.dataSource.extractErrorResponses(runId, startTime, endTime, ignoredStatusCodes),
      this.dataSource.extractErrorRequests(runId, startTime, endTime, ignoredStatusCodes),
      this.dataSource.extractRequests(runId, startTime, endTime),
      this.dataSource.extractRpsAggregated(runId, startTime, endTime),
    ]);

    const fetchElapsed = Date.now() - fetchStart;
    logger.info(`DataCollector.collect: parallel fetch completed in ${fetchElapsed}ms`);
    this.loader.success(`Data fetching finished in ${this.formatElapsed(fetchElapsed)}`);

    // Update iterations rate using authoritative duration if not already set
    if (iterations.total > 0 && duration.durationSeconds > 0 && iterations.rate === 0) {
      iterations.rate = iterations.total / duration.durationSeconds;
    }

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
      ...(ignoredStatusCodes.length > 0 ? { ignoredStatusCodes } : {}),
    };

    if (this.cache) {
      this.cache.set(runId, startTime, endTime, result);
      logger.debug("DataCollector.collect: result cached");
    }

    return result;
  }
}
