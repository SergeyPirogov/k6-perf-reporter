import { logger } from "../logger";
import {
  HttpReqsRow,
  HttpReqDurationRow,
  DurationMetric,
  HttpReqsMetric,
  HttpReqFailedMetric,
  HttpReqDurationMetric,
  HttpReqDurationSuccessMetric,
  ErrorResponsesMetric,
  ErrorRequestsMetric,
  RpsAggregatedMetric,
  RequestsMetric,
} from "../types";

export const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const index = Math.ceil((p / 100) * values.length) - 1;
  return values[Math.max(0, index)];
};

export function extractHttpReqsFromData(
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

export function extractHttpReqFailedFromData(
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

export function extractHttpReqDurationFromData(
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

export function extractHttpReqDurationSuccessFromData(
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

export function extractErrorResponsesFromData(
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

export function extractErrorRequestsFromData(
  httpReqsData: HttpReqsRow[],
  httpReqDurationData: HttpReqDurationRow[]
): ErrorRequestsMetric {
  if (httpReqsData.length === 0 && httpReqDurationData.length === 0) {
    logger.info("extractErrorRequests: no data found, returning empty list");
    return { errors: [] };
  }

  const errorReqs = httpReqsData.filter((r) => r.status > 400);
  logger.debug(`extractErrorRequests: ${errorReqs.length} error rows out of ${httpReqsData.length} total`);

  if (errorReqs.length === 0 && httpReqDurationData.filter((r) => r.status >= 400).length === 0) {
    logger.info("extractErrorRequests: no error requests found");
    return { errors: [] };
  }

  // Build duration map from httpReqDurationData (error rows, keyed by method+url+status)
  const errorDurations = httpReqDurationData.filter((r) => r.status >= 400);
  const durationMap = new Map<string, { durations: number[]; method: string; url: string; status: number; count: number }>();

  errorDurations.forEach((r) => {
    const key = `${r.method} ${r.url} ${r.status}`;
    if (!durationMap.has(key)) {
      durationMap.set(key, { durations: [], method: r.method, url: r.url, status: r.status, count: 0 });
    }
    const entry = durationMap.get(key)!;
    entry.durations.push(r._value);
    entry.count++;
  });

  // If we have no duration data but have error reqs, build from httpReqsData counts
  if (durationMap.size === 0 && errorReqs.length > 0) {
    const countMap = new Map<string, { method: string; url: string; status: number; count: number }>();
    errorReqs.forEach((r) => {
      const key = `${r.method} ${r.url} ${r.status}`;
      if (!countMap.has(key)) {
        countMap.set(key, { method: r.method, url: r.url, status: r.status, count: 0 });
      }
      countMap.get(key)!.count++;
    });

    const errors = Array.from(countMap.values())
      .map((data) => ({
        method: data.method,
        url: data.url,
        status: data.status,
        count: data.count,
        min: 0,
        avg: 0,
        p95: 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    logger.info(`extractErrorRequests: found ${errors.length} unique error endpoints (no duration data)`);
    return { errors };
  }

  const errors = Array.from(durationMap.values())
    .map((data) => {
      const sorted = data.durations.sort((a, b) => a - b);
      const min = sorted[0];
      const avg = data.durations.reduce((sum, val) => sum + val, 0) / data.durations.length;
      const p95Val = percentile(sorted, 95);

      return {
        method: data.method,
        url: data.url,
        status: data.status,
        count: data.count,
        min,
        avg,
        p95: p95Val,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  logger.info(`extractErrorRequests: found ${errors.length} unique error endpoints`);
  return { errors };
}

export function extractRpsAggregatedFromData(
  data: HttpReqsRow[]
): RpsAggregatedMetric {
  if (data.length === 0) {
    logger.info("extractRpsAggregated: no data found, returning empty");
    return { dataPoints: [], avg: 0, p95: 0, max: 0 };
  }

  const windowMap = new Map<string, number>();

  data.forEach((r) => {
    const timestamp = new Date(r._time);
    const windowTime = new Date(timestamp);
    windowTime.setMilliseconds(0);
    const windowKey = windowTime.toISOString();

    windowMap.set(windowKey, (windowMap.get(windowKey) || 0) + 1);
  });

  const dataPoints = Array.from(windowMap.entries())
    .map(([timestamp, count]) => ({
      timestamp,
      rps: count,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const rpsValues = dataPoints.map((dp) => dp.rps).sort((a, b) => a - b);
  const avg = rpsValues.reduce((sum, val) => sum + val, 0) / rpsValues.length;
  const max = rpsValues[rpsValues.length - 1];
  const p95 = percentile(rpsValues, 95);

  logger.info(`extractRpsAggregated: ${dataPoints.length} data points, avg=${avg.toFixed(2)} rps, p95=${p95.toFixed(2)} rps, max=${max} rps`);
  return { dataPoints, avg, p95, max };
}

export function extractRequestsFromData(
  httpReqsData: HttpReqsRow[],
  httpReqDurationData: HttpReqDurationRow[]
): RequestsMetric {
  if (httpReqsData.length === 0 && httpReqDurationData.length === 0) {
    logger.info("extractRequests: no data found, returning empty list");
    return { requests: [] };
  }

  // Build RPS map from httpReqsData (keyed by method+url)
  const urlWindowMap = new Map<string, number>();
  const urlTotalCount = new Map<string, number>();

  httpReqsData.forEach((r) => {
    const timestamp = new Date(r._time);
    const windowTime = new Date(timestamp);
    windowTime.setMilliseconds(0);
    const windowKey = windowTime.toISOString();

    const methodUrlKey = `${r.method} ${r.url}`;
    const key = `${methodUrlKey}|${windowKey}`;

    urlWindowMap.set(key, (urlWindowMap.get(key) || 0) + 1);
    urlTotalCount.set(methodUrlKey, (urlTotalCount.get(methodUrlKey) || 0) + 1);
  });

  const rpsMap = new Map<string, { avg: number; p95: number; max: number }>();

  const urlWindowCounts = new Map<string, number[]>();
  Array.from(urlWindowMap.entries()).forEach(([key, count]) => {
    const methodUrlKey = key.split("|")[0];
    if (!urlWindowCounts.has(methodUrlKey)) {
      urlWindowCounts.set(methodUrlKey, []);
    }
    urlWindowCounts.get(methodUrlKey)!.push(count);
  });

  urlWindowCounts.forEach((windowCounts, methodUrlKey) => {
    const sorted = windowCounts.sort((a, b) => a - b);
    const avg = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const max = sorted[sorted.length - 1];
    const p95 = percentile(sorted, 95);
    rpsMap.set(methodUrlKey, { avg, p95, max });
  });

  // Build duration map from httpReqDurationData (keyed by method+url+status, filtered to success)
  const successDurations = httpReqDurationData.filter((r) => r.status < 400);
  const durationMap = new Map<string, { durations: number[]; method: string; url: string; status: number; count: number }>();

  successDurations.forEach((r) => {
    const key = `${r.method} ${r.url} ${r.status}`;
    if (!durationMap.has(key)) {
      durationMap.set(key, { durations: [], method: r.method, url: r.url, status: r.status, count: 0 });
    }
    const entry = durationMap.get(key)!;
    entry.durations.push(r._value);
    entry.count++;
  });

  // Merge: iterate over duration groups and attach RPS from rpsMap
  const requests = Array.from(durationMap.values())
    .map((data) => {
      const sorted = data.durations.sort((a, b) => a - b);
      const min = sorted[0];
      const avg = data.durations.reduce((sum, val) => sum + val, 0) / data.durations.length;
      const p95 = percentile(sorted, 95);

      const methodUrlKey = `${data.method} ${data.url}`;
      const rps = rpsMap.get(methodUrlKey) || { avg: 0, p95: 0, max: 0 };

      return {
        method: data.method,
        url: data.url,
        status: data.status,
        count: data.count,
        rps,
        min,
        avg,
        p95,
      };
    })
    .sort((a, b) => b.p95 - a.p95);

  logger.info(`extractRequests: found ${requests.length} unique successful endpoints with RPS data`);
  return { requests };
}
