"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataExtractor = void 0;
class DataExtractor {
    constructor(client, config) {
        this.client = client;
        this.bucket = config.bucket;
    }
    async getVus(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus" ${runIdFilter})
        |> aggregateWindow(every: 10s, fn: mean)
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getMaxVus(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus_max" ${runIdFilter})
        |> aggregateWindow(every: 10s, fn: max)
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getPodsCount(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "pods_count" ${runIdFilter})
        |> aggregateWindow(every: 10s, fn: mean)
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getTotalErrors(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_failed" ${runIdFilter})
        |> sum()
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getTotalRequests(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" ${runIdFilter})
        |> count()
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getTotalIterations(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iterations" ${runIdFilter})
        |> count()
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getIterationDuration(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iteration_duration" ${runIdFilter})
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getTop10SlowestRequests(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
        |> group(columns: ["url", "method"])
        |> quantile(q: 0.95)
        |> group()
        |> sort(columns: ["_value"], desc: true)
        |> limit(n: 10)
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getHttpRequestsStatsByUrl(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
        |> group(columns: ["url", "method", "status"])
        |> reduce(
          identity: {count: 0, sum: 0.0, min: 999999.0, max: 0.0},
          fn: (r, accumulator) => ({
            count: accumulator.count + 1,
            sum: accumulator.sum + r._value,
            min: if accumulator.min > r._value then r._value else accumulator.min,
            max: if accumulator.max < r._value then r._value else accumulator.max
          })
        )
        |> map(fn: (r) => ({
          r with
          _value: r.count,
          avg: r.sum / float(v: r.count),
          statusCode: r.status
        }))
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getHttpRequestsCountByStatus(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
        |> group(columns: ["url", "method", "status"])
        |> count()
        |> group()
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getHttpRequestsRpsByUrl(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
        |> group(columns: ["url"])
        |> count()
        |> group()
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getHttpRequestsPercentiles(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        // Query for P95
        const p95Query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
        |> group(columns: ["url", "method", "status"])
        |> quantile(q: 0.95)
        |> group()
    `;
        // Query for P99
        const p99Query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
        |> group(columns: ["url", "method", "status"])
        |> quantile(q: 0.99)
        |> group()
    `;
        const [p95Results, p99Results] = await Promise.all([
            this.client.query(p95Query),
            this.client.query(p99Query),
        ]);
        const percentileMap = new Map();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        p95Results.forEach((result) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const key = `${result.url}|${result.method}|${result.status}`;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const p95 = parseFloat(String(result._value || "0")) || 0;
            if (!percentileMap.has(key)) {
                percentileMap.set(key, { p95: 0, p99: 0 });
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            percentileMap.get(key).p95 = p95;
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        p99Results.forEach((result) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const key = `${result.url}|${result.method}|${result.status}`;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const p99 = parseFloat(String(result._value || "0")) || 0;
            if (!percentileMap.has(key)) {
                percentileMap.set(key, { p95: 0, p99: 0 });
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            percentileMap.get(key).p99 = p99;
        });
        return percentileMap;
    }
    async getTestDuration(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" ${runIdFilter})
        |> group()
    `;
        const results = await this.client.query(fluxQuery);
        const timestamps = results.map((r) => new Date(r._time).getTime());
        if (timestamps.length === 0)
            return 0;
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        return (maxTime - minTime) / 1000; // Return duration in seconds
    }
    async getHttpReqsDuration(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" ${runIdFilter})
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    async getRPS(startTime, endTime, runId) {
        const runIdFilter = runId ? `and (r.runId == "${runId}")` : "";
        const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" ${runIdFilter})
        |> aggregateWindow(every: 1s, fn: sum, createEmpty: false)
    `;
        const results = await this.client.query(fluxQuery);
        return this.formatMetrics(results);
    }
    formatMetrics(results) {
        return results.map((result) => ({
            timestamp: result._time || new Date().toISOString(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            value: parseFloat(result._value) || 0,
            ...result,
        }));
    }
}
exports.DataExtractor = DataExtractor;
//# sourceMappingURL=data-extractor.js.map