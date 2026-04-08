"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownReporter = void 0;
class MarkdownReporter {
    generate(metrics, testName) {
        let md = "";
        md += "# k6 Performance Test Report\n\n";
        md += `**Test:** ${testName}\n`;
        md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        // Summary section
        md += "## 📋 Summary\n\n";
        md += "| Metric | Value |\n";
        md += "| --- | --- |\n";
        md += `| Pods | ${metrics.podCount} |\n`;
        md += `| VUs | ${metrics.vusMax} / ${metrics.vusConfiguredMax} |\n`;
        md += `| Total Requests | ${metrics.totalRequests.toLocaleString()} |\n`;
        md += `| Successful | ${metrics.successfulRequests.toLocaleString()} |\n`;
        md += `| Failed | ${metrics.failedRequests.toLocaleString()} |\n`;
        md += `| Error Rate | ${metrics.errorRate.toFixed(4)}% |\n`;
        md += `| Dropped Iterations | ${metrics.droppedIterations} |\n\n`;
        // Response Times
        md += "## 📊 Response Times\n\n";
        md += "| Metric | Value |\n";
        md += "| --- | --- |\n";
        md += `| P50 | ${metrics.responseTimeP50.toFixed(2)} ms |\n`;
        md += `| P95 | ${metrics.responseTimeP95.toFixed(2)} ms |\n`;
        md += `| P99 | ${metrics.responseTimeP99.toFixed(2)} ms |\n\n`;
        // Iteration Duration
        md += "## ⏱️ Iteration Duration\n\n";
        md += "| Metric | Value |\n";
        md += "| --- | --- |\n";
        md += `| P50 | ${metrics.iterationDurationP50.toFixed(2)} ms |\n`;
        md += `| P95 | ${metrics.iterationDurationP95.toFixed(2)} ms |\n`;
        md += `| P99 | ${metrics.iterationDurationP99.toFixed(2)} ms |\n\n`;
        // Checks
        md += "## ✓ Checks\n\n";
        md += "| Metric | Value |\n";
        md += "| --- | --- |\n";
        md += `| Total | ${metrics.checksTotal} |\n`;
        md += `| Succeeded | ${metrics.checksSucceeded} |\n`;
        md += `| Failed | ${metrics.checksFailed} |\n`;
        md += `| Success Rate | ${metrics.checksSuccessRate.toFixed(2)}% |\n\n`;
        // RPS by Endpoint (top 10)
        if (Object.keys(metrics.rpsPerEndpoint).length > 0) {
            md += "## 📈 RPS by Endpoint (Top 10)\n\n";
            md += "| Endpoint | Avg (req/s) | P95 (req/s) | Max (req/s) |\n";
            md += "| --- | --- | --- | --- |\n";
            Object.entries(metrics.rpsPerEndpoint)
                .sort((a, b) => b[1].p95 - a[1].p95)
                .slice(0, 10)
                .forEach(([endpoint, stats]) => {
                md += `| ${endpoint} | ${stats.avg.toFixed(2)} | ${stats.p95.toFixed(2)} | ${stats.max.toFixed(2)} |\n`;
            });
            md += "\n";
        }
        // Requests Summary
        if (Object.keys(metrics.requestsSummary).length > 0) {
            md += "## 📋 Requests Summary\n\n";
            md += "| Endpoint | Method | Count | Successful | Failed | Min (ms) | Avg (ms) | P95 (ms) | P99 (ms) | Max (ms) |\n";
            md += "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
            Object.entries(metrics.requestsSummary)
                .sort((a, b) => b[1].p95ResponseTime - a[1].p95ResponseTime)
                .forEach(([, summary]) => {
                md += `| ${summary.url} | ${summary.method} | ${summary.count} | ${summary.successful} | ${summary.failed} | ${summary.minResponseTime.toFixed(2)} | ${summary.avgResponseTime.toFixed(2)} | ${summary.p95ResponseTime.toFixed(2)} | ${summary.p99ResponseTime.toFixed(2)} | ${summary.maxResponseTime.toFixed(2)} |\n`;
            });
            md += "\n";
        }
        // Error Requests Summary
        if (Object.keys(metrics.errorRequestsSummary).length > 0) {
            md += "## ❌ Error Requests Summary\n\n";
            md += "| Endpoint | Method | Status | Count | Min (ms) | Avg (ms) | P95 (ms) | P99 (ms) | Max (ms) |\n";
            md += "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
            metrics.errorRequestsDetailedSummary.forEach((error) => {
                md += `| ${error.url} | ${error.method} | ${error.status} | ${error.count} | ${error.minResponseTime.toFixed(2)} | ${error.avgResponseTime.toFixed(2)} | ${error.p95ResponseTime.toFixed(2)} | ${error.p99ResponseTime.toFixed(2)} | ${error.maxResponseTime.toFixed(2)} |\n`;
            });
            md += "\n";
        }
        // Overall Status
        md += "## Overall Status\n\n";
        const status = metrics.errorRate < 1 ? "✓ PASS" : "✗ FAIL";
        md += `**Status:** ${status}\n`;
        md += `**Error Rate:** ${metrics.errorRate.toFixed(4)}% (threshold: < 1%)\n`;
        return md;
    }
}
exports.MarkdownReporter = MarkdownReporter;
//# sourceMappingURL=markdown.js.map