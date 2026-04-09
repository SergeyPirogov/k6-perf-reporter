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
    // Try to load from environment variables first
    const envConfig = this.loadFromEnv();
    if (envConfig) {
      return envConfig;
    }

    // Fall back to JSON file
    const filePath = configPath || ".config.json";
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(
        `Config file not found at ${fullPath} and no environment variables set. ` +
        `Set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET or provide a config file.`
      );
    }

    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    return data.influx;
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
