import fs from "fs";
import path from "path";

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

interface RawConfig {
  influx?: Record<string, unknown>;
  slack?: Record<string, unknown>;
}

export class Config {
  private static instance: Config;
  private influxConfig: InfluxConfig;
  private slackConfig: SlackConfig | null = null;
  private configPath: string;

  private constructor(configPath?: string) {
    this.configPath = configPath || ".config.json";
    const rawConfig = this.loadRawConfig();
    this.influxConfig = this.parseInfluxConfig(rawConfig.influx);
    this.slackConfig = this.parseSlackConfig(rawConfig.slack);
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

  private parseInfluxConfig(rawConfig: Record<string, unknown> | undefined): InfluxConfig {
    const url = this.resolveValue(rawConfig?.url as string | undefined, "INFLUX_URL");
    const token = this.resolveValue(rawConfig?.token as string | undefined, "INFLUX_TOKEN");
    const org = this.resolveValue(rawConfig?.org as string | undefined, "INFLUX_ORG");
    const bucket = this.resolveValue(rawConfig?.bucket as string | undefined, "INFLUX_BUCKET");

    if (!url || !token || !org || !bucket) {
      throw new Error(
        "InfluxDB configuration is incomplete. " +
        "Set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET via environment variables or config file."
      );
    }

    return { url, token, org, bucket };
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

  private resolveValue(configValue: string | undefined, envVar: string): string | null {
    // First check environment variable (takes priority)
    const envValue = process.env[envVar];
    if (envValue) {
      return envValue;
    }

    // Fall back to config value
    return configValue || null;
  }

  static getInstance(configPath?: string): Config {
    if (!Config.instance) {
      Config.instance = new Config(configPath);
    }
    return Config.instance;
  }

  getInfluxConfig(): InfluxConfig {
    return this.influxConfig;
  }

  getSlackConfig(): SlackConfig | null {
    return this.slackConfig;
  }
}
