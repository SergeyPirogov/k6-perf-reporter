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
    this.loader.start("Extracting http_reqs...");
    const httpReqs = await this.extractor.extractHttpReqs(runId, startTime, endTime);
    this.loader.success("Extracted http_reqs");

    this.loader.start("Extracting vus...");
    const vus = await this.extractor.extractVus(runId, startTime, endTime);
    this.loader.success("Extracted vus");

    this.loader.start("Extracting vus_max...");
    const vusMax = await this.extractor.extractVusMax(runId, startTime, endTime);
    this.loader.success("Extracted vus_max");

    this.loader.start("Extracting iterations...");
    const iterations = await this.extractor.extractIterations(runId, startTime, endTime);
    this.loader.success("Extracted iterations");

    this.loader.start("Calculating test duration...");
    const duration = await this.extractor.calculateTestDuration(runId, startTime, endTime);
    this.loader.success("Calculated test duration");

    this.loader.start("Extracting checks...");
    const checks = await this.extractor.extractChecks(runId, startTime, endTime);
    this.loader.success("Extracted checks");

    this.loader.start("Extracting http_req_failed...");
    const httpReqFailed = await this.extractor.extractHttpReqFailed(runId, startTime, endTime);
    this.loader.success("Extracted http_req_failed");

    this.loader.start("Extracting http_req_duration...");
    const httpReqDuration = await this.extractor.extractHttpReqDuration(runId, startTime, endTime);
    this.loader.success("Extracted http_req_duration");

    this.loader.start("Extracting http_req_duration (success only)...");
    const httpReqDurationSuccess = await this.extractor.extractHttpReqDurationSuccess(runId, startTime, endTime);
    this.loader.success("Extracted http_req_duration (success only)");

    this.loader.start("Extracting iteration_duration...");
    const iterationDuration = await this.extractor.extractIterationDuration(runId, startTime, endTime);
    this.loader.success("Extracted iteration_duration");

    this.loader.start("Extracting error_responses...");
    const errorResponses = await this.extractor.extractErrorResponses(runId, startTime, endTime);
    this.loader.success("Extracted error_responses");

    this.loader.start("Extracting top slow URLs...");
    const topSlowUrls = await this.extractor.extractTopSlowUrls(runId, startTime, endTime);
    this.loader.success("Extracted top slow URLs");

    this.loader.start("Extracting error requests...");
    const errorRequests = await this.extractor.extractErrorRequests(runId, startTime, endTime);
    this.loader.success("Extracted error requests");

    this.loader.start("Extracting success requests...");
    const successRequests = await this.extractor.extractSuccessRequests(runId, startTime, endTime);
    this.loader.success("Extracted success requests");

    this.loader.start("Extracting error responses text...");
    const errorResponsesText = await this.extractor.extractErrorResponsesText(runId, startTime, endTime);
    this.loader.success("Extracted error responses text");

    this.loader.start("Extracting RPS per URL...");
    const rpsPerUrl = await this.extractor.extractRpsPerUrl(runId, startTime, endTime);
    this.loader.success("Extracted RPS per URL");

    this.loader.start("Extracting RPS aggregated (5s intervals)...");
    const rpsAggregated = await this.extractor.extractRpsAggregated(runId, startTime, endTime);
    this.loader.success("Extracted RPS aggregated");

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
