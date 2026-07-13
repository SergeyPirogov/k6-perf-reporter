import fs from "fs";
import path from "path";

export type DataSourceType = "influxdb" | "prometheus" | "victoriametrics";

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export interface VictoriaMetricsConfig {
  url: string;
  token?: string;
}

export interface SlackConfig {
  token: string;
  channel: string;
}

export interface CacheConfig {
  ttl: number;
}

export interface GrafanaConfig {
  dashboardUrl: string;
}

interface RawConfig {
  dataSource?: string;
  influx?: Record<string, unknown>;
  victoriametrics?: Record<string, unknown>;
  slack?: Record<string, unknown>;
  cache?: Record<string, unknown>;
  ignoredStatusCodes?: unknown;
  grafana?: Record<string, unknown>;
}

export class Config {
  private static instance: Config;
  private dataSourceType: DataSourceType;
  private rawInflux: Record<string, unknown> | undefined;
  private rawVictoriaMetrics: Record<string, unknown> | undefined;
  private slackConfig: SlackConfig | null = null;
  private cacheConfig: CacheConfig;
  private configPath: string;
  private ignoredStatusCodes: number[];
  private grafanaConfig: GrafanaConfig | null = null;

  private constructor(configPath?: string) {
    this.configPath = configPath || ".config.json";
    const rawConfig = this.loadRawConfig();
    this.dataSourceType = this.parseDataSourceType(rawConfig.dataSource);
    this.rawInflux = rawConfig.influx;
    this.rawVictoriaMetrics = rawConfig.victoriametrics;
    this.slackConfig = this.parseSlackConfig(rawConfig.slack);
    this.cacheConfig = this.parseCacheConfig(rawConfig.cache);
    this.ignoredStatusCodes = this.parseIgnoredStatusCodes(rawConfig.ignoredStatusCodes);
    this.grafanaConfig = this.parseGrafanaConfig(rawConfig.grafana);
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
    const url = this.resolveValue(
      this.rawVictoriaMetrics?.url as string | undefined,
      "VM_URL"
    );
    if (!url) {
      throw new Error(
        "VictoriaMetrics configuration is incomplete. " +
        "Set VM_URL via environment variable or config file."
      );
    }
    const token = this.resolveValue(
      this.rawVictoriaMetrics?.token as string | undefined,
      "VM_TOKEN"
    );
    return { url, token: token ?? undefined };
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

  private parseGrafanaConfig(rawConfig: Record<string, unknown> | undefined): GrafanaConfig | null {
    const dashboardUrl = this.resolveValue(rawConfig?.dashboardUrl as string | undefined, "GRAFANA_DASHBOARD_URL");
    if (!dashboardUrl) {
      return null;
    }
    return { dashboardUrl };
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

  getGrafanaConfig(): GrafanaConfig | null {
    return this.grafanaConfig;
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
