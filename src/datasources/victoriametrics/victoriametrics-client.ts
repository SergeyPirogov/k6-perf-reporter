import { VictoriaMetricsConfig } from "../../config";
import { logger } from "../../logger";

export interface VMInstantResult {
  metric: Record<string, string>;
  value: [number, string];
}

export interface VMRangeResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface VMResponse<T> {
  status: string;
  data: { result: T[] };
  error?: string;
  errorType?: string;
}

/**
 * Translate a Flux-style time token (as passed by cli.ts / DataCollector) into a Unix second timestamp.
 * Supported forms: "now()", "-1h", "-30m", "-1d", ISO-8601 strings.
 */
export function resolveTimeSec(token: string): number {
  const t = token.trim();

  if (t === "now()" || t === "") {
    return Math.floor(Date.now() / 1000);
  }

  // Relative: -<n><unit>  e.g. -1h, -30m, -7d, -60s
  const rel = t.match(/^-(\d+(?:\.\d+)?)([smhd])$/);
  if (rel) {
    const n = parseFloat(rel[1]);
    const unit = rel[2];
    const factors: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return Math.floor(Date.now() / 1000) - Math.round(n * factors[unit]);
  }

  // ISO-8601 or any Date-parseable string
  const ms = Date.parse(t);
  if (!isNaN(ms)) {
    return Math.floor(ms / 1000);
  }

  throw new Error(`VictoriaMetricsClient: cannot parse time token '${token}'`);
}

export function resolveTimeRange(
  startToken: string,
  endToken: string
): { startSec: number; endSec: number } {
  return {
    startSec: resolveTimeSec(startToken),
    endSec: resolveTimeSec(endToken),
  };
}

export class VictoriaMetricsClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(private config: VictoriaMetricsConfig) {
    // Normalize: strip trailing slash
    this.baseUrl = config.url.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/x-www-form-urlencoded" };

    if (config.auth?.token) {
      this.headers["Authorization"] = `Bearer ${config.auth.token}`;
    } else if (config.auth?.username) {
      const creds = Buffer.from(`${config.auth.username}:${config.auth.password ?? ""}`).toString("base64");
      this.headers["Authorization"] = `Basic ${creds}`;
    }
  }

  /** Instant query: POST /api/v1/query */
  async query(promql: string, timeSec?: number): Promise<VMInstantResult[]> {
    const params = new URLSearchParams({ query: promql });
    if (timeSec !== undefined) params.set("time", String(timeSec));

    logger.debug(`VictoriaMetricsClient.query: ${promql.trim()}`);
    const start = Date.now();

    const res = await fetch(`${this.baseUrl}/api/v1/query`, {
      method: "POST",
      headers: this.headers,
      body: params,
    });

    const json = (await res.json()) as VMResponse<VMInstantResult>;
    logger.debug(`VictoriaMetricsClient.query: ${json.data?.result?.length ?? 0} series in ${Date.now() - start}ms`);

    if (json.status !== "success") {
      throw new Error(`VM query failed (${json.errorType ?? "?"}): ${json.error ?? "unknown error"}`);
    }
    return json.data?.result ?? [];
  }

  /** Range query: POST /api/v1/query_range */
  async queryRange(
    promql: string,
    startSec: number,
    endSec: number,
    stepSec: number
  ): Promise<VMRangeResult[]> {
    const params = new URLSearchParams({
      query: promql,
      start: String(startSec),
      end: String(endSec),
      step: String(stepSec),
    });

    logger.debug(`VictoriaMetricsClient.queryRange: ${promql.trim()} [${startSec}, ${endSec}] step=${stepSec}`);
    const start = Date.now();

    const res = await fetch(`${this.baseUrl}/api/v1/query_range`, {
      method: "POST",
      headers: this.headers,
      body: params,
    });

    const json = (await res.json()) as VMResponse<VMRangeResult>;
    logger.debug(`VictoriaMetricsClient.queryRange: ${json.data?.result?.length ?? 0} series in ${Date.now() - start}ms`);

    if (json.status !== "success") {
      throw new Error(`VM query_range failed (${json.errorType ?? "?"}): ${json.error ?? "unknown error"}`);
    }
    return json.data?.result ?? [];
  }
}
