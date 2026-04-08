"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
class CLIReporter {
    generate(metrics, testName) {
        console.log("\n" + chalk_1.default.bold.cyan("━━━ k6 Performance Test Report ━━━\n"));
        console.log(chalk_1.default.bold(`Test: ${testName}`));
        console.log(chalk_1.default.gray(`Generated: ${new Date().toLocaleString()}\n`));
        // Summary section
        console.log(chalk_1.default.bold.yellow("📋 Summary"));
        const summaryData = [
            [chalk_1.default.bold("Pods"), metrics.podCount.toString()],
            [chalk_1.default.bold("VUs"), `${metrics.vusMax} / ${metrics.vusConfiguredMax}`],
            [
                chalk_1.default.bold("Total Requests"),
                chalk_1.default.cyan(metrics.totalRequests.toLocaleString()),
            ],
            [
                chalk_1.default.bold("Successful"),
                chalk_1.default.green(metrics.successfulRequests.toLocaleString()),
            ],
            [
                chalk_1.default.bold("Failed"),
                metrics.failedRequests > 0
                    ? chalk_1.default.red(metrics.failedRequests.toLocaleString())
                    : chalk_1.default.gray(metrics.failedRequests.toString()),
            ],
            [
                chalk_1.default.bold("Error Rate"),
                metrics.errorRate > 0
                    ? metrics.errorRate < 1
                        ? chalk_1.default.yellow(`${metrics.errorRate.toFixed(4)}%`)
                        : chalk_1.default.red(`${metrics.errorRate.toFixed(2)}%`)
                    : chalk_1.default.green(`${metrics.errorRate.toFixed(2)}%`),
            ],
            [
                chalk_1.default.bold("Dropped Iterations"),
                metrics.droppedIterations > 0
                    ? chalk_1.default.yellow(metrics.droppedIterations.toLocaleString())
                    : chalk_1.default.gray(metrics.droppedIterations.toString()),
            ],
        ];
        console.log((0, table_1.table)(summaryData) + "\n");
        // Response Times
        console.log(chalk_1.default.bold.yellow("📊 Response Times"));
        const responseTimes = [
            ["Metric", "Value"],
            ["P50", `${metrics.responseTimeP50.toFixed(2)} ms`],
            ["P95", `${metrics.responseTimeP95.toFixed(2)} ms`],
            ["P99", `${metrics.responseTimeP99.toFixed(2)} ms`],
        ];
        console.log((0, table_1.table)(responseTimes) + "\n");
        // Iteration Duration
        console.log(chalk_1.default.bold.yellow("⏱️  Iteration Duration"));
        const iterationDuration = [
            ["Metric", "Value"],
            ["P50", `${metrics.iterationDurationP50.toFixed(2)} ms`],
            ["P95", `${metrics.iterationDurationP95.toFixed(2)} ms`],
            ["P99", `${metrics.iterationDurationP99.toFixed(2)} ms`],
        ];
        console.log((0, table_1.table)(iterationDuration) + "\n");
        // Checks
        console.log(chalk_1.default.bold.yellow("✓ Checks"));
        const checksData = [
            ["Metric", "Value"],
            ["Total", metrics.checksTotal.toString()],
            ["Succeeded", metrics.checksSucceeded.toString()],
            ["Failed", metrics.checksFailed.toString()],
            [
                "Success Rate",
                metrics.checksSuccessRate > 0
                    ? chalk_1.default.green(`${metrics.checksSuccessRate.toFixed(2)}%`)
                    : metrics.checksSuccessRate.toString(),
            ],
        ];
        console.log((0, table_1.table)(checksData) + "\n");
        // RPS by Endpoint (top 10)
        if (Object.keys(metrics.rpsPerEndpoint).length > 0) {
            console.log(chalk_1.default.bold.yellow("📈 RPS by Endpoint (Top 10)"));
            const rpsData = [["Endpoint", "Avg (req/s)", "P95 (req/s)", "Max (req/s)"]];
            Object.entries(metrics.rpsPerEndpoint)
                .sort((a, b) => b[1].p95 - a[1].p95) // Sort by p95 descending
                .slice(0, 10)
                .forEach(([endpoint, stats]) => {
                rpsData.push([
                    endpoint,
                    `${stats.avg.toFixed(2)}`,
                    `${stats.p95.toFixed(2)}`,
                    `${stats.max.toFixed(2)}`,
                ]);
            });
            console.log((0, table_1.table)(rpsData) + "\n");
        }
        // Requests Summary (top 10)
        if (Object.keys(metrics.requestsSummary).length > 0) {
            console.log(chalk_1.default.bold.yellow("📋 Requests Summary"));
            const summaryData = [["Endpoint", "Method", "Count", "Successful", "Failed", "Min (ms)", "Avg (ms)", "P95 (ms)", "P99 (ms)", "Max (ms)"]];
            Object.entries(metrics.requestsSummary)
                .sort((a, b) => b[1].p95ResponseTime - a[1].p95ResponseTime) // Sort by p95 descending
                .forEach(([, summary]) => {
                summaryData.push([
                    summary.url,
                    summary.method,
                    summary.count.toString(),
                    chalk_1.default.green(summary.successful.toString()),
                    summary.failed > 0 ? chalk_1.default.red(summary.failed.toString()) : chalk_1.default.gray(summary.failed.toString()),
                    `${summary.minResponseTime.toFixed(2)}`,
                    `${summary.avgResponseTime.toFixed(2)}`,
                    `${summary.p95ResponseTime.toFixed(2)}`,
                    `${summary.p99ResponseTime.toFixed(2)}`,
                    `${summary.maxResponseTime.toFixed(2)}`,
                ]);
            });
            console.log((0, table_1.table)(summaryData) + "\n");
        }
        // Error Requests Summary
        if (Object.keys(metrics.errorRequestsSummary).length > 0) {
            console.log(chalk_1.default.bold.yellow("❌ Error Requests Summary"));
            const summaryData = [["Endpoint", "Method", "Status", "Count", "Min (ms)", "Avg (ms)", "P95 (ms)", "P99 (ms)", "Max (ms)"]];
            metrics.errorRequestsDetailedSummary.forEach((error) => {
                summaryData.push([
                    error.url,
                    error.method,
                    String(error.status),
                    error.count.toString(),
                    `${error.minResponseTime.toFixed(2)}`,
                    `${error.avgResponseTime.toFixed(2)}`,
                    `${error.p95ResponseTime.toFixed(2)}`,
                    `${error.p99ResponseTime.toFixed(2)}`,
                    `${error.maxResponseTime.toFixed(2)}`,
                ]);
            });
            console.log((0, table_1.table)(summaryData) + "\n");
        }
        // Status
        const status = metrics.errorRate < 1
            ? chalk_1.default.green.bold("✓ PASS")
            : chalk_1.default.red.bold("✗ FAIL");
        console.log(chalk_1.default.bold(`Overall Status: ${status}`));
        console.log(chalk_1.default.gray(`Error Rate: ${metrics.errorRate.toFixed(4)}% (threshold: < 1%)`));
        console.log(chalk_1.default.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
    }
}
exports.CLIReporter = CLIReporter;
//# sourceMappingURL=cli.js.map