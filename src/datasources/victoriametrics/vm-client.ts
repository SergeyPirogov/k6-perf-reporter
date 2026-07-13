import { VictoriaMetricsConfig } from "../../config";
import { logger } from "../../logger";

export interface VmInstantResult {
  metric: Record<string, string>;
  value: [number, string];
}

export interface VmRangeResult {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

interface VmInstantResponse {
  status: string;
  data: {
    resultType: string;
    result: VmInstantResult[];
  };
}

interface VmRangeResponse {
  status: string;
  data: {
    resultType: string;
    result: VmRangeResult[];
  };
}

function resolveTime(t: string): string {
  if (t === "now()") return String(Math.floor(Date.now() / 1000));
  // InfluxDB relative duration: -24h, -1h, -30m etc → Unix seconds
  const rel = /^-(\d+)(ms|s|m|h|d|w)$/.exec(t);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const mult: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
    return String(Math.floor(Date.now() / 1000) - Math.round(n * (mult[unit] ?? 1)));
  }
  return t;
}

export class VmClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: VictoriaMetricsConfig) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.token) {
      this.headers["Authorization"] = `Bearer ${config.token}`;
    }
  }

  async queryInstant(query: string, time?: string): Promise<VmInstantResult[]> {
    const params = new URLSearchParams({ query });
    if (time) params.set("time", resolveTime(time));
    const url = `${this.baseUrl}/api/v1/query?${params.toString()}`;
    logger.debug(`VmClient.queryInstant: ${query}`);
    const start = Date.now();

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VictoriaMetrics query failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as VmInstantResponse;
    logger.debug(`VmClient.queryInstant: ${json.data.result.length} results in ${Date.now() - start}ms`);
    return json.data.result;
  }

  async queryRange(
    query: string,
    start: string,
    end: string,
    step = "15s"
  ): Promise<VmRangeResult[]> {
    const params = new URLSearchParams({ query, start: resolveTime(start), end: resolveTime(end), step });
    const url = `${this.baseUrl}/api/v1/query_range?${params.toString()}`;
    logger.debug(`VmClient.queryRange: ${query}`);
    const t = Date.now();

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VictoriaMetrics range query failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as VmRangeResponse;
    logger.debug(`VmClient.queryRange: ${json.data.result.length} series in ${Date.now() - t}ms`);
    return json.data.result;
  }
}
