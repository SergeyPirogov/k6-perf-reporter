import { InfluxClient } from "./influx-client";
import { InfluxConfig } from "./config";

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const index = (p / 100) * (values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return values[lower];
  }

  return values[lower] * (1 - weight) + values[upper] * weight;
};

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

export interface IterationsMetric {
  total: number;
  rate: number;
}

export interface DurationMetric {
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

export interface ChecksMetric {
  passes: number;
  fails: number;
  passRate: number;
}

export interface HttpReqFailedMetric {
  total: number;
  failed: number;
  failureRate: number;
}

export interface HttpReqDurationMetric {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
}

export interface IterationDurationMetric {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
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

  async extractIterations(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<IterationsMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iterations" and r.runId == "${runId}")
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

  async calculateTestDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<DurationMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const timeValues = results
      .map((r) => r._time)
      .filter((t) => t !== null && t !== undefined) as string[];

    if (timeValues.length === 0) {
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const firstTime = timeValues[0];
    const lastTime = timeValues[timeValues.length - 1];
    const startTimeMs = new Date(firstTime).getTime();
    const endTimeMs = new Date(lastTime).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    return {
      startTime: firstTime,
      endTime: lastTime,
      durationSeconds,
    };
  }

  async extractChecks(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ChecksMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "checks" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { passes: 0, fails: 0, passRate: 0 };
    }

    const passes = results.filter((r) => (r._value as number) === 1).length;
    const fails = results.filter((r) => (r._value as number) === 0).length;
    const total = passes + fails;
    const passRate = total > 0 ? (passes / total) * 100 : 0;

    return { passes, fails, passRate };
  }

  async extractHttpReqFailed(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqFailedMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_failed" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { total: 0, failed: 0, failureRate: 0 };
    }

    const failed = results.filter((r) => (r._value as number) === 1).length;
    const total = results.length;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    return { total, failed, failureRate };
  }

  async extractHttpReqDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqDurationMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };
    }

    const values = results
      .map((r) => {
        const val = r._value;
        return typeof val === "string" ? parseFloat(val) : (val as number) || 0;
      })
      .sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const med = percentile(values, 50);
    const p90 = percentile(values, 90);
    const p95 = percentile(values, 95);

    return { avg, min, med, max, p90, p95 };
  }

  async extractIterationDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<IterationDurationMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iteration_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };
    }

    const values = results
      .map((r) => {
        const val = r._value;
        return typeof val === "string" ? parseFloat(val) : (val as number) || 0;
      })
      .sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const med = percentile(values, 50);
    const p90 = percentile(values, 90);
    const p95 = percentile(values, 95);

    return { avg, min, med, max, p90, p95 };
  }
}
