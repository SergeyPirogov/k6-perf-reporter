"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const chalk_1 = __importDefault(require("chalk"));
const logger_1 = require("./logger");
class MetricsCollector {
    constructor(influxClient, logger = logger_1.consoleLogger) {
        this.influxClient = influxClient;
        this.logger = logger;
    }
    async collect(scenario, startTime, endTime, runId) {
        this.logger.log(chalk_1.default.blue(`  📍 Fetching metrics for scenario: ${chalk_1.default.bold(scenario)}${runId ? chalk_1.default.gray(` [runId: ${runId}]`) : ""}`));
        this.logger.log(chalk_1.default.gray(`     Time range: ${startTime} to ${endTime}`));
        try {
            const startPercentilesTime = Date.now();
            const percentiles = await this.influxClient.getResponseTimePercentiles(startTime, endTime, runId);
            const percentilesDuration = Date.now() - startPercentilesTime;
            this.logger.log(chalk_1.default.green(`     ├─ ✓ Response times: P50=${percentiles.p50.toFixed(2)}ms, P95=${percentiles.p95.toFixed(2)}ms, P99=${percentiles.p99.toFixed(2)}ms (${percentilesDuration}ms)`));
            const startStatsTime = Date.now();
            const stats = await this.influxClient.getRequestStats(startTime, endTime, runId);
            const statsDuration = Date.now() - startStatsTime;
            this.logger.log(chalk_1.default.green(`     ├─ ✓ Requests: total=${stats.total}, success=${stats.success}, failed=${stats.failed} (${statsDuration}ms)`));
            const startAdditionalTime = Date.now();
            // Fetch all additional metrics in parallel
            const [vus, podCount, droppedIterations, slowestRequests, iterationDuration, checks, httpPhases, dataTransfer, requestsByEndpoint, rpsPerEndpoint, requestsSummary] = await Promise.all([
                this.influxClient.getVUsStats(startTime, endTime),
                this.influxClient.getPodCount(startTime, endTime),
                this.influxClient.getDroppedIterations(startTime, endTime, runId),
                this.influxClient.getSlowestRequests(startTime, endTime, 10, runId),
                this.influxClient.getIterationDurationPercentiles(startTime, endTime, runId),
                this.influxClient.getChecksStats(startTime, endTime, runId),
                this.influxClient.getHttpPhaseStats(startTime, endTime, runId),
                this.influxClient.getDataTransferStats(startTime, endTime, runId),
                this.influxClient.getRequestsByEndpoint(startTime, endTime, runId),
                this.influxClient.getRpsPerEndpoint(startTime, endTime, runId),
                this.influxClient.getRequestsSummary(startTime, endTime, runId),
            ]);
            const additionalDuration = Date.now() - startAdditionalTime;
            this.logger.log(chalk_1.default.green(`     ├─ ✓ Additional metrics fetched (${additionalDuration}ms)`));
            const startErrorsTime = Date.now();
            const [errors, errorDetails, errorRequestsSummary, errorRequestsDetailedSummary] = await Promise.all([
                this.influxClient.getErrorBreakdown(startTime, endTime, runId),
                this.influxClient.getErrorDetails(startTime, endTime, runId),
                this.influxClient.getErrorRequestsSummary(startTime, endTime, runId),
                this.influxClient.getErrorRequestsDetailedSummary(startTime, endTime, runId),
            ]);
            const errorsDuration = Date.now() - startErrorsTime;
            const errorCount = Object.values(errors).reduce((sum, count) => sum + count, 0);
            this.logger.log(chalk_1.default.green(`     └─ ✓ Errors: ${Object.keys(errors).length} unique error types, ${errorCount} total errors (${errorsDuration}ms)`));
            const _successRate = stats.total
                ? (stats.success / stats.total) * 100
                : 0;
            const errorRate = stats.total ? (stats.failed / stats.total) * 100 : 0;
            this.logger.log(chalk_1.default.blue(`  📊 Metrics summary: Error rate=${errorRate.toFixed(2)}%, VUs=${vus.vusMax}/${vus.vusConfiguredMax}`));
            return {
                responseTimeP50: percentiles.p50,
                responseTimeP95: percentiles.p95,
                responseTimeP99: percentiles.p99,
                totalRequests: stats.total,
                successfulRequests: stats.success,
                failedRequests: stats.failed,
                errorRate,
                errors,
                errorDetails,
                errorRequestsSummary,
                errorRequestsDetailedSummary,
                vusMax: vus.vusMax,
                vusConfiguredMax: vus.vusConfiguredMax,
                podCount,
                droppedIterations,
                slowestRequests,
                iterationDurationP50: iterationDuration.p50,
                iterationDurationP95: iterationDuration.p95,
                iterationDurationP99: iterationDuration.p99,
                checksTotal: checks.total,
                checksSucceeded: checks.succeeded,
                checksFailed: checks.failed,
                checksSuccessRate: checks.successRate,
                httpPhases,
                dataReceivedBytes: dataTransfer.received,
                dataSentBytes: dataTransfer.sent,
                dataReceivedRate: dataTransfer.receivedRate,
                dataSentRate: dataTransfer.sentRate,
                requestsByEndpoint,
                rpsPerEndpoint,
                requestsSummary,
            };
        }
        catch (error) {
            this.logger.error(chalk_1.default.red("  ❌ Error fetching metrics:") + " " + (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }
}
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=metrics-collector.js.map