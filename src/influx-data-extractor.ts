import { InfluxClient } from "./influx-client";
import { InfluxConfig } from "./config";
import { logger } from "./logger";

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
  count: number;
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

export interface HttpReqsRow {
  _value: number;
  _time: string;
  url: string;
  method: string;
  status: number;
}

export interface HttpReqDurationRow {
  _value: number;
  url: string;
  method: string;
  status: number;
}

export class InfluxDataExtractor {
  private client: InfluxClient;
  private config: InfluxConfig;

  constructor(config: InfluxConfig) {
    this.client = new InfluxClient(config);
    this.config = config;
  }

  // --- Bulk fetch methods (single query per measurement) ---

  async fetchHttpReqsData(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqsRow[]> {
    logger.debug(`fetchHttpReqsData: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_value", "_time", "url", "method", "status"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`fetchHttpReqsData: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) return [];

    return results.map((r) => ({
      _value: typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0,
      _time: r._time as string,
      url: r.url as string,
      method: r.method as string,
      status: typeof r.status === "string" ? parseInt(r.status, 10) : (r.status as number) || 0,
    }));
  }

  async fetchHttpReqDurationData(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqDurationRow[]> {
    logger.debug(`fetchHttpReqDurationData: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value", "url", "method", "status"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`fetchHttpReqDurationData: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) return [];

    return results.map((r) => ({
      _value: typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0,
      url: r.url as string,
      method: r.method as string,
      status: typeof r.status === "string" ? parseInt(r.status, 10) : (r.status as number) || 0,
    }));
  }

  // --- Derived metrics from pre-fetched data (no queries) ---

  extractHttpReqsFromData(
    data: HttpReqsRow[],
    duration: DurationMetric
  ): HttpReqsMetric {
    if (data.length === 0) {
      logger.info("extractHttpReqs: no data found, returning zeros");
      return { total: 0, rate: 0 };
    }

    const total = data.length;
    const rate = duration.durationSeconds > 0 ? total / duration.durationSeconds : 0;

    logger.info(`extractHttpReqs: total=${total}, rate=${rate.toFixed(2)} req/s`);
    return { total, rate };
  }

  extractHttpReqFailedFromData(
    data: HttpReqsRow[]
  ): HttpReqFailedMetric {
    if (data.length === 0) {
      logger.info("extractHttpReqFailed: no data found, returning zeros");
      return { total: 0, failed: 0, failureRate: 0 };
    }

    const total = data.length;
    const failed = data.filter((r) => r.status > 400).length;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    logger.info(`extractHttpReqFailed: total=${total}, failed=${failed}, failureRate=${failureRate.toFixed(2)}%`);
    return { total, failed, failureRate };
  }

  extractHttpReqDurationFromData(
    data: HttpReqDurationRow[]
  ): HttpReqDurationMetric {
    if (data.length === 0) {
      logger.info("extractHttpReqDuration: no data found, returning zeros");
      return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };
    }

    const values = data.map((r) => r._value).sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const med = percentile(values, 50);
    const p90 = percentile(values, 90);
    const p95 = percentile(values, 95);

    logger.info(`extractHttpReqDuration: avg=${avg.toFixed(2)}ms, p90=${p90.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    return { avg, min, med, max, p90, p95 };
  }

  extractHttpReqDurationSuccessFromData(
    data: HttpReqDurationRow[]
  ): HttpReqDurationSuccessMetric {
    const successData = data.filter((r) => r.status < 400);

    if (successData.length === 0) {
      logger.info("extractHttpReqDurationSuccess: no data found, returning zeros");
      return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };
    }

    const values = successData.map((r) => r._value).sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const med = percentile(values, 50);
    const p90 = percentile(values, 90);
    const p95 = percentile(values, 95);

    logger.info(`extractHttpReqDurationSuccess: avg=${avg.toFixed(2)}ms, p90=${p90.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);
    return { avg, min, med, max, p90, p95 };
  }

  extractErrorResponsesFromData(
    data: HttpReqsRow[],
    duration: DurationMetric
  ): ErrorResponsesMetric {
    if (data.length === 0) {
      logger.info("extractErrorResponses: no data found, returning zeros");
      return { count: 0, rate: 0 };
    }

    const count = data.filter((r) => r.status > 300).length;
    const rate = duration.durationSeconds > 0 ? count / duration.durationSeconds : 0;

    logger.info(`extractErrorResponses: count=${count}, rate=${rate.toFixed(2)} err/s`);
    return { count, rate };
  }

  extractTopSlowUrlsFromData(
    data: HttpReqDurationRow[]
  ): TopSlowUrlsMetric {
    if (data.length === 0) {
      logger.info("extractTopSlowUrls: no data found, returning empty list");
      return { urls: [] };
    }

    // Group by URL and method, calculate p95 duration
    const urlMap = new Map<string, { durations: number[]; method: string }>();

    data.forEach((r) => {
      const key = `${r.method} ${r.url}`;
      if (!urlMap.has(key)) {
        urlMap.set(key, { durations: [], method: r.method });
      }
      urlMap.get(key)!.durations.push(r._value);
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

    logger.info(`extractTopSlowUrls: found ${topUrls.length} URLs, slowest p95=${topUrls[0]?.p95Duration.toFixed(2)}ms`);
    return { urls: topUrls };
  }

  extractErrorRequestsFromData(
    data: HttpReqsRow[]
  ): ErrorRequestsMetric {
    if (data.length === 0) {
      logger.info("extractErrorRequests: no data found, returning empty list");
      return { errors: [] };
    }

    // Filter only error responses (status > 400)
    const errorResults = data.filter((r) => r.status > 400);
    logger.debug(`extractErrorRequests: ${errorResults.length} error rows out of ${data.length} total`);

    if (errorResults.length === 0) {
      logger.info("extractErrorRequests: no error requests found");
      return { errors: [] };
    }

    // Group by URL, method, and status
    const errorMap = new Map<string, { durations: number[]; method: string; status: number; count: number }>();

    errorResults.forEach((r) => {
      const key = `${r.method} ${r.url} ${r.status}`;
      if (!errorMap.has(key)) {
        errorMap.set(key, { durations: [], method: r.method, status: r.status, count: 0 });
      }
      const entry = errorMap.get(key)!;
      entry.durations.push(r._value);
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

    logger.info(`extractErrorRequests: found ${topErrors.length} unique error endpoints`);
    return { errors: topErrors };
  }

  extractSuccessRequestsFromData(
    durationData: HttpReqDurationRow[]
  ): SuccessRequestsMetric {
    if (durationData.length === 0) {
      logger.info("extractSuccessRequests: no data found, returning empty list");
      return { requests: [] };
    }

    // Filter only successful durations (status < 400)
    const successDurations = durationData.filter((r) => r.status < 400);
    logger.debug(`extractSuccessRequests: ${successDurations.length} success rows out of ${durationData.length} total`);

    if (successDurations.length === 0) {
      logger.info("extractSuccessRequests: no successful requests found");
      return { requests: [] };
    }

    // Group by URL, method, and status
    const requestMap = new Map<string, { durations: number[]; method: string; status: number; count: number }>();

    successDurations.forEach((r) => {
      const key = `${r.method} ${r.url} ${r.status}`;
      if (!requestMap.has(key)) {
        requestMap.set(key, { durations: [], method: r.method, status: r.status, count: 0 });
      }
      const entry = requestMap.get(key)!;
      entry.durations.push(r._value);
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

    logger.info(`extractSuccessRequests: found ${topRequests.length} unique successful endpoints`);
    return { requests: topRequests };
  }

  extractRpsAggregatedFromData(
    data: HttpReqsRow[]
  ): RpsAggregatedMetric {
    if (data.length === 0) {
      logger.info("extractRpsAggregated: no data found, returning empty");
      return { dataPoints: [], avg: 0, p95: 0, max: 0 };
    }

    // Group by 1-second windows
    const windowMap = new Map<string, number>();

    data.forEach((r) => {
      const timestamp = new Date(r._time);
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
        rps: count,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate statistics from RPS values
    const rpsValues = dataPoints.map((dp) => dp.rps).sort((a, b) => a - b);
    const avg = rpsValues.reduce((sum, val) => sum + val, 0) / rpsValues.length;
    const max = rpsValues[rpsValues.length - 1];
    const p95 = percentile(rpsValues, 95);

    logger.info(`extractRpsAggregated: ${dataPoints.length} data points, avg=${avg.toFixed(2)} rps, p95=${p95.toFixed(2)} rps, max=${max} rps`);
    return { dataPoints, avg, p95, max };
  }

  extractRpsPerUrlFromData(
    data: HttpReqsRow[]
  ): RpsPerUrlMetric {
    if (data.length === 0) {
      logger.info("extractRpsPerUrl: no data found, returning empty list");
      return { urls: [] };
    }

    // Group by method+url and 1-second window
    const urlWindowMap = new Map<string, number>();
    const urlSet = new Set<string>();

    data.forEach((r) => {
      const timestamp = new Date(r._time);

      // Round down to nearest 1-second interval
      const windowTime = new Date(timestamp);
      windowTime.setMilliseconds(0);
      const windowKey = windowTime.toISOString();

      const methodUrlKey = `${r.method} ${r.url}`;
      const key = `${methodUrlKey}|${windowKey}`;

      urlWindowMap.set(key, (urlWindowMap.get(key) || 0) + 1);
      urlSet.add(methodUrlKey);
    });

    // Calculate RPS statistics per URL
    const urlRpsMap = new Map<string, { windowCounts: number[]; totalCount: number }>();

    Array.from(urlWindowMap.entries()).forEach(([key, count]) => {
      const methodUrlKey = key.split("|")[0];
      if (!urlRpsMap.has(methodUrlKey)) {
        urlRpsMap.set(methodUrlKey, { windowCounts: [], totalCount: 0 });
      }
      const entry = urlRpsMap.get(methodUrlKey)!;
      entry.windowCounts.push(count);
      entry.totalCount += count;
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
          count: data.totalCount,
          rps: { avg: rpsAvg, p95: rpsP95, max: rpsMax },
        };
      })
      .sort((a, b) => b.rps.avg - a.rps.avg);

    logger.info(`extractRpsPerUrl: found ${urlResults.length} unique URLs`);
    return { urls: urlResults };
  }

  // --- Methods that still query InfluxDB directly (unique measurements) ---

  async extractVus(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<VusMetric> {
    logger.debug(`extractVus: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractVus: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractVus: no data found, returning zeros");
      return { current: 0, min: 0, max: 0 };
    }

    const values = results.map((r) => (r._value as number) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    logger.info(`extractVus: current=${max}, min=${min}, max=${max}`);
    return { current: max, min, max };
  }

  async extractVusMax(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<VusMaxMetric> {
    logger.debug(`extractVusMax: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus_max" and r.runId == "${runId}")
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractVusMax: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractVusMax: no data found, returning zeros");
      return { min: 0, max: 0 };
    }

    const values = results.map((r) => (r._value as number) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    logger.info(`extractVusMax: min=${min}, max=${max}`);
    return { min, max };
  }

  async extractIterations(
    runId: string,
    startTime: string,
    endTime: string,
    duration?: DurationMetric
  ): Promise<IterationsMetric> {
    logger.debug(`extractIterations: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iterations" and r.runId == "${runId}")
        |> keep(columns: ["_value", "_time"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractIterations: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractIterations: no data found, returning zeros");
      return { total: 0, rate: 0 };
    }

    const total = results.length;

    if (duration) {
      const rate = duration.durationSeconds > 0 ? total / duration.durationSeconds : 0;
      logger.info(`extractIterations: total=${total}, rate=${rate.toFixed(2)} iter/s`);
      return { total, rate };
    }

    // Fallback: calculate from own data
    const timeValues = results
      .map((r) => r._time)
      .filter((t) => t !== null && t !== undefined) as string[];

    if (timeValues.length < 2) {
      return { total, rate: 0 };
    }

    timeValues.sort();
    const startTimeMs = new Date(timeValues[0]).getTime();
    const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    const rate = durationSeconds > 0 ? total / durationSeconds : 0;

    logger.info(`extractIterations: total=${total}, rate=${rate.toFixed(2)} iter/s`);
    return { total, rate };
  }

  async calculateTestDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<DurationMetric> {
    logger.debug(`calculateTestDuration: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const firstQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> group()
        |> sort(columns: ["_time"], desc: false)
        |> limit(n: 1)
    `;

    const lastQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> group()
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const [firstResults, lastResults] = await Promise.all([
      this.client.queryData(firstQuery),
      this.client.queryData(lastQuery),
    ]);

    if (!firstResults?.length || !lastResults?.length) {
      logger.info("calculateTestDuration: no data found, returning empty duration");
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const firstTime = firstResults[0]._time as string;
    const lastTime = lastResults[0]._time as string;

    if (!firstTime || !lastTime) {
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const startTimeMs = new Date(firstTime).getTime();
    const endTimeMs = new Date(lastTime).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    logger.info(`calculateTestDuration: ${durationSeconds.toFixed(1)}s (${firstTime} -> ${lastTime})`);
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
    logger.debug(`extractChecks: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "checks" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractChecks: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractChecks: no data found, returning zeros");
      return { passes: 0, fails: 0, passRate: 0 };
    }

    const passes = results.filter((r) => (r._value as number) === 1).length;
    const fails = results.filter((r) => (r._value as number) === 0).length;
    const total = passes + fails;
    const passRate = total > 0 ? (passes / total) * 100 : 0;

    logger.info(`extractChecks: passes=${passes}, fails=${fails}, passRate=${passRate.toFixed(2)}%`);
    return { passes, fails, passRate };
  }

  async extractIterationDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<IterationDurationMetric> {
    logger.debug(`extractIterationDuration: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iteration_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractIterationDuration: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractIterationDuration: no data found, returning zeros");
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

    logger.info(`extractIterationDuration: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    return { avg, min, med, max, p90, p95 };
  }

  async extractErrorResponsesText(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ErrorResponsesTextMetric> {
    logger.debug(`extractErrorResponsesText: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "error_responses" and r.runId == "${runId}")
        |> keep(columns: ["endpoint", "method", "status", "err"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractErrorResponsesText: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractErrorResponsesText: no error response texts found");
      return { responses: [] };
    }

    // Group by method, URL, and status (error bodies often contain unique IDs/timestamps)
    const groupedErrors = new Map<string, ErrorResponseMetric>();

    results.forEach((r) => {
      const url = r.endpoint as string;
      const method = r.method as string;
      const status = r.status as number;
      const error = String(r.err || "");
      const key = `${method}|${url}|${status}`;

      if (groupedErrors.has(key)) {
        groupedErrors.get(key)!.count++;
      } else {
        groupedErrors.set(key, { url, method, status, error, count: 1 });
      }
    });

    const responses = Array.from(groupedErrors.values())
      .sort((a, b) => b.count - a.count);

    logger.info(`extractErrorResponsesText: ${results.length} rows grouped into ${responses.length} unique errors`);
    return { responses };
  }
}
