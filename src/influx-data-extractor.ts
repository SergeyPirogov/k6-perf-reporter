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

export interface ErrorResponsesMetric {
  count: number;
  rate: number;
}

export interface TopSlowUrlMetric {
  method: string;
  url: string;
  p95Duration: number;
  rps: number;
}

export interface TopSlowUrlsMetric {
  urls: TopSlowUrlMetric[];
}

export interface ErrorRequestMetric {
  method: string;
  url: string;
  status: number;
  p95Duration: number;
  count: number;
  rps: number;
}

export interface ErrorRequestsMetric {
  errors: ErrorRequestMetric[];
}

export interface SuccessRequestMetric {
  method: string;
  url: string;
  status: number;
  count: number;
  min: number;
  avg: number;
  p95: number;
  rps: number;
}

export interface SuccessRequestsMetric {
  requests: SuccessRequestMetric[];
}

export interface ErrorResponseMetric {
  url: string;
  method: string;
  status: number;
  error: string;
}

export interface ErrorResponsesTextMetric {
  responses: ErrorResponseMetric[];
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

    // Get full test duration
    const durationQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const durationResults = await this.client.queryData(durationQuery);

    if (!durationResults || durationResults.length < 2) {
      return { total, rate: 0 };
    }

    const timeValues = durationResults
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
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { current: 0, min: 0, max: 0 };
    }

    const values = results.map((r) => (r._value as number) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { current: max, min, max };
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

    // Get full test duration
    const durationQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const durationResults = await this.client.queryData(durationQuery);

    if (!durationResults || durationResults.length < 2) {
      return { total, rate: 0 };
    }

    const timeValues = durationResults
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
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["status"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { total: 0, failed: 0, failureRate: 0 };
    }

    const total = results.length;
    const failed = results.filter((r) => {
      const status = r.status as number;
      return status > 400;
    }).length;
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

  async extractErrorResponses(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ErrorResponsesMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["status", "_time"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { count: 0, rate: 0 };
    }

    const count = results.filter((r) => {
      const status = r.status as number;
      return status > 300;
    }).length;

    // Get full test duration
    const durationQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const durationResults = await this.client.queryData(durationQuery);

    if (!durationResults || durationResults.length < 2) {
      return { count, rate: 0 };
    }

    const timeValues = durationResults
      .map((r) => r._time)
      .filter((t) => t !== null && t !== undefined) as string[];

    if (timeValues.length < 2) {
      return { count, rate: 0 };
    }

    const startTimeMs = new Date(timeValues[0]).getTime();
    const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    const rate = durationSeconds > 0 ? count / durationSeconds : 0;

    return { count, rate };
  }

  async extractTopSlowUrls(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<TopSlowUrlsMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value", "url", "method"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { urls: [] };
    }

    // Get test duration for RPS calculation
    const durationQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const durationResults = await this.client.queryData(durationQuery);
    let testDurationSeconds = 1;

    if (durationResults && durationResults.length >= 2) {
      const timeValues = durationResults
        .map((r) => r._time)
        .filter((t) => t !== null && t !== undefined) as string[];

      if (timeValues.length >= 2) {
        const startTimeMs = new Date(timeValues[0]).getTime();
        const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
        testDurationSeconds = Math.max(1, (endTimeMs - startTimeMs) / 1000);
      }
    }

    // Group by URL and method, calculate p95 duration
    const urlMap = new Map<string, { durations: number[]; method: string; count: number }>();

    results.forEach((r) => {
      const url = r.url as string;
      const method = r.method as string;
      const duration = typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0;

      const key = `${method} ${url}`;
      if (!urlMap.has(key)) {
        urlMap.set(key, { durations: [], method, count: 0 });
      }
      const entry = urlMap.get(key)!;
      entry.durations.push(duration);
      entry.count++;
    });

    // Calculate p95 for each URL and sort
    const topUrls = Array.from(urlMap.entries())
      .map(([key, data]) => {
        const sorted = data.durations.sort((a, b) => a - b);
        const p95Duration = percentile(sorted, 95);
        const [method, url] = key.split(" ");
        const rps = data.count / testDurationSeconds;
        return { method, url, p95Duration, rps };
      })
      .sort((a, b) => b.p95Duration - a.p95Duration)
      .slice(0, 10);

    return { urls: topUrls };
  }

  async extractErrorRequests(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ErrorRequestsMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_value", "url", "method", "status"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { errors: [] };
    }

    // Get test duration for RPS calculation
    const durationQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const durationResults = await this.client.queryData(durationQuery);
    let testDurationSeconds = 1;

    if (durationResults && durationResults.length >= 2) {
      const timeValues = durationResults
        .map((r) => r._time)
        .filter((t) => t !== null && t !== undefined) as string[];

      if (timeValues.length >= 2) {
        const startTimeMs = new Date(timeValues[0]).getTime();
        const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
        testDurationSeconds = Math.max(1, (endTimeMs - startTimeMs) / 1000);
      }
    }

    // Filter only error responses (status > 400)
    const errorResults = results.filter((r) => {
      const status = r.status as number;
      return status > 400;
    });

    if (errorResults.length === 0) {
      return { errors: [] };
    }

    // Group by URL, method, and status
    const errorMap = new Map<string, { durations: number[]; method: string; status: number; count: number }>();

    errorResults.forEach((r) => {
      const url = r.url as string;
      const method = r.method as string;
      const status = r.status as number;
      const duration = typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0;

      const key = `${method} ${url} ${status}`;
      if (!errorMap.has(key)) {
        errorMap.set(key, { durations: [], method, status, count: 0 });
      }
      const entry = errorMap.get(key)!;
      entry.durations.push(duration);
      entry.count++;
    });

    // Calculate p95 for each error endpoint and sort by count (descending)
    const topErrors = Array.from(errorMap.entries())
      .map(([key, data]) => {
        const sorted = data.durations.sort((a, b) => a - b);
        const p95Duration = percentile(sorted, 95);
        const [method, url] = key.split(" ").slice(0, 2).join(" ").split(" ");
        const rps = data.count / testDurationSeconds;
        return { method, url, status: data.status, p95Duration, count: data.count, rps };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { errors: topErrors };
  }

  async extractSuccessRequests(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<SuccessRequestsMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_value", "url", "method", "status"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { requests: [] };
    }

    // Get test duration for RPS calculation
    const durationQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> sort(columns: ["_time"])
    `;

    const durationResults = await this.client.queryData(durationQuery);
    let testDurationSeconds = 1;

    if (durationResults && durationResults.length >= 2) {
      const timeValues = durationResults
        .map((r) => r._time)
        .filter((t) => t !== null && t !== undefined) as string[];

      if (timeValues.length >= 2) {
        const startTimeMs = new Date(timeValues[0]).getTime();
        const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
        testDurationSeconds = Math.max(1, (endTimeMs - startTimeMs) / 1000);
      }
    }

    // Filter only successful responses (status < 400)
    const successResults = results.filter((r) => {
      const status = r.status as number;
      return status < 400;
    });

    if (successResults.length === 0) {
      return { requests: [] };
    }

    // Get duration data for successful requests
    const durationQuerySuccess = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value", "url", "method", "status"])
    `;

    const durationResultsSuccess = await this.client.queryData(durationQuerySuccess);

    if (!durationResultsSuccess || durationResultsSuccess.length === 0) {
      return { requests: [] };
    }

    // Filter only successful durations (status < 400)
    const successDurations = durationResultsSuccess.filter((r) => {
      const status = r.status as number;
      return status < 400;
    });

    // Group by URL, method, and status
    const requestMap = new Map<string, { durations: number[]; method: string; status: number; count: number }>();

    successDurations.forEach((r) => {
      const url = r.url as string;
      const method = r.method as string;
      const status = r.status as number;
      const duration = typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0;

      const key = `${method} ${url} ${status}`;
      if (!requestMap.has(key)) {
        requestMap.set(key, { durations: [], method, status, count: 0 });
      }
      const entry = requestMap.get(key)!;
      entry.durations.push(duration);
      entry.count++;
    });

    // Calculate stats for each endpoint and sort by count (descending)
    const topRequests = Array.from(requestMap.entries())
      .map(([key, data]) => {
        const sorted = data.durations.sort((a, b) => a - b);
        const min = sorted[0];
        const avg = data.durations.reduce((sum, val) => sum + val, 0) / data.durations.length;
        const p95 = percentile(sorted, 95);
        const [method, url] = key.split(" ").slice(0, 2).join(" ").split(" ");
        const rps = data.count / testDurationSeconds;
        return { method, url, status: data.status, count: data.count, min, avg, p95, rps };
      })
      .sort((a, b) => b.count - a.count);

    return { requests: topRequests };
  }

  async extractErrorResponsesText(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ErrorResponsesTextMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "error_responses" and r.runId == "${runId}")
        |> keep(columns: ["endpoint", "method", "status", "err"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { responses: [] };
    }

    // Map to error response format
    const responses = results.map((r) => ({
      url: r.endpoint as string,
      method: r.method as string,
      status: r.status as number,
      error: String(r.err || ""),
    }));

    return { responses };
  }
}
