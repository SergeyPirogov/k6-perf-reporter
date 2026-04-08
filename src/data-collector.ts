import { InfluxDataExtractor } from "./influx-data-extractor";
import { InfluxConfig } from "./config";

export interface ReporterResponse {
  runId: string;
  startTime: string;
  endTime: string;
  timestamp: string;
  data: unknown;
}

export class DataCollector {
  private extractor: InfluxDataExtractor;

  constructor(config: InfluxConfig) {
    this.extractor = new InfluxDataExtractor(config);
  }

  async collect(
    runId: string,
    startTime: string = "-1h",
    endTime: string = "now()",
    data: unknown = {}
  ): Promise<ReporterResponse> {
    const httpReqs = await this.extractor.extractHttpReqs(runId, startTime, endTime);
    const vus = await this.extractor.extractVus(runId, startTime, endTime);
    const vusMax = await this.extractor.extractVusMax(runId, startTime, endTime);
    const iterations = await this.extractor.extractIterations(runId, startTime, endTime);
    const duration = await this.extractor.calculateTestDuration(runId, startTime, endTime);
    const checks = await this.extractor.extractChecks(runId, startTime, endTime);
    const httpReqFailed = await this.extractor.extractHttpReqFailed(runId, startTime, endTime);
    const httpReqDuration = await this.extractor.extractHttpReqDuration(runId, startTime, endTime);
    const iterationDuration = await this.extractor.extractIterationDuration(runId, startTime, endTime);
    const errorResponses = await this.extractor.extractErrorResponses(runId, startTime, endTime);
    const topSlowUrls = await this.extractor.extractTopSlowUrls(runId, startTime, endTime);
    const errorRequests = await this.extractor.extractErrorRequests(runId, startTime, endTime);
    const successRequests = await this.extractor.extractSuccessRequests(runId, startTime, endTime);
    const errorResponsesText = await this.extractor.extractErrorResponsesText(runId, startTime, endTime);

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
      iterationDuration,
      errorResponses,
      topSlowUrls,
      errorRequests,
      successRequests,
      errorResponsesText,
    };

    return {
      runId,
      startTime,
      endTime,
      timestamp: new Date().toISOString(),
      data: reportData,
    };
  }
}
