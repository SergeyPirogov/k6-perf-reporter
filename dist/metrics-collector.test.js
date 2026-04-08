"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/unbound-method */
const vitest_1 = require("vitest");
const metrics_collector_1 = require("./metrics-collector");
const logger_1 = require("./logger");
function buildMockClient(overrides) {
    const defaults = {
        getResponseTimePercentiles: vitest_1.vi
            .fn()
            .mockResolvedValue({ p50: 0, p95: 0, p99: 0 }),
        getRequestStats: vitest_1.vi
            .fn()
            .mockResolvedValue({ total: 0, success: 0, failed: 0 }),
        getVUsStats: vitest_1.vi
            .fn()
            .mockResolvedValue({ vusMax: 0, vusConfiguredMax: 0 }),
        getPodCount: vitest_1.vi.fn().mockResolvedValue(0),
        getDroppedIterations: vitest_1.vi.fn().mockResolvedValue(0),
        getSlowestRequests: vitest_1.vi.fn().mockResolvedValue([]),
        getIterationDurationPercentiles: vitest_1.vi
            .fn()
            .mockResolvedValue({ p50: 0, p95: 0, p99: 0 }),
        getChecksStats: vitest_1.vi.fn().mockResolvedValue({
            total: 0,
            succeeded: 0,
            failed: 0,
            successRate: 0,
        }),
        getHttpPhaseStats: vitest_1.vi.fn().mockResolvedValue({}),
        getDataTransferStats: vitest_1.vi.fn().mockResolvedValue({
            received: 0,
            sent: 0,
            receivedRate: 0,
            sentRate: 0,
        }),
        getRequestsByEndpoint: vitest_1.vi.fn().mockResolvedValue({}),
        getRpsPerEndpoint: vitest_1.vi.fn().mockResolvedValue({}),
        getRequestsSummary: vitest_1.vi.fn().mockResolvedValue({}),
        getErrorBreakdown: vitest_1.vi.fn().mockResolvedValue({}),
        getErrorDetails: vitest_1.vi.fn().mockResolvedValue([]),
        getErrorRequestsSummary: vitest_1.vi.fn().mockResolvedValue({}),
        getErrorRequestsDetailedSummary: vitest_1.vi.fn().mockResolvedValue([]),
    };
    const merged = { ...defaults, ...(overrides || {}) };
    return merged;
}
(0, vitest_1.describe)("MetricsCollector", () => {
    (0, vitest_1.it)("assembles TestMetrics from mock influx responses", async () => {
        const mockClient = buildMockClient({
            getResponseTimePercentiles: vitest_1.vi
                .fn()
                .mockResolvedValue({ p50: 120, p95: 300, p99: 500 }),
            getRequestStats: vitest_1.vi
                .fn()
                .mockResolvedValue({ total: 1000, success: 980, failed: 20 }),
            getVUsStats: vitest_1.vi
                .fn()
                .mockResolvedValue({ vusMax: 50, vusConfiguredMax: 100 }),
            getChecksStats: vitest_1.vi.fn().mockResolvedValue({
                total: 100,
                succeeded: 95,
                failed: 5,
                successRate: 95,
            }),
            getIterationDurationPercentiles: vitest_1.vi
                .fn()
                .mockResolvedValue({ p50: 100, p95: 250, p99: 450 }),
            getDataTransferStats: vitest_1.vi.fn().mockResolvedValue({
                received: 5242880,
                sent: 1048576,
                receivedRate: 1024,
                sentRate: 256,
            }),
            getSlowestRequests: vitest_1.vi.fn().mockResolvedValue([
                { url: "/api/slow", p95: 1000, max: 2000 },
            ]),
            getPodCount: vitest_1.vi.fn().mockResolvedValue(3),
            getDroppedIterations: vitest_1.vi.fn().mockResolvedValue(0),
            getHttpPhaseStats: vitest_1.vi.fn().mockResolvedValue({
                setup: { avg: 10, min: 5, max: 20, p90: 18, p95: 19 },
            }),
            getRequestsByEndpoint: vitest_1.vi
                .fn()
                .mockResolvedValue({ "/api/users": 500, "/api/posts": 500 }),
            getRpsPerEndpoint: vitest_1.vi.fn().mockResolvedValue({
                "/api/users": { avg: 5, max: 10, p95: 9 },
            }),
            getRequestsSummary: vitest_1.vi.fn().mockResolvedValue({
                "GET /api/users": {
                    url: "/api/users",
                    method: "GET",
                    count: 500,
                    successful: 490,
                    failed: 10,
                    minResponseTime: 50,
                    avgResponseTime: 150,
                    p95ResponseTime: 300,
                    p99ResponseTime: 450,
                    maxResponseTime: 600,
                },
            }),
            getErrorBreakdown: vitest_1.vi
                .fn()
                .mockResolvedValue({ "500": 15, "404": 5 }),
            getErrorDetails: vitest_1.vi.fn().mockResolvedValue([
                { status: 500, url: "/api/error", count: 15 },
                { status: 404, url: "/api/notfound", count: 5 },
            ]),
            getErrorRequestsSummary: vitest_1.vi.fn().mockResolvedValue({
                "GET /api/error": {
                    count: 15,
                    minResponseTime: 100,
                    avgResponseTime: 150,
                    p95ResponseTime: 200,
                    p99ResponseTime: 250,
                    maxResponseTime: 300,
                },
            }),
            getErrorRequestsDetailedSummary: vitest_1.vi.fn().mockResolvedValue([
                {
                    url: "/api/error",
                    method: "GET",
                    status: 500,
                    count: 15,
                    minResponseTime: 100,
                    avgResponseTime: 150,
                    p95ResponseTime: 200,
                    p99ResponseTime: 250,
                    maxResponseTime: 300,
                },
            ]),
        });
        const collector = new metrics_collector_1.MetricsCollector(mockClient, logger_1.noopLogger);
        const result = await collector.collect("smoke", "-1h", "now()");
        (0, vitest_1.expect)(result.responseTimeP50).toBe(120);
        (0, vitest_1.expect)(result.responseTimeP95).toBe(300);
        (0, vitest_1.expect)(result.responseTimeP99).toBe(500);
        (0, vitest_1.expect)(result.totalRequests).toBe(1000);
        (0, vitest_1.expect)(result.successfulRequests).toBe(980);
        (0, vitest_1.expect)(result.failedRequests).toBe(20);
        (0, vitest_1.expect)(result.errorRate).toBeCloseTo(2.0);
        (0, vitest_1.expect)(result.vusMax).toBe(50);
        (0, vitest_1.expect)(result.vusConfiguredMax).toBe(100);
        (0, vitest_1.expect)(result.checksTotal).toBe(100);
        (0, vitest_1.expect)(result.checksSucceeded).toBe(95);
        (0, vitest_1.expect)(result.checksFailed).toBe(5);
        (0, vitest_1.expect)(result.checksSuccessRate).toBe(95);
        (0, vitest_1.expect)(result.iterationDurationP50).toBe(100);
        (0, vitest_1.expect)(result.dataReceivedBytes).toBe(5242880);
        (0, vitest_1.expect)(result.dataSentBytes).toBe(1048576);
        (0, vitest_1.expect)(result.podCount).toBe(3);
        (0, vitest_1.expect)(result.droppedIterations).toBe(0);
    });
    (0, vitest_1.it)("returns errorRate of 0 when total requests is 0", async () => {
        const mockClient = buildMockClient({
            getRequestStats: vitest_1.vi
                .fn()
                .mockResolvedValue({ total: 0, success: 0, failed: 0 }),
        });
        const collector = new metrics_collector_1.MetricsCollector(mockClient, logger_1.noopLogger);
        const result = await collector.collect("empty", "-1h", "now()");
        (0, vitest_1.expect)(result.errorRate).toBe(0);
        (0, vitest_1.expect)(result.totalRequests).toBe(0);
    });
    (0, vitest_1.it)("passes runId to all influx methods that accept it", async () => {
        const mockClient = buildMockClient();
        const collector = new metrics_collector_1.MetricsCollector(mockClient, logger_1.noopLogger);
        await collector.collect("load", "-1h", "now()", "run-abc");
        const getResponseTimePercentiles = mockClient.getResponseTimePercentiles;
        const getRequestStats = mockClient.getRequestStats;
        const getDroppedIterations = mockClient.getDroppedIterations;
        const getErrorBreakdown = mockClient.getErrorBreakdown;
        const getSlowestRequests = mockClient.getSlowestRequests;
        const getVUsStats = mockClient.getVUsStats;
        const getPodCount = mockClient.getPodCount;
        (0, vitest_1.expect)(getResponseTimePercentiles).toHaveBeenCalledWith("-1h", "now()", "run-abc");
        (0, vitest_1.expect)(getRequestStats).toHaveBeenCalledWith("-1h", "now()", "run-abc");
        (0, vitest_1.expect)(getDroppedIterations).toHaveBeenCalledWith("-1h", "now()", "run-abc");
        (0, vitest_1.expect)(getErrorBreakdown).toHaveBeenCalledWith("-1h", "now()", "run-abc");
        (0, vitest_1.expect)(getSlowestRequests).toHaveBeenCalledWith("-1h", "now()", 10, "run-abc");
        // Methods that should NOT receive runId
        (0, vitest_1.expect)(getVUsStats).toHaveBeenCalledWith("-1h", "now()");
        (0, vitest_1.expect)(getPodCount).toHaveBeenCalledWith("-1h", "now()");
    });
    (0, vitest_1.it)("calls each influx method exactly once per collect() call", async () => {
        const mockClient = buildMockClient();
        const collector = new metrics_collector_1.MetricsCollector(mockClient, logger_1.noopLogger);
        await collector.collect("soak", "-2h", "now()");
        const getVUsStats = mockClient.getVUsStats;
        const getResponseTimePercentiles = mockClient.getResponseTimePercentiles;
        const getRequestStats = mockClient.getRequestStats;
        const getPodCount = mockClient.getPodCount;
        const getDroppedIterations = mockClient.getDroppedIterations;
        const getSlowestRequests = mockClient.getSlowestRequests;
        const getIterationDurationPercentiles = mockClient.getIterationDurationPercentiles;
        const getChecksStats = mockClient.getChecksStats;
        const getHttpPhaseStats = mockClient.getHttpPhaseStats;
        const getDataTransferStats = mockClient.getDataTransferStats;
        const getRequestsByEndpoint = mockClient.getRequestsByEndpoint;
        const getRpsPerEndpoint = mockClient.getRpsPerEndpoint;
        const getRequestsSummary = mockClient.getRequestsSummary;
        const getErrorBreakdown = mockClient.getErrorBreakdown;
        const getErrorDetails = mockClient.getErrorDetails;
        const getErrorRequestsSummary = mockClient.getErrorRequestsSummary;
        const getErrorRequestsDetailedSummary = mockClient.getErrorRequestsDetailedSummary;
        (0, vitest_1.expect)(getVUsStats).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getResponseTimePercentiles).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getRequestStats).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getPodCount).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getDroppedIterations).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getSlowestRequests).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getIterationDurationPercentiles).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getChecksStats).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getHttpPhaseStats).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getDataTransferStats).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getRequestsByEndpoint).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getRpsPerEndpoint).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getRequestsSummary).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getErrorBreakdown).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getErrorDetails).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getErrorRequestsSummary).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(getErrorRequestsDetailedSummary).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("re-throws when an influx method rejects", async () => {
        const mockClient = buildMockClient({
            getResponseTimePercentiles: vitest_1.vi
                .fn()
                .mockRejectedValue(new Error("InfluxDB timeout")),
        });
        const collector = new metrics_collector_1.MetricsCollector(mockClient, logger_1.noopLogger);
        await (0, vitest_1.expect)(collector.collect("spike", "-1h", "now()")).rejects.toThrow("InfluxDB timeout");
    });
});
//# sourceMappingURL=metrics-collector.test.js.map