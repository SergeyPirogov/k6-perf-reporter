import { VictoriaMetricsConfig } from "../../config";
import { logger } from "../../logger";
import { DataSource } from "../datasource";
import {
  DurationMetric,
  VusMetric,
  VusMaxMetric,
  IterationsMetric,
  ChecksMetric,
  IterationDurationMetric,
  ErrorResponsesTextMetric,
  ErrorResponseMetric,
  HttpReqsMetric,
  HttpReqFailedMetric,
  HttpReqDurationMetric,
  HttpReqDurationSuccessMetric,
  ErrorResponsesMetric,
  ErrorRequestsMetric,
  RequestsMetric,
  RpsAggregatedMetric,
} from "../../types";
import { VmClient } from "./vm-client";

export class VictoriaMetricsDataSource implements DataSource {
  private client: VmClient;
  private runEndTimeCache = new Map<string, Promise<string>>();

  constructor(config: VictoriaMetricsConfig) {
    this.client = new VmClient(config);
  }

  private sel(runId: string, metric: string, extra = ""): string {
    return `${metric}{runId="${runId}"${extra ? "," + extra : ""}}`;
  }

  private instant(series: Awaited<ReturnType<VmClient["queryInstant"]>>): number {
    return series.length ? parseFloat(series[0].value[1]) : 0;
  }

  private instantMs(series: Awaited<ReturnType<VmClient["queryInstant"]>>): number {
    return this.instant(series) * 1000;
  }

  private resolveMs(t: string): number {
    if (t === "now()") return Date.now();
    const rel = /^-(\d+)(ms|s|m|h|d|w)$/.exec(t);
    if (rel) {
      const n = parseInt(rel[1], 10);
      const mult: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
      return Date.now() - n * (mult[rel[2]] ?? 1000);
    }
    // Unix timestamp string (returned by getRunEndTime)
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t) * 1000;
    return new Date(t).getTime();
  }

  private autoStep(startTime: string, endTime: string, targetPoints = 1000): string {
    const rangeSeconds = Math.ceil((this.resolveMs(endTime) - this.resolveMs(startTime)) / 1000);
    const step = Math.max(1, Math.ceil(rangeSeconds / targetPoints));
    return `${step}s`;
  }

  private durationRange(startTime: string, endTime: string): string {
    const s = Math.ceil((this.resolveMs(endTime) - this.resolveMs(startTime)) / 1000);
    return `${s}s`;
  }

  // Returns actual Unix timestamp (as string) of the last data point for this run.
  // Cached per (runId, startTime, endTime) — all parallel callers share one fetch.
  private getRunEndTime(runId: string, startTime: string, endTime: string): Promise<string> {
    const key = `${runId}|${startTime}|${endTime}`;
    if (!this.runEndTimeCache.has(key)) {
      this.runEndTimeCache.set(key, (async () => {
        const series = await this.client.queryRange(
          `k6_http_reqs_total{runId="${runId}"}`,
          startTime,
          endTime,
          this.autoStep(startTime, endTime)
        );
        if (!series.length) return endTime;
        const allTs = series.flatMap((s) => s.values.map(([ts]) => ts));
        return allTs.length ? String(Math.max(...allTs)) : endTime;
      })());
    }
    return this.runEndTimeCache.get(key)!;
  }

  async calculateTestDuration(runId: string, startTime: string, endTime: string): Promise<DurationMetric> {
    logger.debug(`calculateTestDuration: runId=${runId}`);

    // Use fine resolution (target 10000 pts) so span closely matches true test duration.
    // autoStep with 1000 pts causes ~3% drift on -1h windows.
    const series = await this.client.queryRange(
      this.sel(runId, "k6_http_reqs_total"),
      startTime,
      endTime,
      this.autoStep(startTime, endTime, 10000)
    );

    if (!series.length) {
      logger.info("calculateTestDuration: no data");
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const allTs = series.flatMap((s) => s.values.map(([ts]) => ts));
    if (!allTs.length) return { startTime: "", endTime: "", durationSeconds: 0 };

    const minTs = Math.min(...allTs);
    const maxTs = Math.max(...allTs);
    const first = new Date(minTs * 1000).toISOString();
    const last = new Date(maxTs * 1000).toISOString();
    const durationSeconds = maxTs - minTs;

    logger.info(`calculateTestDuration: ${durationSeconds.toFixed(1)}s`);
    return { startTime: first, endTime: last, durationSeconds };
  }

  async extractVus(runId: string, startTime: string, endTime: string): Promise<VusMetric> {
    logger.debug(`extractVus: runId=${runId}`);

    const series = await this.client.queryRange(
      this.sel(runId, "k6_vus"),
      startTime,
      endTime,
      this.autoStep(startTime, endTime)
    );

    if (!series.length) return { current: 0, min: 0, max: 0 };

    const values = series.flatMap((s) => s.values.map(([, v]) => parseFloat(v)));
    const min = Math.min(...values);
    const max = Math.max(...values);

    logger.info(`extractVus: min=${min}, max=${max}`);
    return { current: max, min, max };
  }

  async extractVusMax(runId: string, startTime: string, endTime: string): Promise<VusMaxMetric> {
    logger.debug(`extractVusMax: runId=${runId}`);

    const series = await this.client.queryRange(
      this.sel(runId, "k6_vus_max"),
      startTime,
      endTime,
      this.autoStep(startTime, endTime)
    );

    if (!series.length) return { min: 0, max: 0 };

    const values = series.flatMap((s) => s.values.map(([, v]) => parseFloat(v)));
    const min = Math.min(...values);
    const max = Math.max(...values);

    logger.info(`extractVusMax: min=${min}, max=${max}`);
    return { min, max };
  }

  async extractIterations(runId: string, startTime: string, endTime: string): Promise<IterationsMetric> {
    logger.debug(`extractIterations: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const [totalSeries, duration] = await Promise.all([
      this.client.queryInstant(`sum(k6_iterations_total{runId="${runId}"})`, runEnd),
      this.calculateTestDuration(runId, startTime, endTime),
    ]);

    if (!totalSeries.length) return { total: 0, rate: 0 };

    const total = Math.round(parseFloat(totalSeries[0].value[1]));
    const rate = duration.durationSeconds > 0 ? total / duration.durationSeconds : 0;

    logger.info(`extractIterations: total=${total}, rate=${rate.toFixed(2)} iter/s`);
    return { total, rate };
  }

  async extractChecks(runId: string, startTime: string, endTime: string): Promise<ChecksMetric> {
    logger.debug(`extractChecks: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    // k6_checks_rate: one series per check name, value in [0,1] = pass rate for that check
    const series = await this.client.queryInstant(`k6_checks_rate{runId="${runId}"}`, runEnd);

    if (!series.length) {
      logger.info("extractChecks: no data");
      return { passes: 0, fails: 0, passRate: 0 };
    }

    const passes = series.filter((s) => parseFloat(s.value[1]) >= 1).length;
    const fails = series.filter((s) => parseFloat(s.value[1]) < 1).length;
    const total = passes + fails;
    const passRate = total > 0 ? (passes / total) * 100 : 0;

    logger.info(`extractChecks: passes=${passes}, fails=${fails}, passRate=${passRate.toFixed(2)}%`);
    return { passes, fails, passRate };
  }

  async extractIterationDuration(runId: string, startTime: string, endTime: string): Promise<IterationDurationMetric> {
    logger.debug(`extractIterationDuration: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const [avgS, minS, maxS, p50S, p90S, p95S] = await Promise.all([
      this.client.queryInstant(`avg(k6_iteration_duration_avg{runId="${runId}"})`, runEnd),
      this.client.queryInstant(`min(k6_iteration_duration_min{runId="${runId}"})`, runEnd),
      this.client.queryInstant(`max(k6_iteration_duration_max{runId="${runId}"})`, runEnd),
      this.client.queryInstant(`avg(k6_iteration_duration_p50{runId="${runId}"})`, runEnd),
      this.client.queryInstant(`avg(k6_iteration_duration_p90{runId="${runId}"})`, runEnd),
      this.client.queryInstant(`avg(k6_iteration_duration_p95{runId="${runId}"})`, runEnd),
    ]);

    if (!avgS.length) return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };

    const result = {
      avg: this.instantMs(avgS),
      min: this.instantMs(minS),
      med: this.instantMs(p50S),
      max: this.instantMs(maxS),
      p90: this.instantMs(p90S),
      p95: this.instantMs(p95S),
    };
    logger.info(`extractIterationDuration: avg=${result.avg.toFixed(2)}ms, p95=${result.p95.toFixed(2)}ms`);
    return result;
  }

  async extractErrorResponsesText(runId: string, startTime: string, endTime: string): Promise<ErrorResponsesTextMetric> {
    logger.debug(`extractErrorResponsesText: runId=${runId}`);

    const series = await this.client.queryRange(
      `k6_http_reqs_total{runId="${runId}",status=~"[45][0-9][0-9]"}`,
      startTime,
      endTime,
      this.autoStep(startTime, endTime)
    );

    if (!series.length) return { responses: [] };

    const grouped = new Map<string, ErrorResponseMetric>();

    for (const s of series) {
      const url = s.metric["url"] ?? s.metric["name"] ?? "";
      const method = s.metric["method"] ?? "";
      const status = parseInt(s.metric["status"] ?? "0", 10);
      const error = s.metric["error"] ?? s.metric["err"] ?? "";
      const key = `${method}|${url}|${status}`;
      const vals = s.values;
      const count = vals.length >= 2
        ? Math.round(parseFloat(vals[vals.length - 1][1]) - parseFloat(vals[0][1]))
        : Math.round(parseFloat(vals[0]?.[1] ?? "0"));

      if (grouped.has(key)) {
        grouped.get(key)!.count += count;
      } else {
        grouped.set(key, { url, method, status, error, count });
      }
    }

    const responses = Array.from(grouped.values()).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
    logger.info(`extractErrorResponsesText: ${responses.length} unique errors`);
    return { responses };
  }

  async extractHttpReqs(runId: string, startTime: string, endTime: string, _ignoredStatusCodes: number[]): Promise<HttpReqsMetric> {
    logger.debug(`extractHttpReqs: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const dur = this.durationRange(startTime, runEnd);
    const total = Math.round(this.instant(
      await this.client.queryInstant(`sum(increase(k6_http_reqs_total{runId="${runId}"}[${dur}]))`, runEnd)
    ));
    const duration = await this.calculateTestDuration(runId, startTime, endTime);
    const rate = duration.durationSeconds > 0 ? total / duration.durationSeconds : 0;

    logger.info(`extractHttpReqs: total=${total}, rate=${rate.toFixed(2)} req/s`);
    return { total, rate };
  }

  async extractHttpReqFailed(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<HttpReqFailedMetric> {
    logger.debug(`extractHttpReqFailed: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const dur = this.durationRange(startTime, runEnd);
    const ignoredRe = ignoredStatusCodes.length ? `,status!~"${ignoredStatusCodes.join("|")}"` : "";

    const [totalSeries, failedSeries] = await Promise.all([
      this.client.queryInstant(`sum(increase(k6_http_reqs_total{runId="${runId}"}[${dur}]))`, runEnd),
      this.client.queryInstant(`sum(increase(k6_http_reqs_total{runId="${runId}",status=~"[45][0-9][0-9]"${ignoredRe}}[${dur}]))`, runEnd),
    ]);

    const total = Math.round(this.instant(totalSeries));
    const failed = Math.round(this.instant(failedSeries));
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    logger.info(`extractHttpReqFailed: total=${total}, failed=${failed}, failureRate=${failureRate.toFixed(2)}%`);
    return { total, failed, failureRate };
  }

  // VM stores only pre-aggregated gauges, so overall stats must be request-count-weighted across
  // per-endpoint series. This is an approximation for percentiles (~1% of k6) but exact for avg.
  private weightedStat(
    seriesMs: Map<string, number>,
    counts: Map<string, number>,
  ): number {
    let num = 0, den = 0;
    for (const [k, v] of seriesMs) {
      const c = counts.get(k) ?? 0;
      num += v * c; den += c;
    }
    return den > 0 ? num / den : 0;
  }

  private buildCountMap(countSeries: Awaited<ReturnType<VmClient["queryInstant"]>>): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of countSeries) {
      const key = `${s.metric["method"] ?? ""}|${s.metric["url"] ?? ""}|${s.metric["status"] ?? ""}`;
      m.set(key, Math.round(parseFloat(s.value[1])));
    }
    return m;
  }

  private buildStatMap(
    statSeries: Awaited<ReturnType<VmClient["queryInstant"]>>,
    toMs = true,
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of statSeries) {
      const key = `${s.metric["method"] ?? ""}|${s.metric["url"] ?? ""}|${s.metric["status"] ?? ""}`;
      const v = parseFloat(s.value[1]);
      m.set(key, toMs ? v * 1000 : v);
    }
    return m;
  }

  async extractHttpReqDuration(runId: string, startTime: string, endTime: string): Promise<HttpReqDurationMetric> {
    logger.debug(`extractHttpReqDuration: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const dur = this.durationRange(startTime, runEnd);
    const sel = `runId="${runId}"`;

    const [countS, avgS, minS, maxS, p50S, p90S, p95S] = await Promise.all([
      this.client.queryInstant(`sum by (url,method,status)(increase(k6_http_reqs_total{${sel}}[${dur}]))`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_avg{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_min{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_max{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_p50{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_p90{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_p95{${sel}}`, runEnd),
    ]);

    if (!avgS.length) return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };

    const counts = this.buildCountMap(countS);
    const result = {
      avg: this.weightedStat(this.buildStatMap(avgS), counts),
      min: Math.min(...minS.map((s) => parseFloat(s.value[1]) * 1000)),
      med: this.weightedStat(this.buildStatMap(p50S), counts),
      max: Math.max(...maxS.map((s) => parseFloat(s.value[1]) * 1000)),
      p90: this.weightedStat(this.buildStatMap(p90S), counts),
      p95: this.weightedStat(this.buildStatMap(p95S), counts),
    };
    logger.info(`extractHttpReqDuration: avg=${result.avg.toFixed(2)}ms, p95=${result.p95.toFixed(2)}ms`);
    return result;
  }

  async extractHttpReqDurationSuccess(runId: string, startTime: string, endTime: string): Promise<HttpReqDurationSuccessMetric> {
    logger.debug(`extractHttpReqDurationSuccess: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const dur = this.durationRange(startTime, runEnd);
    const sel = `runId="${runId}",status=~"[123][0-9][0-9]"`;

    const [countS, avgS, minS, maxS, p50S, p90S, p95S] = await Promise.all([
      this.client.queryInstant(`sum by (url,method,status)(increase(k6_http_reqs_total{${sel}}[${dur}]))`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_avg{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_min{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_max{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_p50{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_p90{${sel}}`, runEnd),
      this.client.queryInstant(`k6_http_req_duration_p95{${sel}}`, runEnd),
    ]);

    if (!avgS.length) return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };

    const counts = this.buildCountMap(countS);
    return {
      avg: this.weightedStat(this.buildStatMap(avgS), counts),
      min: Math.min(...minS.map((s) => parseFloat(s.value[1]) * 1000)),
      med: this.weightedStat(this.buildStatMap(p50S), counts),
      max: Math.max(...maxS.map((s) => parseFloat(s.value[1]) * 1000)),
      p90: this.weightedStat(this.buildStatMap(p90S), counts),
      p95: this.weightedStat(this.buildStatMap(p95S), counts),
    };
  }

  async extractErrorResponses(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<ErrorResponsesMetric> {
    logger.debug(`extractErrorResponses: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const dur = this.durationRange(startTime, runEnd);
    const ignoredRe = ignoredStatusCodes.length ? `,status!~"${ignoredStatusCodes.join("|")}"` : "";

    const [countSeries, durationResult] = await Promise.all([
      this.client.queryInstant(
        `sum(increase(k6_http_reqs_total{runId="${runId}",status=~"[345][0-9][0-9]"${ignoredRe}}[${dur}]))`,
        runEnd
      ),
      this.calculateTestDuration(runId, startTime, endTime),
    ]);

    const count = Math.round(this.instant(countSeries));
    const rate = durationResult.durationSeconds > 0 ? count / durationResult.durationSeconds : 0;

    logger.info(`extractErrorResponses: count=${count}, rate=${rate.toFixed(2)} err/s`);
    return { count, rate };
  }

  async extractErrorRequests(runId: string, startTime: string, endTime: string, ignoredStatusCodes: number[]): Promise<ErrorRequestsMetric> {
    logger.debug(`extractErrorRequests: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const ignoredRe = ignoredStatusCodes.length ? `,status!~"${ignoredStatusCodes.join("|")}"` : "";
    const dur = this.durationRange(startTime, runEnd);

    const [countSeries, avgSeries, minSeries, p95Series] = await Promise.all([
      this.client.queryInstant(
        `sum by (url,method,status)(increase(k6_http_reqs_total{runId="${runId}",status=~"[45][0-9][0-9]"${ignoredRe}}[${dur}]))`,
        runEnd
      ),
      this.client.queryInstant(`avg by (url,method,status)(k6_http_req_duration_avg{runId="${runId}",status=~"[45][0-9][0-9]"${ignoredRe}})`, runEnd),
      this.client.queryInstant(`min by (url,method,status)(k6_http_req_duration_min{runId="${runId}",status=~"[45][0-9][0-9]"${ignoredRe}})`, runEnd),
      this.client.queryInstant(`avg by (url,method,status)(k6_http_req_duration_p95{runId="${runId}",status=~"[45][0-9][0-9]"${ignoredRe}})`, runEnd),
    ]);

    if (!countSeries.length) return { errors: [] };

    const avgMap = new Map(avgSeries.map((s) => [`${s.metric["method"]}|${s.metric["url"]}|${s.metric["status"]}`, parseFloat(s.value[1]) * 1000]));
    const minMap = new Map(minSeries.map((s) => [`${s.metric["method"]}|${s.metric["url"]}|${s.metric["status"]}`, parseFloat(s.value[1]) * 1000]));
    const p95Map = new Map(p95Series.map((s) => [`${s.metric["method"]}|${s.metric["url"]}|${s.metric["status"]}`, parseFloat(s.value[1]) * 1000]));

    const errors = countSeries
      .map((s) => {
        const url = s.metric["url"] ?? "";
        const method = s.metric["method"] ?? "";
        const status = parseInt(s.metric["status"] ?? "0", 10);
        const key = `${method}|${url}|${status}`;
        return {
          method,
          url,
          status,
          count: Math.round(parseFloat(s.value[1])),
          min: minMap.get(key) ?? 0,
          avg: avgMap.get(key) ?? 0,
          p95: p95Map.get(key) ?? 0,
        };
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    logger.info(`extractErrorRequests: ${errors.length} unique error endpoints`);
    return { errors };
  }

  async extractRequests(runId: string, startTime: string, endTime: string): Promise<RequestsMetric> {
    logger.debug(`extractRequests: runId=${runId}`);

    const runEnd = await this.getRunEndTime(runId, startTime, endTime);
    const dur = this.durationRange(startTime, runEnd);

    const [countSeries, avgSeries, minSeries, p95Series, rpsSeries] = await Promise.all([
      this.client.queryInstant(`sum by (url,method,status)(increase(k6_http_reqs_total{runId="${runId}",status=~"[123][0-9][0-9]"}[${dur}]))`, runEnd),
      this.client.queryInstant(`avg by (url,method,status)(k6_http_req_duration_avg{runId="${runId}",status=~"[123][0-9][0-9]"})`, runEnd),
      this.client.queryInstant(`min by (url,method,status)(k6_http_req_duration_min{runId="${runId}",status=~"[123][0-9][0-9]"})`, runEnd),
      this.client.queryInstant(`avg by (url,method,status)(k6_http_req_duration_p95{runId="${runId}",status=~"[123][0-9][0-9]"})`, runEnd),
      this.client.queryRange(`sum by (url,method)(rate(k6_http_reqs_total{runId="${runId}",status=~"[123][0-9][0-9]"}[1m]))`, startTime, endTime, this.autoStep(startTime, endTime)),
    ]);

    if (!countSeries.length) return { requests: [] };

    const makeKey = (m: Record<string, string>) => `${m["method"]}|${m["url"]}`;
    const avgMap = new Map(avgSeries.map((s) => [makeKey(s.metric), parseFloat(s.value[1]) * 1000]));
    const minMap = new Map(minSeries.map((s) => [makeKey(s.metric), parseFloat(s.value[1]) * 1000]));
    const p95Map = new Map(p95Series.map((s) => [makeKey(s.metric), parseFloat(s.value[1]) * 1000]));

    // Build RPS stats per method+url from range series
    const rpsStatsMap = new Map<string, { avg: number; p95: number; max: number }>();
    for (const s of rpsSeries) {
      const key = makeKey(s.metric);
      const vals = s.values.map(([, v]) => parseFloat(v)).sort((a, b) => a - b);
      if (!vals.length) continue;
      const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      const max = vals[vals.length - 1];
      const p95idx = Math.ceil(0.95 * vals.length) - 1;
      const p95 = vals[Math.max(0, p95idx)];
      rpsStatsMap.set(key, { avg, p95, max });
    }

    const requests = countSeries
      .map((s) => {
        const url = s.metric["url"] ?? "";
        const method = s.metric["method"] ?? "";
        const status = parseInt(s.metric["status"] ?? "0", 10);
        const key = `${method}|${url}`;
        return {
          method,
          url,
          status,
          count: Math.round(parseFloat(s.value[1])),
          rps: rpsStatsMap.get(key) ?? { avg: 0, p95: 0, max: 0 },
          min: minMap.get(key) ?? 0,
          avg: avgMap.get(key) ?? 0,
          p95: p95Map.get(key) ?? 0,
        };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.p95 - a.p95);

    logger.info(`extractRequests: ${requests.length} unique successful endpoints`);
    return { requests };
  }

  async extractRpsAggregated(runId: string, startTime: string, endTime: string): Promise<RpsAggregatedMetric> {
    logger.debug(`extractRpsAggregated: runId=${runId}`);

    const series = await this.client.queryRange(
      `sum(rate(k6_http_reqs_total{runId="${runId}"}[1m]))`,
      startTime,
      endTime,
      this.autoStep(startTime, endTime)
    );

    if (!series.length) return { dataPoints: [], avg: 0, p95: 0, max: 0 };

    const dataPoints = series[0].values.map(([ts, v]) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      rps: parseFloat(v),
    }));

    const rpsValues = dataPoints.map((dp) => dp.rps).sort((a, b) => a - b);
    const avg = rpsValues.reduce((sum, v) => sum + v, 0) / rpsValues.length;
    const max = rpsValues[rpsValues.length - 1];
    const p95idx = Math.ceil(0.95 * rpsValues.length) - 1;
    const p95 = rpsValues[Math.max(0, p95idx)];

    logger.info(`extractRpsAggregated: ${dataPoints.length} data points, avg=${avg.toFixed(2)} rps, max=${max.toFixed(2)} rps`);
    return { dataPoints, avg, p95, max };
  }
}
