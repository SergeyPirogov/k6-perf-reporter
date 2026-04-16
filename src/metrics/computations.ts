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
  TopSlowUrlsMetric,
  ErrorRequestsMetric,
  SuccessRequestsMetric,
  RpsAggregatedMetric,
  RpsPerUrlMetric,
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

export function extractTopSlowUrlsFromData(
  data: HttpReqDurationRow[]
): TopSlowUrlsMetric {
  if (data.length === 0) {
    logger.info("extractTopSlowUrls: no data found, returning empty list");
    return { urls: [] };
  }

  const urlMap = new Map<string, { durations: number[]; method: string }>();

  data.forEach((r) => {
    const key = `${r.method} ${r.url}`;
    if (!urlMap.has(key)) {
      urlMap.set(key, { durations: [], method: r.method });
    }
    urlMap.get(key)!.durations.push(r._value);
  });

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

export function extractErrorRequestsFromData(
  data: HttpReqsRow[]
): ErrorRequestsMetric {
  if (data.length === 0) {
    logger.info("extractErrorRequests: no data found, returning empty list");
    return { errors: [] };
  }

  const errorResults = data.filter((r) => r.status > 400);
  logger.debug(`extractErrorRequests: ${errorResults.length} error rows out of ${data.length} total`);

  if (errorResults.length === 0) {
    logger.info("extractErrorRequests: no error requests found");
    return { errors: [] };
  }

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

export function extractSuccessRequestsFromData(
  durationData: HttpReqDurationRow[]
): SuccessRequestsMetric {
  if (durationData.length === 0) {
    logger.info("extractSuccessRequests: no data found, returning empty list");
    return { requests: [] };
  }

  const successDurations = durationData.filter((r) => r.status < 400);
  logger.debug(`extractSuccessRequests: ${successDurations.length} success rows out of ${durationData.length} total`);

  if (successDurations.length === 0) {
    logger.info("extractSuccessRequests: no successful requests found");
    return { requests: [] };
  }

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

export function extractRpsPerUrlFromData(
  data: HttpReqsRow[]
): RpsPerUrlMetric {
  if (data.length === 0) {
    logger.info("extractRpsPerUrl: no data found, returning empty list");
    return { urls: [] };
  }

  const urlWindowMap = new Map<string, number>();
  const urlSet = new Set<string>();

  data.forEach((r) => {
    const timestamp = new Date(r._time);
    const windowTime = new Date(timestamp);
    windowTime.setMilliseconds(0);
    const windowKey = windowTime.toISOString();

    const methodUrlKey = `${r.method} ${r.url}`;
    const key = `${methodUrlKey}|${windowKey}`;

    urlWindowMap.set(key, (urlWindowMap.get(key) || 0) + 1);
    urlSet.add(methodUrlKey);
  });

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

  const urlResults = Array.from(urlSet)
    .map((methodUrlKey) => {
      const data = urlRpsMap.get(methodUrlKey)!;
      const sortedRps = data.windowCounts.sort((a, b) => a - b);
      const rpsAvg = sortedRps.reduce((sum, val) => sum + val, 0) / sortedRps.length;
      const rpsMax = sortedRps[sortedRps.length - 1];
      const rpsP95 = percentile(sortedRps, 95);

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
