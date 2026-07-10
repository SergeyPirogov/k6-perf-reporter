import { VictoriaMetricsClient, resolveTimeRange, VMInstantResult } from "./victoriametrics-client";
import { VictoriaMetricsConfig, VictoriaMetricsNaming } from "../../config";
import { logger } from "../../logger";
import { DataSource } from "../datasource";
import {
  HttpReqsRow,
  HttpReqDurationRow,
  DurationMetric,
  VusMetric,
  VusMaxMetric,
  IterationsMetric,
  ChecksMetric,
  IterationDurationMetric,
  ErrorResponsesTextMetric,
  ErrorResponseMetric,
} from "../../types";

export class VictoriaMetricsDataSource implements DataSource {
  private client: VictoriaMetricsClient;
  private naming: VictoriaMetricsNaming;

  constructor(config: VictoriaMetricsConfig) {
    this.client = new VictoriaMetricsClient(config);
    this.naming = config.naming;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Build metric name: prefix + base + optional unit suffix, e.g. "k6_http_req_duration_seconds" */
  private metric(base: string, withUnit = false): string {
    return this.naming.metricPrefix + base + (withUnit ? this.naming.trendUnitSuffix : "");
  }

  /** Build metric counter name: prefix + base + counter suffix, e.g. "k6_http_reqs_total" */
  private counter(base: string): string {
    return this.naming.metricPrefix + base + this.naming.counterSuffix;
  }

  /** Build PromQL label selector fragment: {runIdLabel="<id>"[,extra]} */
  private sel(runId: string, extra = ""): string {
    const runIdPart = `${this.naming.runIdLabel}="${runId}"`;
    return extra ? `{${runIdPart},${extra}}` : `{${runIdPart}}`;
  }

  /** Build stat suffix based on config, e.g. _p95 or _p(95). k6 sanitizes metric names so "underscore" is near-universal. */
  private statSuffix(stat: string): string {
    if (this.naming.trendStatSuffixFormat === "paren") {
      // e.g. _p(95); only applies to percentage stats
      return `_${stat}`;
    }
    // underscore: p(50) -> _p50, p(90) -> _p90, etc.
    return `_${stat.replace(/\((\d+)\)/, "$1").replace(/[^a-zA-Z0-9_]/, "")}`;
  }

  /** Multiply a raw VM duration value (seconds) by the configured multiplier (default 1000 → ms). */
  private toMs(val: number): number {
    return val * this.naming.trendUnitMultiplier;
  }

  /** Get label value from a VM metric label map, with a fallback. */
  private label(metric: Record<string, string>, key: string, fallback = ""): string {
    return metric[key] ?? fallback;
  }

  // ── fetchHttpReqsData ──────────────────────────────────────────────────────

  async fetchHttpReqsData(runId: string, startTime: string, endTime: string): Promise<HttpReqsRow[]> {
    logger.debug(`fetchHttpReqsData: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const S = this.naming.stepSeconds;

    const urlL = this.naming.urlLabel;
    const methodL = this.naming.methodLabel;
    const statusL = this.naming.statusLabel;
    const query = `sum by(${urlL},${methodL},${statusL})(increase(${this.counter("http_reqs")}${this.sel(runId)}[${S}s]))`;
    const series = await this.client.queryRange(query, startSec, endSec, S);

    logger.debug(`fetchHttpReqsData: query returned ${series.length} series`);
    if (!series.length) return [];

    const rows: HttpReqsRow[] = [];
    for (const s of series) {
      const url = this.label(s.metric, this.naming.urlLabel);
      const method = this.label(s.metric, this.naming.methodLabel);
      const status = parseInt(this.label(s.metric, this.naming.statusLabel, "0"), 10);

      for (const [tsSec, valStr] of s.values) {
        const count = Math.round(parseFloat(valStr));
        if (count <= 0) continue;
        const _time = new Date(tsSec * 1000).toISOString();
        for (let i = 0; i < count; i++) {
          rows.push({ _value: 1, _time, url, method, status });
        }
      }
    }

    logger.debug(`fetchHttpReqsData: synthesized ${rows.length} rows`);
    return rows;
  }

  // ── fetchHttpReqDurationData ───────────────────────────────────────────────

  async fetchHttpReqDurationData(runId: string, startTime: string, endTime: string): Promise<HttpReqDurationRow[]> {
    logger.debug(`fetchHttpReqDurationData: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const sel = this.sel(runId);

    // Step 1: counts per (url, method, status) — sum across instance_ids
    const urlL = this.naming.urlLabel;
    const methodL = this.naming.methodLabel;
    const statusL = this.naming.statusLabel;
    const S = this.naming.stepSeconds;
    const countQuery = `sum by(${urlL},${methodL},${statusL})(increase(${this.counter("http_reqs")}${sel}[${S}s]))`;
    const countRange = await this.client.queryRange(countQuery, startSec, endSec, S);

    if (!countRange.length) {
      logger.info("fetchHttpReqDurationData: no request count data, returning empty");
      return [];
    }

    // Collapse range count series to total per (url, method, status)
    const countSeries: VMInstantResult[] = countRange.map((s) => {
      const total = s.values.reduce((sum, [, v]) => sum + parseFloat(v), 0);
      return { metric: s.metric, value: [endSec, String(total)] };
    });

    // Step 2: per-stat series — range query then take last non-NaN value per series
    const statsToFetch = ["min", "p50", "p90", "p95", "max", "avg"] as const;
    const statResults = await Promise.all(
      statsToFetch.map(async (stat) => {
        const name = this.buildDurationStatMetric(stat);
        const agg = (stat === "min") ? "min" : (stat === "avg") ? "avg" : "max";
        const q = `${agg} by(${urlL},${methodL},${statusL})(${name}${sel})`;
        const range = await this.client.queryRange(q, startSec, endSec, S);
        // Collapse to last non-zero value per series
        const res: VMInstantResult[] = range.map((s) => {
          const last = [...s.values].reverse().find(([, v]) => parseFloat(v) > 0);
          return { metric: s.metric, value: last ?? [endSec, "0"] };
        });
        return { stat, res } as { stat: typeof statsToFetch[number]; res: VMInstantResult[] };
      })
    );

    // Build a map: key=(url|method|status) -> stats
    const statMap = new Map<string, {
      url: string; method: string; status: number;
      min: number; p50: number; p90: number; p95: number; max: number; avg: number;
    }>();

    for (const { stat, res } of statResults) {
      for (const s of res) {
        const url = this.label(s.metric, this.naming.urlLabel);
        const method = this.label(s.metric, this.naming.methodLabel);
        const status = parseInt(this.label(s.metric, this.naming.statusLabel, "0"), 10);
        const key = `${url}|${method}|${status}`;
        if (!statMap.has(key)) {
          statMap.set(key, { url, method, status, min: 0, p50: 0, p90: 0, p95: 0, max: 0, avg: 0 });
        }
        const entry = statMap.get(key)!;
        const val = this.toMs(parseFloat(s.value[1]));
        entry[stat] = val;
      }
    }

    // Build count map: key=(url|method|status) -> count
    const countMap = new Map<string, number>();
    for (const s of countSeries) {
      const url = this.label(s.metric, this.naming.urlLabel);
      const method = this.label(s.metric, this.naming.methodLabel);
      const status = parseInt(this.label(s.metric, this.naming.statusLabel, "0"), 10);
      const key = `${url}|${method}|${status}`;
      const existing = countMap.get(key) ?? 0;
      countMap.set(key, existing + Math.round(parseFloat(s.value[1])));
    }

    const rows: HttpReqDurationRow[] = [];

    for (const [key, stats] of statMap) {
      const count = countMap.get(key) ?? 1;
      const synthetic = synthesizeDurationRows(count, stats.min, stats.p50, stats.p90, stats.p95, stats.max);
      for (const val of synthetic) {
        rows.push({ _value: val, _avg: stats.avg, url: stats.url, method: stats.method, status: stats.status });
      }
    }

    logger.debug(`fetchHttpReqDurationData: synthesized ${rows.length} rows from ${statMap.size} groups`);
    return rows;
  }

  /** Build the exact metric name for a trend duration stat series. */
  private buildDurationStatMetric(stat: "min" | "p50" | "p90" | "p95" | "max" | "avg"): string {
    // base = k6_http_req_duration[_seconds]
    const base = this.metric("http_req_duration", true);
    // stat suffix: p50 -> _p50, min -> _min, avg -> _avg
    const suffix = `_${stat}`;
    return base + suffix;
  }

  // ── calculateTestDuration ──────────────────────────────────────────────────

  async calculateTestDuration(runId: string, startTime: string, endTime: string): Promise<DurationMetric> {
    logger.debug(`calculateTestDuration: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const S = this.naming.stepSeconds;

    const series = await this.client.queryRange(
      `${this.counter("http_reqs")}${this.sel(runId)}`,
      startSec,
      endSec,
      S
    );

    if (!series.length) {
      logger.info("calculateTestDuration: no data found, returning empty duration");
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    let minSec = Infinity;
    let maxSec = -Infinity;

    for (const s of series) {
      for (const [tsSec] of s.values) {
        if (tsSec < minSec) minSec = tsSec;
        if (tsSec > maxSec) maxSec = tsSec;
      }
    }

    if (!isFinite(minSec) || !isFinite(maxSec)) {
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const start = new Date(minSec * 1000).toISOString();
    const end = new Date(maxSec * 1000).toISOString();
    const durationSeconds = maxSec - minSec;

    logger.info(`calculateTestDuration: ${durationSeconds.toFixed(1)}s (${start} -> ${end})`);
    return { startTime: start, endTime: end, durationSeconds };
  }

  // ── extractVus ─────────────────────────────────────────────────────────────

  async extractVus(runId: string, startTime: string, endTime: string): Promise<VusMetric> {
    logger.debug(`extractVus: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const windowSec = endSec - startSec;
    const sel = this.sel(runId);
    const base = `${this.metric("vus")}${sel}`;

    const [minRes, maxRes] = await Promise.all([
      this.client.query(`min(min_over_time(${base}[${windowSec}s]))`, endSec),
      this.client.query(`sum(max_over_time(${base}[${windowSec}s]))`, endSec),
    ]);

    if (!minRes.length && !maxRes.length) {
      logger.info("extractVus: no data found, returning zeros");
      return { current: 0, min: 0, max: 0 };
    }

    const min = minRes.length ? parseFloat(minRes[0].value[1]) : 0;
    const max = maxRes.length ? parseFloat(maxRes[0].value[1]) : 0;
    logger.info(`extractVus: current=${max}, min=${min}, max=${max}`);
    return { current: max, min, max };
  }

  // ── extractVusMax ──────────────────────────────────────────────────────────

  async extractVusMax(runId: string, startTime: string, endTime: string): Promise<VusMaxMetric> {
    logger.debug(`extractVusMax: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const windowSec = endSec - startSec;
    const sel = this.sel(runId);
    const base = `${this.metric("vus_max")}${sel}`;

    const [minRes, maxRes] = await Promise.all([
      this.client.query(`min(min_over_time(${base}[${windowSec}s]))`, endSec),
      this.client.query(`sum(max_over_time(${base}[${windowSec}s]))`, endSec),
    ]);

    if (!minRes.length && !maxRes.length) {
      logger.info("extractVusMax: no data found, returning zeros");
      return { min: 0, max: 0 };
    }

    const min = minRes.length ? parseFloat(minRes[0].value[1]) : 0;
    const max = maxRes.length ? parseFloat(maxRes[0].value[1]) : 0;
    logger.info(`extractVusMax: min=${min}, max=${max}`);
    return { min, max };
  }

  // ── extractIterations ──────────────────────────────────────────────────────

  async extractIterations(runId: string, startTime: string, endTime: string): Promise<IterationsMetric> {
    logger.debug(`extractIterations: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const windowSec = endSec - startSec;

    const res = await this.client.query(
      `sum(increase(${this.counter("iterations")}${this.sel(runId)}[${windowSec}s]))`,
      endSec
    );

    if (!res.length) {
      logger.info("extractIterations: no data found, returning zeros");
      return { total: 0, rate: 0 };
    }

    const total = Math.round(parseFloat(res[0].value[1]));
    // DataCollector re-derives rate from duration (data-collector.ts:94-96); rate here is a reasonable estimate
    const rate = windowSec > 0 ? total / windowSec : 0;

    logger.info(`extractIterations: total=${total}, rate=${rate.toFixed(2)} iter/s`);
    return { total, rate };
  }

  // ── extractChecks ──────────────────────────────────────────────────────────

  async extractChecks(runId: string, startTime: string, endTime: string): Promise<ChecksMetric> {
    logger.debug(`extractChecks: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const windowSec = endSec - startSec;
    const sel = this.sel(runId);

    // k6_checks_rate has a `check` label per check name and is 0 or 1 per instance.
    // Aggregate: avg across instances per check name, then count passes (avg~=1) vs fails (avg~=0).
    const rateRes = await this.client.query(
      `avg by(${this.naming.checksLabel})(avg_over_time(${this.metric("checks_rate")}${sel}[${windowSec}s]))`,
      endSec
    );

    if (!rateRes.length) {
      logger.info("extractChecks: no data found, returning zeros");
      return { passes: 0, fails: 0, passRate: 0 };
    }

    // Each series = one named check. Rate is fraction passing [0,1] averaged over time & instances.
    const total = rateRes.length;
    const passes = rateRes.filter((r) => parseFloat(r.value[1]) >= 0.5).length;
    const fails = total - passes;
    const passRate = total > 0 ? (passes / total) * 100 : 0;

    logger.info(`extractChecks: passes=${passes}, fails=${fails}, passRate=${passRate.toFixed(2)}%`);
    return { passes, fails, passRate };
  }

  // ── extractIterationDuration ───────────────────────────────────────────────

  async extractIterationDuration(runId: string, startTime: string, endTime: string): Promise<IterationDurationMetric> {
    logger.debug(`extractIterationDuration: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const S = this.naming.stepSeconds;
    const sel = this.sel(runId);

    const statsToFetch = ["min", "p50", "p90", "p95", "max", "avg"] as const;
    const results = await Promise.all(
      statsToFetch.map(async (stat) => {
        const name = `${this.metric("iteration_duration")}_${stat}`;
        const agg = (stat === "min") ? "min" : (stat === "avg") ? "avg" : "max";
        const range = await this.client.queryRange(`${agg}(${name}${sel})`, startSec, endSec, S);
        const last = range.flatMap((s) => s.values).reverse().find(([, v]) => parseFloat(v) > 0);
        const val = last ? this.toMs(parseFloat(last[1])) : 0;
        return { stat, val };
      })
    );

    const get = (stat: string) => results.find((r) => r.stat === stat)?.val ?? 0;
    const avg = get("avg");
    const min = get("min");
    const med = get("p50");
    const p90 = get("p90");
    const p95 = get("p95");
    const max = get("max");

    if (!avg && !min && !max) {
      logger.info("extractIterationDuration: no data found, returning zeros");
      return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };
    }

    logger.info(`extractIterationDuration: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    return { avg, min, med, max, p90, p95 };
  }

  // ── extractErrorResponsesText ──────────────────────────────────────────────

  async extractErrorResponsesText(runId: string, startTime: string, endTime: string): Promise<ErrorResponsesTextMetric> {
    logger.debug(`extractErrorResponsesText: runId=${runId}, range=[${startTime}, ${endTime}]`);
    const { startSec, endSec } = resolveTimeRange(startTime, endTime);
    const windowSec = endSec - startSec;

    const res = await this.client.query(
      `increase(${this.naming.errorMetric}${this.sel(runId)}[${windowSec}s])`,
      endSec
    );

    logger.debug(`extractErrorResponsesText: query returned ${res.length} series`);

    if (!res.length) {
      logger.info("extractErrorResponsesText: no error response texts found");
      return { responses: [] };
    }

    const groupedErrors = new Map<string, ErrorResponseMetric>();

    for (const s of res) {
      const url = this.label(s.metric, this.naming.errorEndpointLabel);
      const method = this.label(s.metric, this.naming.errorMethodLabel);
      const status = parseInt(this.label(s.metric, this.naming.errorStatusLabel, "0"), 10);
      const error = this.label(s.metric, this.naming.errorErrLabel);
      const count = Math.round(parseFloat(s.value[1]));
      const key = `${method}|${url}|${status}`;

      if (groupedErrors.has(key)) {
        groupedErrors.get(key)!.count += count;
      } else {
        groupedErrors.set(key, { url, method, status, error, count });
      }
    }

    const responses = Array.from(groupedErrors.values())
      .sort((a, b) => b.count - a.count);

    logger.info(`extractErrorResponsesText: ${res.length} series grouped into ${responses.length} unique errors`);
    return { responses };
  }
}

// ── Duration row synthesis ─────────────────────────────────────────────────
//
// Given N (total request count) and k6-precomputed stats, build a sorted array
// of length N such that computations.ts's percentile() re-derives values
// matching the anchor stats as closely as possible.
//
// percentile(arr, p) = arr[Math.ceil(p/100 * arr.length) - 1]
//
// We place exact k6 values at the anchor indices, then linear-interpolate the
// gaps. avg is not reproducible exactly; accepted per design.

export function synthesizeDurationRows(
  count: number,
  min: number,
  p50: number,
  p90: number,
  p95: number,
  max: number
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [p50 || min || max || 0];

  const N = count;

  // Clamp: ensure monotonic non-decreasing
  const safeP50 = Math.max(min, p50);
  const safeP90 = Math.max(safeP50, p90);
  const safeP95 = Math.max(safeP90, p95);
  const safeMax = Math.max(safeP95, max);

  if (N < 4) {
    // Not enough slots to honor all anchors; fill best-effort
    const arr: number[] = [];
    for (let i = 0; i < N; i++) {
      const frac = N === 1 ? 0.5 : i / (N - 1);
      arr.push(lerp(min, safeMax, frac));
    }
    // Overwrite p50 slot if room
    if (N >= 2) {
      const i50 = Math.max(0, Math.ceil(0.5 * N) - 1);
      arr[i50] = safeP50;
    }
    return arr;
  }

  // Anchor indices (0-based)
  const i0 = 0;
  const i50 = Math.max(0, Math.ceil(0.5 * N) - 1);
  const i90 = Math.max(0, Math.ceil(0.9 * N) - 1);
  const i95 = Math.max(0, Math.ceil(0.95 * N) - 1);
  const iMax = N - 1;

  // Deduplicated sorted anchors
  const anchors = dedupeAnchors([
    [i0, min],
    [i50, safeP50],
    [i90, safeP90],
    [i95, safeP95],
    [iMax, safeMax],
  ]);

  // Allocate and fill by piecewise-linear interpolation
  const arr = new Array<number>(N).fill(0);
  for (let seg = 0; seg < anchors.length - 1; seg++) {
    const [startIdx, startVal] = anchors[seg];
    const [endIdx, endVal] = anchors[seg + 1];
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const t = endIdx === startIdx ? 0 : (idx - startIdx) / (endIdx - startIdx);
      arr[idx] = lerp(startVal, endVal, t);
    }
  }

  return arr;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deduplicate anchors by index: if two anchors share an index, keep the one with the larger value (more extreme). */
function dedupeAnchors(anchors: [number, number][]): [number, number][] {
  const map = new Map<number, number>();
  for (const [idx, val] of anchors) {
    map.set(idx, Math.max(map.get(idx) ?? -Infinity, val));
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
