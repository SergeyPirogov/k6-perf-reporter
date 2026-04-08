"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONReporter = void 0;
class JSONReporter {
    generate(metrics, testName) {
        const status = metrics.errorRate < 1 ? "PASS" : "FAIL";
        const report = {
            testName,
            generatedAt: new Date().toISOString(),
            status,
            summary: {
                result: status,
                errorRate: metrics.errorRate,
                errorRateThreshold: 1,
                passed: metrics.errorRate < 1,
                totalRequests: metrics.totalRequests,
                successfulRequests: metrics.successfulRequests,
                failedRequests: metrics.failedRequests,
            },
            metrics: {
                responseTime: {
                    p50: metrics.responseTimeP50,
                    p95: metrics.responseTimeP95,
                    p99: metrics.responseTimeP99,
                },
                iterationDuration: {
                    p50: metrics.iterationDurationP50,
                    p95: metrics.iterationDurationP95,
                    p99: metrics.iterationDurationP99,
                },
                requests: {
                    total: metrics.totalRequests,
                    successful: metrics.successfulRequests,
                    failed: metrics.failedRequests,
                    errorRate: metrics.errorRate,
                },
                concurrency: {
                    vusMax: metrics.vusMax,
                    vusConfiguredMax: metrics.vusConfiguredMax,
                    podCount: metrics.podCount,
                    droppedIterations: metrics.droppedIterations,
                },
                slowestRequests: metrics.slowestRequests.slice(0, 10),
                errors: metrics.errors,
                errorDetails: metrics.errorDetails,
                errorRequestsSummary: metrics.errorRequestsSummary,
                errorRequestsDetailedSummary: metrics.errorRequestsDetailedSummary,
                checks: {
                    total: metrics.checksTotal,
                    succeeded: metrics.checksSucceeded,
                    failed: metrics.checksFailed,
                    successRate: metrics.checksSuccessRate,
                },
                httpPhases: metrics.httpPhases,
                dataTransfer: {
                    receivedBytes: metrics.dataReceivedBytes,
                    sentBytes: metrics.dataSentBytes,
                    receivedRate: metrics.dataReceivedRate,
                    sentRate: metrics.dataSentRate,
                },
                requestsByEndpoint: metrics.requestsByEndpoint,
                rpsPerEndpoint: metrics.rpsPerEndpoint,
                requestsSummary: metrics.requestsSummary,
            },
        };
        return JSON.stringify(report, null, 2);
    }
}
exports.JSONReporter = JSONReporter;
//# sourceMappingURL=json.js.map