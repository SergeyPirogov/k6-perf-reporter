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

  private constructor(configPath: string = ".config.json") {
    const fullPath = path.resolve(configPath);
    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    this.config = data.influx;
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
