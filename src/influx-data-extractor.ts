import { InfluxClient } from "./influx-client";
import { InfluxConfig } from "./config";

export interface HttpReqsMetric {
  total: number;
  rate: number;
}

export interface VusMetric {
  current: number;
  min: number;
  max: number;
}

export interface VusMaxMetric {
  min: number;
  max: number;
}

export class InfluxDataExtractor {
  private client: InfluxClient;
  private config: InfluxConfig;

  constructor(config: InfluxConfig) {
    this.client = new InfluxClient(config);
    this.config = config;
  }

  async extractHttpReqs(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqsMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_value", "_time"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { total: 0, rate: 0 };
    }

    const total = results.length;
    const timeValues = results
      .map((r) => r._time)
      .filter((t) => t !== null && t !== undefined) as string[];

    if (timeValues.length < 2) {
      return { total, rate: 0 };
    }

    const startTimeMs = new Date(timeValues[0]).getTime();
    const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    const rate = durationSeconds > 0 ? total / durationSeconds : 0;

    return { total, rate };
  }

  async extractVus(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<VusMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus" and r.runId == "${runId}")
        |> group(columns: ["_measurement"])
        |> map(fn: (r) => ({
          current: r._value,
          min: r.min,
          max: r.max
        }))
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { current: 0, min: 0, max: 0 };
    }

    const lastResult = results[results.length - 1];
    const current = (lastResult._value as number) || 0;
    const min = results.reduce((m, r) => Math.min(m, (r._value as number) || 0), current);
    const max = results.reduce((m, r) => Math.max(m, (r._value as number) || 0), current);

    return { current, min, max };
  }

  async extractVusMax(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<VusMaxMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus_max" and r.runId == "${runId}")
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { min: 0, max: 0 };
    }

    const values = results.map((r) => (r._value as number) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { min, max };
  }
}
