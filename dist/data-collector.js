"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataCollector = void 0;
class DataCollector {
    constructor(extractor) {
        this.extractor = extractor;
    }
    async collectSummary(startTime, endTime, runId) {
        const [vusData, maxVusData, podsData, errorsData, requestsData, duration, httpReqsDurationData, iterationsData, iterationDurationData, top10SlowestRequests, httpRequestsStatsByUrl, percentileMap, httpRequestsCountByStatus, httpRequestsRpsByUrlData, rpsData] = await Promise.all([
            this.extractor.getVus(startTime, endTime, runId),
            this.extractor.getMaxVus(startTime, endTime, runId),
            this.extractor.getPodsCount(startTime, endTime, runId),
            this.extractor.getTotalErrors(startTime, endTime, runId),
            this.extractor.getTotalRequests(startTime, endTime, runId),
            this.extractor.getTestDuration(startTime, endTime, runId),
            this.extractor.getHttpReqsDuration(startTime, endTime, runId),
            this.extractor.getTotalIterations(startTime, endTime, runId),
            this.extractor.getIterationDuration(startTime, endTime, runId),
            this.extractor.getTop10SlowestRequests(startTime, endTime, runId),
            this.extractor.getHttpRequestsStatsByUrl(startTime, endTime, runId),
            this.extractor.getHttpRequestsPercentiles(startTime, endTime, runId),
            this.extractor.getHttpRequestsCountByStatus(startTime, endTime, runId),
            this.extractor.getHttpRequestsRpsByUrl(startTime, endTime, runId),
            this.extractor.getRPS(startTime, endTime, runId),
        ]);
        const totalRequests = this.getTotalValue(requestsData);
        const totalIterations = this.getTotalValue(iterationsData);
        const rpsMetrics = this.calculateMetrics(rpsData);
        const rps = rpsMetrics.p95;
        const ips = duration > 0 ? totalIterations / duration : 0;
        // Create a map of successful/failed counts by url|method|status key
        const countByStatusKey = new Map();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        httpRequestsCountByStatus.forEach((item) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const key = `${item.url}|${item.method}|${item.status}`;
            countByStatusKey.set(key, item.value);
        });
        // Create a map of RPS by URL
        const rpsByUrl = new Map();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        httpRequestsRpsByUrlData.forEach((item) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const url = item.url;
            const count = item.value;
            const urlRps = duration > 0 ? count / duration : 0;
            rpsByUrl.set(url, urlRps);
        });
        // Merge percentiles and counts into stats
        const enrichedStats = httpRequestsStatsByUrl.map((stat) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const key = `${stat.url}|${stat.method}|${stat.status}`;
            const percentiles = percentileMap.get(key);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const statusCode = parseInt(stat.status, 10);
            const isSuccess = statusCode >= 200 && statusCode < 300;
            const count = countByStatusKey.get(key) || stat.value;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const url = stat.url;
            const urlRps = rpsByUrl.get(url) || 0;
            return {
                ...stat,
                p95: percentiles?.p95 || 0,
                p99: percentiles?.p99 || 0,
                successCount: isSuccess ? count : 0,
                failedCount: !isSuccess ? count : 0,
                rps: urlRps,
            };
        });
        // Calculate RPS for each URL and add to RPS by URL data
        const enrichedRpsByUrl = httpRequestsRpsByUrlData.map((item) => ({
            ...item,
            rps: rpsByUrl.get(item.url || "") || 0,
        }));
        return {
            vus: {
                used: this.calculateMetrics(vusData),
                limit: this.calculateMetrics(maxVusData),
            },
            pods: this.calculateMetrics(podsData),
            httpReqsDuration: this.calculateMetrics(httpReqsDurationData),
            iterationDuration: this.calculateMetrics(iterationDurationData),
            totalRequests,
            totalIterations,
            totalErrors: this.getTotalValue(errorsData),
            errorPercent: totalRequests > 0
                ? (this.getTotalValue(errorsData) / totalRequests) * 100
                : 0,
            duration,
            rps,
            ips,
            top10SlowestRequests,
            httpRequestsStatsByUrl: enrichedStats,
            httpRequestsRpsByUrl: enrichedRpsByUrl,
        };
    }
    getTotalValue(data) {
        if (data.length === 0) {
            return 0;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return data.reduce((sum, item) => sum + item.value, 0);
    }
    calculateMetrics(data) {
        if (data.length === 0) {
            return {
                min: 0,
                max: 0,
                avg: 0,
                p95: 0,
                p99: 0,
            };
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const values = data.map((d) => d.value).sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);
        return {
            min: values[0],
            max: values[values.length - 1],
            avg: sum / values.length,
            p95: values[Math.floor(values.length * 0.95)],
            p99: values[Math.floor(values.length * 0.99)],
        };
    }
}
exports.DataCollector = DataCollector;
//# sourceMappingURL=data-collector.js.map