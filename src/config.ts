import fs from "fs";
import path from "path";

export type DataSourceType = "influxdb" | "prometheus" | "victoriametrics";

export interface VictoriaMetricsAuth {
  username?: string;
  password?: string;
  token?: string;
}

export interface VictoriaMetricsNaming {
  metricPrefix: string;
  counterSuffix: string;
  runIdLabel: string;
  urlLabel: string;
  methodLabel: string;
  statusLabel: string;
  trendStatSuffixFormat: "underscore" | "paren";
  trendUnitSuffix: string;
  trendUnitMultiplier: number;
  errorMetric: string;
  errorEndpointLabel: string;
  errorStatusLabel: string;
  errorErrLabel: string;
  errorMethodLabel: string;
  checksLabel: string;
  stepSeconds: number;
}

export interface VictoriaMetricsConfig {
  url: string;
  auth?: VictoriaMetricsAuth;
  naming: VictoriaMetricsNaming;
}

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export interface SlackConfig {
  token: string;
  channel: string;
}

export interface CacheConfig {
  ttl: number;
}

interface RawConfig {
  dataSource?: string;
  influx?: Record<string, unknown>;
  victoriametrics?: Record<string, unknown>;
  slack?: Record<string, unknown>;
  cache?: Record<string, unknown>;
  ignoredStatusCodes?: unknown;
}

export class Config {
  private static instance: Config;
  private dataSourceType: DataSourceType;
  private rawInflux: Record<string, unknown> | undefined;
  private rawVictoria: Record<string, unknown> | undefined;
  private slackConfig: SlackConfig | null = null;
  private cacheConfig: CacheConfig;
  private configPath: string;
  private ignoredStatusCodes: number[];

  private constructor(configPath?: string) {
    this.configPath = configPath || ".config.json";
    const rawConfig = this.loadRawConfig();
    this.dataSourceType = this.parseDataSourceType(rawConfig.dataSource);
    this.rawInflux = rawConfig.influx;
    this.rawVictoria = rawConfig.victoriametrics;
    this.slackConfig = this.parseSlackConfig(rawConfig.slack);
    this.cacheConfig = this.parseCacheConfig(rawConfig.cache);
    this.ignoredStatusCodes = this.parseIgnoredStatusCodes(rawConfig.ignoredStatusCodes);
  }

  private loadRawConfig(): RawConfig {
    const fullPath = path.resolve(this.configPath);

    // Load from config file if it exists
    if (fs.existsSync(fullPath)) {
      try {
        return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as RawConfig;
      } catch (error) {
        throw new Error(`Failed to parse config file at ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {};
  }

  private parseDataSourceType(raw: string | undefined): DataSourceType {
    const envValue = process.env["DATASOURCE"];
    const value = envValue || raw || "influxdb";
    if (value !== "influxdb" && value !== "prometheus" && value !== "victoriametrics") {
      throw new Error(`Unknown datasource type: '${value}'. Supported: influxdb, prometheus, victoriametrics`);
    }
    return value;
  }

  getInfluxConfig(): InfluxConfig {
    const url = this.resolveValue(this.rawInflux?.url as string | undefined, "INFLUX_URL");
    const token = this.resolveValue(this.rawInflux?.token as string | undefined, "INFLUX_TOKEN");
    const org = this.resolveValue(this.rawInflux?.org as string | undefined, "INFLUX_ORG");
    const bucket = this.resolveValue(this.rawInflux?.bucket as string | undefined, "INFLUX_BUCKET");

    if (!url || !token || !org || !bucket) {
      throw new Error(
        "InfluxDB configuration is incomplete. " +
        "Set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET via environment variables or config file."
      );
    }

    return { url, token, org, bucket };
  }

  getVictoriaMetricsConfig(): VictoriaMetricsConfig {
    const url = this.resolveValue(this.rawVictoria?.url as string | undefined, "VM_URL");

    if (!url) {
      throw new Error(
        "VictoriaMetrics configuration is incomplete. " +
        "Set VM_URL via environment variable or configure in config file."
      );
    }

    const username = this.resolveValue(
      (this.rawVictoria?.auth as Record<string, unknown> | undefined)?.username as string | undefined,
      "VM_USERNAME"
    );
    const password = this.resolveValue(
      (this.rawVictoria?.auth as Record<string, unknown> | undefined)?.password as string | undefined,
      "VM_PASSWORD"
    );
    const token = this.resolveValue(
      (this.rawVictoria?.auth as Record<string, unknown> | undefined)?.token as string | undefined,
      "VM_TOKEN"
    );

    const auth: VictoriaMetricsAuth | undefined =
      token || username ? { ...(token ? { token } : {}), ...(username ? { username } : {}), ...(password ? { password } : {}) } : undefined;

    const rawNaming = this.rawVictoria?.naming as Record<string, unknown> | undefined;
    const naming = this.resolveNaming(rawNaming);

    return { url, ...(auth ? { auth } : {}), naming };
  }

  private resolveNaming(raw: Record<string, unknown> | undefined): VictoriaMetricsNaming {
    const str = (key: string, envVar: string, defaultVal: string): string =>
      this.resolveValue(raw?.[key] as string | undefined, envVar) ?? defaultVal;

    const num = (key: string, envVar: string, defaultVal: number): number => {
      const envVal = process.env[envVar];
      if (envVal) return parseFloat(envVal);
      const cfgVal = raw?.[key];
      if (typeof cfgVal === "number") return cfgVal;
      return defaultVal;
    };

    const suffixFormat = str("trendStatSuffixFormat", "VM_TREND_STAT_SUFFIX_FORMAT", "underscore");

    return {
      metricPrefix: str("metricPrefix", "VM_METRIC_PREFIX", "k6_"),
      counterSuffix: str("counterSuffix", "VM_COUNTER_SUFFIX", "_total"),
      runIdLabel: str("runIdLabel", "VM_RUNID_LABEL", "runId"),
      urlLabel: str("urlLabel", "VM_URL_LABEL", "name"),
      methodLabel: str("methodLabel", "VM_METHOD_LABEL", "method"),
      statusLabel: str("statusLabel", "VM_STATUS_LABEL", "status"),
      trendStatSuffixFormat: (suffixFormat === "paren" ? "paren" : "underscore") as "underscore" | "paren",
      trendUnitSuffix: str("trendUnitSuffix", "VM_TREND_UNIT_SUFFIX", ""),
      trendUnitMultiplier: num("trendUnitMultiplier", "VM_TREND_UNIT_MULTIPLIER", 1000),
      errorMetric: str("errorMetric", "VM_ERROR_METRIC", "k6_error_responses_total"),
      errorEndpointLabel: str("errorEndpointLabel", "VM_ERROR_ENDPOINT_LABEL", "endpoint"),
      errorStatusLabel: str("errorStatusLabel", "VM_ERROR_STATUS_LABEL", "status"),
      errorErrLabel: str("errorErrLabel", "VM_ERROR_ERR_LABEL", "err"),
      errorMethodLabel: str("errorMethodLabel", "VM_ERROR_METHOD_LABEL", "method"),
      checksLabel: str("checksLabel", "VM_CHECKS_LABEL", "check"),
      stepSeconds: num("stepSeconds", "VM_STEP_SECONDS", 1),
    };
  }

  private parseSlackConfig(rawConfig: Record<string, unknown> | undefined): SlackConfig | null {
    const token = this.resolveValue(rawConfig?.token as string | undefined, "SLACK_TOKEN");
    if (!token) {
      return null;
    }

    const channel = this.resolveValue(rawConfig?.channel as string | undefined, "SLACK_CHANNEL");
    if (!channel) {
      throw new Error(
        "Slack channel is required and cannot be empty. " +
        "Set SLACK_CHANNEL via environment variable or configure in config file."
      );
    }

    return { token, channel };
  }

  private parseCacheConfig(rawConfig: Record<string, unknown> | undefined): CacheConfig {
    const DEFAULT_TTL = 3600;
    const envTtl = process.env["CACHE_TTL"];
    if (envTtl) {
      return { ttl: parseInt(envTtl, 10) };
    }
    const ttl = rawConfig?.ttl;
    if (typeof ttl === "number") {
      return { ttl };
    }
    return { ttl: DEFAULT_TTL };
  }

  private parseIgnoredStatusCodes(raw: unknown): number[] {
    const envValue = process.env["IGNORE_STATUS_CODES"];
    if (envValue) {
      return envValue.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    }
    if (Array.isArray(raw)) {
      return raw.filter((v) => typeof v === "number") as number[];
    }
    return [];
  }

  private resolveValue(configValue: string | undefined, envVar: string): string | null {
    // First check environment variable (takes priority)
    const envValue = process.env[envVar];
    if (envValue) {
      return envValue;
    }

    // Fall back to config value
    return configValue || null;
  }

  getIgnoredStatusCodes(): number[] {
    return this.ignoredStatusCodes;
  }

  static getInstance(configPath?: string): Config {
    if (!Config.instance) {
      Config.instance = new Config(configPath);
    }
    return Config.instance;
  }

  getDataSourceType(): DataSourceType {
    return this.dataSourceType;
  }

  getSlackConfig(): SlackConfig | null {
    return this.slackConfig;
  }

  getCacheConfig(): CacheConfig {
    return this.cacheConfig;
  }
}
