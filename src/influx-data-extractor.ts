import { InfluxClient } from "./influx-client";
import { InfluxConfig } from "./config";

export class InfluxDataExtractor {
  private client: InfluxClient;

  constructor(config: InfluxConfig) {
    this.client = new InfluxClient(config);
  }
}
