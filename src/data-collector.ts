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

  collect(
    runId: string,
    startTime: string = "-1h",
    endTime: string = "now()",
    data: unknown = {}
  ): ReporterResponse {
    return {
      runId,
      startTime,
      endTime,
      timestamp: new Date().toISOString(),
      data,
    };
  }
}
