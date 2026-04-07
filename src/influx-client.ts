import { InfluxDB } from "@influxdata/influxdb-client";

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export interface QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface TableMeta {
  columns: Array<{ name: string; label: string; type: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toObject(row: string[]): any;
}

export class InfluxDBClient {
  private client: InfluxDB;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queryApi: any;

  constructor(config: InfluxConfig) {
    this.client = new InfluxDB({
      url: config.url,
      token: config.token,
    });
    this.queryApi = this.client.getQueryApi(config.org);
  }

  async query(fluxQuery: string): Promise<QueryResult[]> {
    const results: QueryResult[] = [];

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.queryApi.queryRows(fluxQuery, {
        next: (row: string[], tableMeta: TableMeta) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
          const obj = tableMeta.toObject(row);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          results.push(obj);
        },
        error: (error: Error) => {
          reject(error);
        },
        complete: () => {
          resolve(results);
        },
      });
    });
  }

}
