"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const influxdb_client_1 = require("@influxdata/influxdb-client");
const influxDB = new influxdb_client_1.InfluxDB({
    url: "https://influx.cmn.monomarket.tech",
    token: "JFP9pZu3Sp134rkCZ6gT7FtSBmQRWgl8VmVhFMHTXrbkhKQ3LrvrM4FXECR7Lr8MsDGWLIsU7IJFcjL_QHwvqA==",
});
const queryApi = influxDB.getQueryApi("ced1cdfb28534a3e");
const flux = `
from(bucket: "jmeter")
  |> range(start: 2026-04-02T21:17:28.487Z, stop: 2026-04-02T21:22:02.858Z)
  |> group(columns: ["_measurement", "_field"])
  |> first()
`;
queryApi.queryRows(flux, {
    next: (row, tableMeta) => {
        const o = tableMeta.toObject(row);
        console.log(JSON.stringify(o, null, 2));
    },
    error: (error) => {
        console.error("Error:", error);
    },
    complete: () => {
        console.log("Query completed");
    },
});
//# sourceMappingURL=explore.js.map