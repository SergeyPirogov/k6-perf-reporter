"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
class CLIReporter {
    printMetricsTable(metrics, testName) {
        console.log("\n" + chalk_1.default.bold.cyan("━━━ k6 Performance Test Report ━━━\n"));
        console.log(chalk_1.default.bold(`Test: ${testName}`));
        console.log(chalk_1.default.gray(`Generated: ${new Date().toLocaleString()}\n`));
        // Response Times
        console.log(chalk_1.default.bold.yellow("📊 Response Times"));
        const responseTimes = [
            ["Metric", "Value"],
            ["P50", `${metrics.responseTimeP50.toFixed(2)} ms`],
            ["P95", `${metrics.responseTimeP95.toFixed(2)} ms`],
            ["P99", `${metrics.responseTimeP99.toFixed(2)} ms`],
        ];
        console.log((0, table_1.table)(responseTimes) + "\n");
        // Throughput & Requests
        console.log(chalk_1.default.bold.yellow("⚡ Throughput & Requests"));
        const throughputData = [
            ["Metric", "Value"],
            ["Throughput", `${metrics.throughput.toFixed(2)} req/s`],
            ["Total Requests", metrics.totalRequests.toString()],
            [
                "Successful Requests",
                chalk_1.default.green(metrics.successfulRequests.toString()),
            ],
            [
                "Failed Requests",
                metrics.failedRequests > 0
                    ? chalk_1.default.red(metrics.failedRequests.toString())
                    : metrics.failedRequests.toString(),
            ],
        ];
        console.log((0, table_1.table)(throughputData) + "\n");
        // Error Rate
        console.log(chalk_1.default.bold.yellow("❌ Error Analysis"));
        const errorRateColor = metrics.errorRate < 1
            ? chalk_1.default.green
            : metrics.errorRate < 5
                ? chalk_1.default.yellow
                : chalk_1.default.red;
        const errorData = [
            ["Metric", "Value"],
            ["Error Rate", errorRateColor(`${metrics.errorRate.toFixed(2)} %`)],
        ];
        console.log((0, table_1.table)(errorData) + "\n");
        // Error Breakdown
        if (metrics.errors.size > 0) {
            console.log(chalk_1.default.bold.yellow("🔍 Error Breakdown"));
            const errorBreakdown = [["Error Type", "Count"]];
            metrics.errors.forEach((count, error) => {
                errorBreakdown.push([error, count.toString()]);
            });
            console.log((0, table_1.table)(errorBreakdown) + "\n");
        }
        // Status
        const status = metrics.errorRate < 5
            ? chalk_1.default.green.bold("✓ PASS")
            : chalk_1.default.red.bold("✗ FAIL");
        console.log(chalk_1.default.bold(`Overall Status: ${status}`));
        console.log(chalk_1.default.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
    }
}
exports.CLIReporter = CLIReporter;
//# sourceMappingURL=cli-reporter.js.map