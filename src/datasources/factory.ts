import { DataSource } from "./datasource";
import { InfluxDataSource } from "./influx";
import { Config, DataSourceType } from "../config";
import { logger } from "../logger";

export function createDataSource(type: DataSourceType, config: Config): DataSource {
  logger.info(`createDataSource: type=${type}`);
  switch (type) {
    case "influxdb": {
      const influxConfig = config.getInfluxConfig();
      return new InfluxDataSource(influxConfig);
    }
    case "prometheus":
      throw new Error("Prometheus datasource is not yet implemented");
    default:
      throw new Error(`Unknown datasource type: ${type}`);
  }
}
