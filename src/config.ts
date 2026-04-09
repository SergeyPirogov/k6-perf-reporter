import fs from "fs";
import path from "path";

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export class Config {
  private static instance: Config;
  private config: InfluxConfig;

  private constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  private loadConfig(configPath?: string): InfluxConfig {
    // Try to load from JSON file first
    const filePath = configPath || ".config.json";
    const fullPath = path.resolve(filePath);
    let config: InfluxConfig;

    if (fs.existsSync(fullPath)) {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      config = data.influx;
    } else {
      // If file doesn't exist, try to load from env vars
      const envConfig = this.loadFromEnv();
      if (!envConfig) {
        throw new Error(
          `Config file not found at ${fullPath} and no environment variables set. ` +
          `Set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET or provide a config file.`
        );
      }
      return envConfig;
    }

    // Override with environment variables if they exist
    return this.overrideWithEnv(config);
  }

  private loadFromEnv(): InfluxConfig | null {
    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    // Only return if all env vars are set
    if (url && token && org && bucket) {
      return { url, token, org, bucket };
    }

    return null;
  }

  private overrideWithEnv(config: InfluxConfig): InfluxConfig {
    return {
      url: process.env.INFLUX_URL || config.url,
      token: process.env.INFLUX_TOKEN || config.token,
      org: process.env.INFLUX_ORG || config.org,
      bucket: process.env.INFLUX_BUCKET || config.bucket,
    };
  }

  static getInstance(configPath?: string): Config {
    if (!Config.instance) {
      Config.instance = new Config(configPath);
    }
    return Config.instance;
  }

  getConfig(): InfluxConfig {
    return this.config;
  }
}
