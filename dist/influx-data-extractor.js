"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfluxDataExtractor = void 0;
const influxdb_client_1 = require("@influxdata/influxdb-client");
const chalk_1 = __importDefault(require("chalk"));
class InfluxDataExtractor {
    constructor(config) {
        this.config = config;
        this.influxDB = new influxdb_client_1.InfluxDB({
            url: config.url,
            token: config.token,
        });
    }
    async queryMetrics(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => ${this.buildRunIdFilter(runId)})
`;
        const metricsData = [];
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    metricsData.push({
                        timestamp: new Date(o._time),
                        metric: o._field,
                        value: o._value,
                        tags: {
                            scenario: o.scenario,
                        },
                    });
                },
                error: (error) => reject(error),
                complete: () => resolve(metricsData),
            });
        });
    }
    async getResponseTimePercentiles(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const queries = [
            { name: 'p50', query: `from(bucket: "${this.config.bucket}") |> range(start: ${startTime}, stop: ${endTime}) |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)}) |> quantile(q: 0.5)` },
            { name: 'p95', query: `from(bucket: "${this.config.bucket}") |> range(start: ${startTime}, stop: ${endTime}) |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)}) |> quantile(q: 0.95)` },
            { name: 'p99', query: `from(bucket: "${this.config.bucket}") |> range(start: ${startTime}, stop: ${endTime}) |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)}) |> quantile(q: 0.99)` },
        ];
        const results = { p50: 0, p95: 0, p99: 0 };
        let completed = 0;
        return new Promise((resolve, reject) => {
            queries.forEach(({ name, query }) => {
                queryApi.queryRows(query, {
                    next: (row, tableMeta) => {
                        const o = tableMeta.toObject(row);
                        if (typeof o._value === "number") {
                            results[name] = o._value;
                        }
                    },
                    error: (error) => {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        console.error(chalk_1.default.red(`        ✗ Error querying ${name}: ${errorMsg}`));
                        reject(error);
                    },
                    complete: () => {
                        completed++;
                        if (completed === queries.length) {
                            console.log(chalk_1.default.gray(`        ✓ Retrieved response time percentiles - p50=${results.p50.toFixed(2)}ms, p95=${results.p95.toFixed(2)}ms, p99=${results.p99.toFixed(2)}ms`));
                            resolve({
                                p50: results.p50,
                                p95: results.p95,
                                p99: results.p99,
                            });
                        }
                    },
                });
            });
        });
    }
    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil(sortedValues.length * percentile) - 1;
        return sortedValues[Math.max(0, index)] || 0;
    }
    buildRunIdFilter(runId) {
        return runId ? `r.runId == "${runId}"` : "true";
    }
    async getRequestStats(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        // Count total requests
        const totalFlux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["_measurement"])
  |> count()
`;
        let total = 0;
        let failed = 0;
        return new Promise((resolve, reject) => {
            queryApi.queryRows(totalFlux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    total = o._value || 0;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying total requests: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    console.log(chalk_1.default.gray(`        ✓ Total requests: ${total}`));
                    // Count failed requests (where http_req_failed value is 1)
                    const failedFlux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_failed" and ${this.buildRunIdFilter(runId)} and r._value == 1)
  |> group(columns: ["_measurement"])
  |> count()
`;
                    queryApi.queryRows(failedFlux, {
                        next: (row, tableMeta) => {
                            const o = tableMeta.toObject(row);
                            failed = o._value || 0;
                        },
                        error: (error) => {
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            console.error(chalk_1.default.red(`        ✗ Error querying failed requests: ${errorMsg}`));
                            reject(error);
                        },
                        complete: () => {
                            const success = Math.max(0, total - failed);
                            console.log(chalk_1.default.gray(`        ✓ Request breakdown: ${success} success, ${failed} failed`));
                            resolve({ total, success, failed });
                        },
                    });
                },
            });
        });
    }
    async getErrorBreakdown(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "error_responses" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["status"])
  |> count()
`;
        const errors = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const status = o.status || "unknown";
                    errors[status] = o._value || 0;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying error breakdown: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    console.log(chalk_1.default.gray(`        ✓ Error breakdown: ${Object.keys(errors).length} unique error codes found`));
                    resolve(errors);
                },
            });
        });
    }
    async getErrorDetails(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "error_responses" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["status", "url"])
  |> count()
`;
        const errorMap = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const status = String(o.status || "unknown");
                    const url = String(o.url || "unknown");
                    const count = o._value || 0;
                    if (!errorMap[status]) {
                        errorMap[status] = {};
                    }
                    errorMap[status][url] = count;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying error details: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    // Convert to array and flatten
                    const result = [];
                    Object.entries(errorMap).forEach(([status, urls]) => {
                        Object.entries(urls).forEach(([url, count]) => {
                            result.push({
                                status: parseInt(status, 10),
                                url,
                                count,
                            });
                        });
                    });
                    // Sort by status, then by count descending
                    result.sort((a, b) => {
                        if (a.status !== b.status)
                            return a.status - b.status;
                        return b.count - a.count;
                    });
                    console.log(chalk_1.default.gray(`        ✓ Error details: ${result.length} error entries found`));
                    resolve(result);
                },
            });
        });
    }
    async getErrorRequestsSummary(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        // Query all error response times (non-2xx status) grouped by endpoint
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)})
  |> filter(fn: (r) => r.status !~ /^2/)
  |> keep(columns: ["_value", "url"])
`;
        const endpointData = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const value = o._value || 0;
                    if (!endpointData[url]) {
                        endpointData[url] = [];
                    }
                    endpointData[url].push(value);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying error requests summary: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    const result = {};
                    Object.entries(endpointData).forEach(([url, values]) => {
                        const sorted = values.sort((a, b) => a - b);
                        result[url] = {
                            count: values.length,
                            minResponseTime: sorted[0] || 0,
                            avgResponseTime: values.reduce((a, b) => a + b, 0) / values.length,
                            p95ResponseTime: this.calculatePercentile(sorted, 0.95),
                            p99ResponseTime: this.calculatePercentile(sorted, 0.99),
                            maxResponseTime: sorted[sorted.length - 1] || 0,
                        };
                    });
                    console.log(chalk_1.default.gray(`        ✓ Error requests summary: ${Object.keys(result).length} endpoints with errors`));
                    resolve(result);
                },
            });
        });
    }
    async getErrorRequestsDetailedSummary(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        // Query error response times grouped by endpoint, method, and status
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)})
  |> filter(fn: (r) => r.status !~ /^2/)
  |> keep(columns: ["_value", "url", "method", "status"])
`;
        const groupKey = (url, method, status) => `${url}|${method}|${status}`;
        const errorGroupData = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const method = o.method || "unknown";
                    const status = o.status || 0;
                    const value = o._value || 0;
                    const key = groupKey(url, method, status);
                    if (!errorGroupData[key]) {
                        errorGroupData[key] = { url, method, status, values: [] };
                    }
                    errorGroupData[key].values.push(value);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying detailed error requests: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    const result = [];
                    Object.values(errorGroupData).forEach(({ url, method, status, values }) => {
                        const sorted = values.sort((a, b) => a - b);
                        result.push({
                            url,
                            method,
                            status,
                            count: values.length,
                            minResponseTime: sorted[0] || 0,
                            avgResponseTime: values.reduce((a, b) => a + b, 0) / values.length,
                            p95ResponseTime: this.calculatePercentile(sorted, 0.95),
                            p99ResponseTime: this.calculatePercentile(sorted, 0.99),
                            maxResponseTime: sorted[sorted.length - 1] || 0,
                        });
                    });
                    // Sort by count descending
                    result.sort((a, b) => b.count - a.count);
                    console.log(chalk_1.default.gray(`        ✓ Error requests detailed: ${result.length} error groups found`));
                    resolve(result);
                },
            });
        });
    }
    async getVUsStats(startTime, endTime) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        let vusMax = 0;
        let vusConfiguredMax = 0;
        return new Promise((resolve, reject) => {
            // Query vus measurement - get max value (peak VUs during test)
            const vusFlux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "vus")
  |> filter(fn: (r) => r._field == "value")
  |> max()
`;
            queryApi.queryRows(vusFlux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    vusMax = o._value || 0;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying VUs: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    // Query vus_max measurement - get max value (configured max)
                    const vusMaxFlux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "vus_max")
  |> filter(fn: (r) => r._field == "value")
  |> max()
`;
                    queryApi.queryRows(vusMaxFlux, {
                        next: (row, tableMeta) => {
                            const o = tableMeta.toObject(row);
                            vusConfiguredMax = o._value || 0;
                        },
                        error: (error) => {
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            console.error(chalk_1.default.red(`        ✗ Error querying VUs Max: ${errorMsg}`));
                            reject(error);
                        },
                        complete: () => {
                            console.log(chalk_1.default.gray(`        ✓ VUs: current=${vusMax}, max=${vusConfiguredMax}`));
                            resolve({ vusMax, vusConfiguredMax });
                        },
                    });
                },
            });
        });
    }
    async getPodCount(startTime, endTime) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        // Query the pods measurement directly
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "pods")
  |> filter(fn: (r) => r._field == "value")
  |> max()
`;
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    resolve(o._value || 0);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying pods: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    resolve(0);
                },
            });
        });
    }
    async getDroppedIterations(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "dropped_iterations" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["_measurement"])
  |> sum()
`;
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    resolve(o._value || 0);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying dropped iterations: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    resolve(0);
                },
            });
        });
    }
    async getRPSStats(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_reqs" and ${this.buildRunIdFilter(runId)})
  |> aggregateWindow(every: 10s, fn: sum)
  |> keep(columns: ["_value"])
`;
        const rpsValues = [];
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    if (typeof o._value === "number") {
                        rpsValues.push(o._value);
                    }
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying RPS: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    if (rpsValues.length === 0) {
                        resolve({ rpsMax: 0, rpsAvg: 0, rpsP95: 0 });
                        return;
                    }
                    rpsValues.sort((a, b) => a - b);
                    const rpsMax = rpsValues[rpsValues.length - 1];
                    const rpsAvg = rpsValues.reduce((a, b) => a + b, 0) / rpsValues.length;
                    const rpsP95 = this.calculatePercentile(rpsValues, 0.95);
                    resolve({ rpsMax, rpsAvg, rpsP95 });
                },
            });
        });
    }
    async getThroughput(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_reqs" and ${this.buildRunIdFilter(runId)})
  |> aggregateWindow(every: 10s, fn: sum)
  |> mean()
`;
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    if (typeof o._value === "number") {
                        resolve(o._value);
                    }
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying RPS: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    resolve(0);
                },
            });
        });
    }
    async getSlowestRequests(startTime, endTime, topN = 10, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)})
  |> keep(columns: ["_value", "url"])
  |> group(columns: ["url"])
  |> sort(columns: ["_value"], desc: true)
`;
        const endpointStats = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const value = o._value || 0;
                    if (!endpointStats[url]) {
                        endpointStats[url] = [];
                    }
                    endpointStats[url].push(value);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying slowest requests: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    // Calculate p95 and max for each endpoint
                    const slowestRequests = [];
                    Object.entries(endpointStats).forEach(([url, values]) => {
                        const sorted = values.sort((a, b) => a - b);
                        const max = sorted[sorted.length - 1] || 0;
                        const p95 = this.calculatePercentile(sorted, 0.95);
                        slowestRequests.push({ url, p95, max });
                    });
                    // Sort by p95 descending and limit to topN
                    slowestRequests.sort((a, b) => b.p95 - a.p95).slice(0, topN);
                    console.log(chalk_1.default.gray(`        ✓ Retrieved slowest unique endpoints: ${slowestRequests.length}`));
                    resolve(slowestRequests.slice(0, topN));
                },
            });
        });
    }
    async getIterationCount(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "iterations" and ${this.buildRunIdFilter(runId)})
  |> filter(fn: (r) => r._field == "value")
  |> sum()
`;
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    resolve(o._value || 0);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying iterations: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    resolve(0);
                },
            });
        });
    }
    async getIterationDurationPercentiles(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "iteration_duration" and ${this.buildRunIdFilter(runId)})
  |> quantile(q: 0.99)
`;
        let p99 = 0;
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    if (typeof o._value === "number") {
                        p99 = o._value;
                    }
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying iteration duration: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    console.log(chalk_1.default.gray(`        ✓ Retrieved iteration duration percentiles - p99=${p99.toFixed(2)}ms`));
                    resolve({
                        p50: 0,
                        p95: 0,
                        p99,
                    });
                },
            });
        });
    }
    async getChecksStats(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "checks" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["_measurement"])
  |> count()
`;
        return new Promise((resolve, reject) => {
            let total = 0;
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    total = o._value;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying checks: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    console.log(chalk_1.default.gray(`        ✓ Checks: total=${total}`));
                    resolve({
                        total,
                        succeeded: total,
                        failed: 0,
                        successRate: total > 0 ? 100 : 0,
                    });
                },
            });
        });
    }
    async getHttpPhaseStats(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const phases = [
            "http_req_blocked",
            "http_req_connecting",
            "http_req_tls_handshaking",
            "http_req_sending",
            "http_req_receiving",
            "http_req_waiting",
        ];
        const result = {};
        // Query all phases in parallel
        const promises = phases.map((phase) => {
            return new Promise((resolve, reject) => {
                const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "${phase}" and ${this.buildRunIdFilter(runId)})
  |> keep(columns: ["_value"])
`;
                const values = [];
                queryApi.queryRows(flux, {
                    next: (row, tableMeta) => {
                        const o = tableMeta.toObject(row);
                        values.push(o._value);
                    },
                    error: (error) => reject(error),
                    complete: () => {
                        if (values.length === 0) {
                            result[phase] = { avg: 0, min: 0, max: 0, p90: 0, p95: 0 };
                        }
                        else {
                            const sorted = values.sort((a, b) => a - b);
                            const sum = values.reduce((a, b) => a + b, 0);
                            result[phase] = {
                                avg: sum / values.length,
                                min: sorted[0],
                                max: sorted[sorted.length - 1],
                                p90: this.calculatePercentile(sorted, 0.9),
                                p95: this.calculatePercentile(sorted, 0.95),
                            };
                        }
                        resolve();
                    },
                });
            });
        });
        await Promise.all(promises).catch((error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(chalk_1.default.red(`        ✗ Error querying HTTP phases: ${errorMsg}`));
            throw error;
        });
        return result;
    }
    async getDataTransferStats(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        // Calculate duration in seconds
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const durationSeconds = (endDate.getTime() - startDate.getTime()) / 1000 || 1;
        // Query data_received and data_sent totals
        const getTotal = (measurement) => {
            return new Promise((resolve, reject) => {
                const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "${measurement}" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["_measurement"])
  |> sum()
`;
                let total = 0;
                queryApi.queryRows(flux, {
                    next: (row, tableMeta) => {
                        const o = tableMeta.toObject(row);
                        total = o._value;
                    },
                    error: (error) => reject(error),
                    complete: () => resolve(total),
                });
            });
        };
        return new Promise((resolve, reject) => {
            Promise.all([getTotal("data_received"), getTotal("data_sent")])
                .then(([received, sent]) => {
                const receivedRate = received / durationSeconds;
                const sentRate = sent / durationSeconds;
                resolve({
                    received,
                    sent,
                    receivedRate,
                    sentRate,
                });
            })
                .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(chalk_1.default.red(`        ✗ Error querying data transfer: ${errorMsg}`));
                reject(error);
            });
        });
    }
    async getRequestsByEndpoint(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["url"])
  |> count()
  |> sort(columns: ["_value"], desc: true)
`;
        const result = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const count = o._value || 0;
                    result[url] = count;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying requests by endpoint: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    const endpointCount = Object.keys(result).length;
                    console.log(chalk_1.default.gray(`        ✓ Requests by endpoint: ${endpointCount} unique endpoints`));
                    resolve(result);
                },
            });
        });
    }
    async getRpsPerEndpoint(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_reqs" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["url"])
  |> aggregateWindow(every: 10s, fn: sum)
  |> keep(columns: ["_value", "url"])
`;
        const rpsPerEndpoint = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const count = o._value || 0;
                    if (!rpsPerEndpoint[url]) {
                        rpsPerEndpoint[url] = [];
                    }
                    rpsPerEndpoint[url].push(count);
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying RPS per endpoint: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    const result = {};
                    Object.entries(rpsPerEndpoint).forEach(([url, values]) => {
                        const sorted = values.sort((a, b) => a - b);
                        const max = sorted[sorted.length - 1] || 0;
                        const avg = values.reduce((a, b) => a + b, 0) / values.length;
                        const p95 = this.calculatePercentile(sorted, 0.95);
                        result[url] = { avg, max, p95 };
                    });
                    console.log(chalk_1.default.gray(`        ✓ RPS per endpoint: ${Object.keys(result).length} unique endpoints`));
                    resolve(result);
                },
            });
        });
    }
    async getRpsTimeSeriesByEndpoint(startTime, endTime, interval = "10s", runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_reqs" and ${this.buildRunIdFilter(runId)})
  |> group(columns: ["url"])
  |> aggregateWindow(every: ${interval}, fn: sum)
  |> keep(columns: ["_time", "_value", "url"])
`;
        const result = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const timestamp = new Date(o._time);
                    const rps = o._value || 0;
                    if (!result[url]) {
                        result[url] = [];
                    }
                    result[url].push({ timestamp, rps });
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying RPS time series: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    const endpointCount = Object.keys(result).length;
                    console.log(chalk_1.default.gray(`        ✓ RPS time series: ${endpointCount} endpoints`));
                    resolve(result);
                },
            });
        });
    }
    async getRequestsSummary(startTime, endTime, runId) {
        const queryApi = this.influxDB.getQueryApi(this.config.org);
        // Query all response times grouped by endpoint and method
        const flux = `
from(bucket: "${this.config.bucket}")
  |> range(start: ${startTime}, stop: ${endTime})
  |> filter(fn: (r) => r._measurement == "http_req_duration" and ${this.buildRunIdFilter(runId)})
  |> keep(columns: ["_value", "url", "method", "status"])
`;
        const groupKey = (url, method) => `${url}|${method}`;
        const groupData = {};
        return new Promise((resolve, reject) => {
            queryApi.queryRows(flux, {
                next: (row, tableMeta) => {
                    const o = tableMeta.toObject(row);
                    const url = o.url || "unknown";
                    const method = o.method || "unknown";
                    const status = parseInt(String(o.status) || "0", 10);
                    const value = o._value || 0;
                    const key = groupKey(url, method);
                    if (!groupData[key]) {
                        groupData[key] = { url, method, values: [], statuses: {} };
                    }
                    groupData[key].values.push(value);
                    groupData[key].statuses[status] = (groupData[key].statuses[status] || 0) + 1;
                },
                error: (error) => {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(chalk_1.default.red(`        ✗ Error querying requests summary: ${errorMsg}`));
                    reject(error);
                },
                complete: () => {
                    const result = {};
                    Object.values(groupData).forEach(({ url, method, values, statuses }) => {
                        const sortedValues = values.sort((a, b) => a - b);
                        const successful = Object.entries(statuses)
                            .filter(([status]) => status.startsWith("2"))
                            .reduce((sum, [, count]) => sum + count, 0);
                        const failed = sortedValues.length - successful;
                        result[`${url}|${method}`] = {
                            url,
                            method,
                            count: sortedValues.length,
                            successful,
                            failed,
                            minResponseTime: sortedValues[0] || 0,
                            avgResponseTime: sortedValues.reduce((a, b) => a + b, 0) / sortedValues.length,
                            p95ResponseTime: this.calculatePercentile(sortedValues, 0.95),
                            p99ResponseTime: this.calculatePercentile(sortedValues, 0.99),
                            maxResponseTime: sortedValues[sortedValues.length - 1] || 0,
                        };
                    });
                    console.log(chalk_1.default.gray(`        ✓ Requests summary: ${Object.keys(result).length} unique endpoint/method combinations`));
                    resolve(result);
                },
            });
        });
    }
}
exports.InfluxDataExtractor = InfluxDataExtractor;
//# sourceMappingURL=influx-data-extractor.js.map