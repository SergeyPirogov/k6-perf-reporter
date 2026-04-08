"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
class CliReporter {
    constructor(collector) {
        this.collector = collector;
    }
    async generateReport(startTime, endTime, runId) {
        const summary = await this.collector.collectSummary(startTime, endTime, runId);
        return this.formatReport(summary);
    }
    formatReport(summary) {
        const lines = [];
        lines.push(chalk_1.default.bold.blue("\n=== K6 Performance Report ===\n"));
        lines.push(chalk_1.default.bold("Summary:"));
        lines.push(this.formatMetricLine("Duration (s)", summary.duration));
        lines.push(this.formatMetricLine("VUS Used", summary.vus.used.max));
        lines.push(this.formatMetricLine("VUS Limit", summary.vus.limit.max));
        lines.push(this.formatMetricLine("Pods", summary.pods.max));
        lines.push(this.formatMetricLine("Total Requests", summary.totalRequests));
        lines.push(this.formatMetricLine("RPS", summary.rps));
        lines.push(this.formatMetricLine("Total Errors", summary.totalErrors));
        lines.push(this.formatMetricLine("Error %", summary.errorPercent));
        lines.push("");
        lines.push(chalk_1.default.bold("Iterations:"));
        lines.push(this.formatMetricLine("Iterations", summary.totalIterations));
        lines.push(this.formatMetricLine("Iterations/s", summary.ips));
        lines.push("");
        lines.push(chalk_1.default.bold("HTTP Request Duration (ms):"));
        lines.push(this.formatMetricLine("Min", summary.httpReqsDuration.min));
        lines.push(this.formatMetricLine("Max", summary.httpReqsDuration.max));
        lines.push(this.formatMetricLine("Avg", summary.httpReqsDuration.avg));
        lines.push(this.formatMetricLine("P95", summary.httpReqsDuration.p95));
        lines.push(this.formatMetricLine("P99", summary.httpReqsDuration.p99));
        lines.push("");
        lines.push(chalk_1.default.bold("Iteration Duration (ms):"));
        lines.push(this.formatMetricLine("Min", summary.iterationDuration.min));
        lines.push(this.formatMetricLine("Max", summary.iterationDuration.max));
        lines.push(this.formatMetricLine("Avg", summary.iterationDuration.avg));
        lines.push(this.formatMetricLine("P95", summary.iterationDuration.p95));
        lines.push(this.formatMetricLine("P99", summary.iterationDuration.p99));
        lines.push("");
        lines.push(chalk_1.default.bold("Top 10 Slowest Requests - P95 (ms):"));
        if (summary.top10SlowestRequests.length > 0) {
            // Helper function to center text in a cell
            const centerText = (text, width) => {
                const textStr = text.toString();
                if (textStr.length > width) {
                    return textStr.substring(0, width);
                }
                const totalPadding = width - textStr.length;
                const leftPadding = Math.floor(totalPadding / 2);
                const rightPadding = totalPadding - leftPadding;
                return " ".repeat(leftPadding) + textStr + " ".repeat(rightPadding);
            };
            const rankWidth = 5;
            const methodWidth = 8;
            const urlWidth = 50;
            const p95Width = 12;
            lines.push(`  ${centerText("Rank", rankWidth)} ${centerText("Method", methodWidth)} ${centerText("URL", urlWidth)} ${centerText("P95 (ms)", p95Width)}`);
            lines.push(`  ${"-".repeat(rankWidth + methodWidth + urlWidth + p95Width + 4)}`);
            summary.top10SlowestRequests.forEach((request, index) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const rank = centerText((index + 1).toString(), rankWidth);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const method = centerText(request.method || "", methodWidth);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const url = (request.url || "").padEnd(urlWidth).substring(0, urlWidth);
                const p95 = centerText(request.value.toFixed(2), p95Width);
                lines.push(`  ${rank} ${method} ${url} ${p95}`);
            });
        }
        lines.push("");
        if (summary.httpRequestsStatsByUrl.length > 0) {
            // Helper function to center text in a cell
            const centerText = (text, width) => {
                const textStr = text.toString();
                if (textStr.length > width) {
                    return textStr.substring(0, width);
                }
                const totalPadding = width - textStr.length;
                const leftPadding = Math.floor(totalPadding / 2);
                const rightPadding = totalPadding - leftPadding;
                return " ".repeat(leftPadding) + textStr + " ".repeat(rightPadding);
            };
            // Separate successful and failed requests
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const successfulRequests = summary.httpRequestsStatsByUrl.filter((s) => s.successCount > 0);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const failedRequests = summary.httpRequestsStatsByUrl.filter((s) => s.failedCount > 0);
            // Successful Requests Table
            if (successfulRequests.length > 0) {
                lines.push(chalk_1.default.green("Successful Requests:"));
                const methodWidth = 8;
                const urlWidth = 40;
                const statusWidth = 8;
                const countWidth = 8;
                const numWidth = 9;
                lines.push(`  ${centerText("Method", methodWidth)} ${centerText("URL", urlWidth)} ${centerText("Status", statusWidth)} ${centerText("Count", countWidth)} ${centerText("RPS", numWidth)} ${centerText("Avg (ms)", numWidth)} ${centerText("Min (ms)", numWidth)} ${centerText("Max (ms)", numWidth)} ${centerText("P95 (ms)", numWidth)} ${centerText("P99 (ms)", numWidth)}`);
                lines.push(`  ${"-".repeat(methodWidth + urlWidth + statusWidth + countWidth + (numWidth * 5) + 9)}`);
                successfulRequests.forEach((stat) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const method = centerText(stat.method || "", methodWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const url = (stat.url || "").padEnd(urlWidth).substring(0, urlWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const status = centerText(stat.status || "", statusWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const count = centerText((stat.successCount || 0).toString(), countWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const rps = centerText((stat.rps || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const avg = centerText((stat.avg || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const min = centerText((stat.min || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const max = centerText((stat.max || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const p95 = centerText((stat.p95 || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const p99 = centerText((stat.p99 || 0).toFixed(2), numWidth);
                    lines.push(`  ${method} ${url} ${status} ${count} ${rps} ${avg} ${min} ${max} ${p95} ${p99}`);
                });
            }
            // Failed Requests Table
            if (failedRequests.length > 0) {
                lines.push("");
                lines.push(chalk_1.default.red("Failed Requests:"));
                const methodWidth = 8;
                const urlWidth = 40;
                const statusWidth = 8;
                const countWidth = 8;
                const numWidth = 9;
                lines.push(`  ${centerText("Method", methodWidth)} ${centerText("URL", urlWidth)} ${centerText("Status", statusWidth)} ${centerText("Count", countWidth)} ${centerText("RPS", numWidth)} ${centerText("Avg (ms)", numWidth)} ${centerText("Min (ms)", numWidth)} ${centerText("Max (ms)", numWidth)} ${centerText("P95 (ms)", numWidth)} ${centerText("P99 (ms)", numWidth)}`);
                lines.push(`  ${"-".repeat(methodWidth + urlWidth + statusWidth + countWidth + (numWidth * 5) + 9)}`);
                failedRequests.forEach((stat) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const method = centerText(stat.method || "", methodWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const url = (stat.url || "").padEnd(urlWidth).substring(0, urlWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const status = centerText(stat.status || "", statusWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const count = centerText((stat.failedCount || 0).toString(), countWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const rps = centerText((stat.rps || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const avg = centerText((stat.avg || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const min = centerText((stat.min || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const max = centerText((stat.max || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const p95 = centerText((stat.p95 || 0).toFixed(2), numWidth);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const p99 = centerText((stat.p99 || 0).toFixed(2), numWidth);
                    lines.push(`  ${method} ${url} ${status} ${count} ${rps} ${avg} ${min} ${max} ${p95} ${p99}`);
                });
            }
        }
        lines.push("");
        return lines.join("\n");
    }
    formatMetricLine(label, value) {
        return `  ${label.padEnd(15)} ${chalk_1.default.green(value.toFixed(2))}`;
    }
}
exports.CliReporter = CliReporter;
//# sourceMappingURL=cli-reporter.js.map