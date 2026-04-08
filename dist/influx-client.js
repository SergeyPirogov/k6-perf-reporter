"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfluxDBClient = void 0;
const influxdb_client_1 = require("@influxdata/influxdb-client");
class InfluxDBClient {
    constructor(config) {
        this.client = new influxdb_client_1.InfluxDB({
            url: config.url,
            token: config.token,
        });
        this.queryApi = this.client.getQueryApi(config.org);
    }
    async query(fluxQuery) {
        const results = [];
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            this.queryApi.queryRows(fluxQuery, {
                next: (row, tableMeta) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
                    const obj = tableMeta.toObject(row);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    results.push(obj);
                },
                error: (error) => {
                    reject(error);
                },
                complete: () => {
                    resolve(results);
                },
            });
        });
    }
}
exports.InfluxDBClient = InfluxDBClient;
//# sourceMappingURL=influx-client.js.map