import { InfluxClient } from "./influx-client";
import { InfluxConfig } from "./config";

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const index = Math.ceil((p / 100) * values.length) - 1;
  return values[Math.max(0, index)];
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

export interface HttpReqDurationSuccessMetric {
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

export interface RpsMetric {
  avg: number;
  p95: number;
  max: number;
}

export interface TopSlowUrlMetric {
  method: string;
  url: string;
  p95Duration: number;
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

export interface RpsUrlMetric {
  method: string;
  url: string;
  count: number;
  rps: RpsMetric;
}

export interface RpsPerUrlMetric {
  urls: RpsUrlMetric[];
}

export interface RpsAggregatedMetric {
  dataPoints: Array<{
    timestamp: string;
    rps: number;
  }>;
  avg: number;
  p95: number;
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

  async extractHttpReqDurationSuccess(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqDurationSuccessMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" and r.runId == "${runId}")
        |> filter(fn: (r) => exists r.status and int(v: r.status) < 400)
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

    // Group by URL and method, calculate p95 duration
    const urlMap = new Map<string, { durations: number[]; method: string }>();

    results.forEach((r) => {
      const url = r.url as string;
      const method = r.method as string;
      const duration = typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0;

      const key = `${method} ${url}`;
      if (!urlMap.has(key)) {
        urlMap.set(key, { durations: [], method });
      }
      const entry = urlMap.get(key)!;
      entry.durations.push(duration);
    });

    // Calculate p95 for each URL and sort
    const topUrls = Array.from(urlMap.entries())
      .map(([key, data]) => {
        const sorted = data.durations.sort((a, b) => a - b);
        const p95Duration = percentile(sorted, 95);
        const [method, url] = key.split(" ");
        return { method, url, p95Duration };
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
        return { method, url, status: data.status, p95Duration, count: data.count };
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
        return { method, url, status: data.status, count: data.count, min, avg, p95 };
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

  async extractRpsAggregated(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<RpsAggregatedMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_time"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { dataPoints: [], avg: 0, p95: 0, max: 0 };
    }

    // Group by 1-second windows
    const windowMap = new Map<string, number>();

    results.forEach((r) => {
      const timestamp = new Date(r._time as string);
      // Round down to nearest 1-second interval
      const windowTime = new Date(timestamp);
      windowTime.setMilliseconds(0);
      const windowKey = windowTime.toISOString();

      windowMap.set(windowKey, (windowMap.get(windowKey) || 0) + 1);
    });

    // Convert to RPS data points
    const dataPoints = Array.from(windowMap.entries())
      .map(([timestamp, count]) => ({
        timestamp,
        rps: count, // 1 second window = requests per second
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate statistics from RPS values
    const rpsValues = dataPoints.map((dp) => dp.rps).sort((a, b) => a - b);
    const avg = rpsValues.reduce((sum, val) => sum + val, 0) / rpsValues.length;
    const max = rpsValues[rpsValues.length - 1];
    const p95 = percentile(rpsValues, 95);

    return { dataPoints, avg, p95, max };
  }

  async extractRpsPerUrl(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<RpsPerUrlMetric> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_time", "url", "method"])
    `;

    const results = await this.client.queryData(query);

    if (!results || results.length === 0) {
      return { urls: [] };
    }

    // Group by method+url and 1-second window
    const urlWindowMap = new Map<string, number>();
    const urlSet = new Set<string>();

    results.forEach((r) => {
      const url = r.url as string;
      const method = r.method as string;
      const timestamp = new Date(r._time as string);

      // Round down to nearest 1-second interval
      const windowTime = new Date(timestamp);
      windowTime.setMilliseconds(0);
      const windowKey = windowTime.toISOString();

      const methodUrlKey = `${method} ${url}`;
      const key = `${methodUrlKey}|${windowKey}`;

      urlWindowMap.set(key, (urlWindowMap.get(key) || 0) + 1);
      urlSet.add(methodUrlKey);
    });

    // Calculate RPS statistics per URL
    const urlRpsMap = new Map<string, { windowCounts: number[]; count: number }>();

    Array.from(urlWindowMap.entries()).forEach(([key, count]) => {
      const methodUrlKey = key.split("|")[0];
      if (!urlRpsMap.has(methodUrlKey)) {
        urlRpsMap.set(methodUrlKey, { windowCounts: [], count: 0 });
      }
      const entry = urlRpsMap.get(methodUrlKey)!;
      entry.windowCounts.push(count);
      entry.count++;
    });

    // Build result array with RPS statistics
    const urlResults = Array.from(urlSet)
      .map((methodUrlKey) => {
        const data = urlRpsMap.get(methodUrlKey)!;
        const sortedRps = data.windowCounts.sort((a, b) => a - b);
        const rpsAvg = sortedRps.reduce((sum, val) => sum + val, 0) / sortedRps.length;
        const rpsMax = sortedRps[sortedRps.length - 1];
        const rpsP95 = percentile(sortedRps, 95);

        // Parse method and URL
        const [method, ...urlParts] = methodUrlKey.split(" ");
        const url = urlParts.join(" ");

        return {
          method,
          url,
          count: results.filter((r) => (r.method as string) === method && (r.url as string) === url).length,
          rps: { avg: rpsAvg, p95: rpsP95, max: rpsMax },
        };
      })
      .sort((a, b) => b.rps.avg - a.rps.avg);

    return { urls: urlResults };
  }
}
