import fs from "fs";
import path from "path";

export interface ConfigFile {
  influx: {
    url: string;
    token: string;
    org: string;
    bucket: string;
  };
}

export class Config {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static instance: Config | undefined;
  private config: ConfigFile;

  private constructor(configPath?: string) {
    const resolvedPath =
      configPath || path.join(process.cwd(), ".config.json");

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `Config file not found at ${resolvedPath}. Copy .config.example.json to .config.json and fill in your values.`
      );
    }

    const rawConfig = fs.readFileSync(resolvedPath, "utf-8");
    this.config = JSON.parse(rawConfig) as ConfigFile;

    // Replace environment variables in config
    this.config.influx.token = this.replaceEnvVars(
      this.config.influx.token
    );
    this.config.influx.url = this.replaceEnvVars(this.config.influx.url);
    this.config.influx.org = this.replaceEnvVars(this.config.influx.org);
    this.config.influx.bucket = this.replaceEnvVars(
      this.config.influx.bucket
    );

    this.validate();
  }

  private replaceEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_match: string, envVar: string) => {
      const envValue = process.env[envVar];
      if (!envValue) {
        throw new Error(
          `Environment variable ${envVar} is not set. Please set it before running the command.`
        );
      }
      return envValue;
    });
  }

  private validate(): void {
    const { influx } = this.config;

    if (!influx.url) throw new Error("Config: influx.url is required");
    if (!influx.token) throw new Error("Config: influx.token is required");
    if (!influx.org) throw new Error("Config: influx.org is required");
    if (!influx.bucket) throw new Error("Config: influx.bucket is required");
  }

  static getInstance(configPath?: string): Config {
    if (!Config.instance) {
      Config.instance = new Config(configPath);
    }
    return Config.instance;
  }

  static reset(): void {
    Config.instance = undefined;
  }

  getInfluxConfig() {
    return {
      url: this.config.influx.url,
      token: this.config.influx.token,
      org: this.config.influx.org,
      bucket: this.config.influx.bucket,
    };
  }

  getConfig(): ConfigFile {
    return this.config;
  }
}
