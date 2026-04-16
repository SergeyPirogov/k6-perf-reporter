import { InfluxDB, QueryApi } from "@influxdata/influxdb-client";
import { InfluxConfig } from "../../config";
import { logger } from "../../logger";

export interface QueryRow {
  values: (string | number | boolean | null)[];
  tableMeta?: {
    columns: Array<{ label: string }>;
  };
}

export class InfluxClient {
  private influxDB: InfluxDB;
  private queryApi: QueryApi;

  constructor(config: InfluxConfig) {
    this.influxDB = new InfluxDB({
      url: config.url,
      token: config.token,
    });
    this.queryApi = this.influxDB.getQueryApi(config.org);
  }

  async queryData(
    flux: string
  ): Promise<Array<Record<string, string | number | boolean | null>>> {
    const result: Array<Record<string, string | number | boolean | null>> = [];
    logger.debug(`InfluxClient.queryData: executing query\n${flux.trim()}`);
    const start = Date.now();

    return new Promise<Array<Record<string, string | number | boolean | null>>>(
      (resolve, reject) => {
        this.queryApi.queryRows(flux, {
          next: (row: string[], tableMeta) => {
            const record: Record<string, string | number | boolean | null> = {};
            tableMeta.columns.forEach((col, index) => {
              record[col.label] = row[index];
            });
            result.push(record);
          },
          error: (error: Error) => {
            logger.error(`InfluxClient.queryData: query failed after ${Date.now() - start}ms — ${error.message}`);
            reject(error);
          },
          complete: () => {
            logger.debug(`InfluxClient.queryData: query returned ${result.length} rows in ${Date.now() - start}ms`);
            resolve(result);
          },
        });
      }
    );
  }
}
