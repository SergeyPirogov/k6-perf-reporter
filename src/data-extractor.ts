import { InfluxDBClient, QueryResult, InfluxConfig } from "./influx-client";

export interface MetricsData {
  timestamp: string;
  value: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export class DataExtractor {
  private bucket: string;

  constructor(private client: InfluxDBClient, config: InfluxConfig) {
    this.bucket = config.bucket;
  }

  async getVus(
    startTime: string,
    endTime: string,
    runId?: string
  ): Promise<MetricsData[]> {
    const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
    const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus" ${runIdFilter})
    `;

    const results = await this.client.query(fluxQuery);
    return this.formatMetrics(results);
  }

  async getMaxVus(
    startTime: string,
    endTime: string,
    runId?: string
  ): Promise<MetricsData[]> {
    const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
    const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus_max" ${runIdFilter})
    `;

    const results = await this.client.query(fluxQuery);
    return this.formatMetrics(results);
  }

  private formatMetrics(results: QueryResult[]): MetricsData[] {
    return results.map((result) => ({
      timestamp: (result._time as string) || new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      value: parseFloat(result._value) || 0,
      ...result,
    }));
  }
}




