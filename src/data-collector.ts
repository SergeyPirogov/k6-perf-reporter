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

    const reportData = {
      ...(typeof data === "object" && data !== null ? data : {}),
      httpReqs,
      vus,
      vusMax,
      iterations,
      duration,
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
