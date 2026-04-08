"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ReportGenerator {
    constructor(influxClient) {
        this.influxClient = influxClient;
    }
    async generateMetrics(scenario, startTime, endTime) {
        console.log(chalk_1.default.blue(`  📍 Fetching metrics for scenario: ${chalk_1.default.bold(scenario)}`));
        console.log(chalk_1.default.gray(`     Time range: ${startTime} to ${endTime}`));
        try {
            console.log(chalk_1.default.gray("     ├─ Querying response time percentiles..."));
            const startPercentilesTime = Date.now();
            const percentiles = await this.influxClient.getResponseTimePercentiles(scenario, startTime, endTime);
            const percentilesDuration = Date.now() - startPercentilesTime;
            console.log(chalk_1.default.green(`     ├─ ✓ Response times: P50=${percentiles.p50.toFixed(2)}ms, P95=${percentiles.p95.toFixed(2)}ms, P99=${percentiles.p99.toFixed(2)}ms (${percentilesDuration}ms)`));
            console.log(chalk_1.default.gray("     ├─ Querying request statistics..."));
            const startStatsTime = Date.now();
            const stats = await this.influxClient.getRequestStats(scenario, startTime, endTime);
            const statsDuration = Date.now() - startStatsTime;
            console.log(chalk_1.default.green(`     ├─ ✓ Requests: total=${stats.total}, success=${stats.success}, failed=${stats.failed} (${statsDuration}ms)`));
            console.log(chalk_1.default.gray("     └─ Querying error breakdown..."));
            const startErrorsTime = Date.now();
            const errors = await this.influxClient.getErrorBreakdown(scenario, startTime, endTime);
            const errorsDuration = Date.now() - startErrorsTime;
            const errorCount = Array.from(errors.values()).reduce((sum, count) => sum + count, 0);
            console.log(chalk_1.default.green(`     └─ ✓ Errors: ${errors.size} unique error types, ${errorCount} total errors (${errorsDuration}ms)`));
            const successRate = stats.total
                ? (stats.success / stats.total) * 100
                : 0;
            const errorRate = 100 - successRate;
            // Calculate throughput (requests per second)
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            const durationSeconds = (endDate.getTime() - startDate.getTime()) / 1000 || 1;
            const throughput = stats.total / durationSeconds;
            console.log(chalk_1.default.blue(`  📊 Metrics summary: Error rate=${errorRate.toFixed(2)}%, Throughput=${throughput.toFixed(2)} req/s`));
            return {
                responseTimeP50: percentiles.p50,
                responseTimeP95: percentiles.p95,
                responseTimeP99: percentiles.p99,
                throughput,
                totalRequests: stats.total,
                successfulRequests: stats.success,
                failedRequests: stats.failed,
                errorRate,
                errors,
            };
        }
        catch (error) {
            console.error(chalk_1.default.red("  ❌ Error fetching metrics:"), error instanceof Error ? error.message : error);
            throw error;
        }
    }
    generateHTMLReport(metrics, testName) {
        const errorRows = Array.from(metrics.errors.entries())
            .map(([error, count]) => `<tr><td>${error}</td><td>${count}</td></tr>`)
            .join("");
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>k6 Test Report - ${testName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 1.1em;
      opacity: 0.9;
    }
    .content {
      padding: 40px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      border-radius: 8px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .metric-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    .metric-card.warning {
      border-left-color: #f59e0b;
    }
    .metric-card.danger {
      border-left-color: #ef4444;
    }
    .metric-label {
      font-size: 0.85em;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #1f2937;
    }
    .metric-unit {
      font-size: 0.6em;
      color: #9ca3af;
      margin-left: 4px;
    }
    .section-title {
      font-size: 1.5em;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .footer {
      background: #f3f4f6;
      padding: 20px 40px;
      text-align: center;
      color: #6b7280;
      font-size: 0.9em;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .status-badge.pass {
      background: #d1fae5;
      color: #065f46;
    }
    .status-badge.fail {
      background: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>k6 Performance Test Report</h1>
      <p>${testName}</p>
      <p style="font-size: 0.9em; margin-top: 10px;">${new Date().toLocaleString()}</p>
    </div>

    <div class="content">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Response Time (p50)</div>
          <div class="metric-value">${metrics.responseTimeP50.toFixed(2)}<span class="metric-unit">ms</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Response Time (p95)</div>
          <div class="metric-value">${metrics.responseTimeP95.toFixed(2)}<span class="metric-unit">ms</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Response Time (p99)</div>
          <div class="metric-value">${metrics.responseTimeP99.toFixed(2)}<span class="metric-unit">ms</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Throughput</div>
          <div class="metric-value">${metrics.throughput.toFixed(2)}<span class="metric-unit">req/s</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Requests</div>
          <div class="metric-value">${metrics.totalRequests}</div>
        </div>
        <div class="metric-card ${metrics.errorRate > 5 ? "warning" : ""} ${metrics.errorRate > 10 ? "danger" : ""}">
          <div class="metric-label">Error Rate</div>
          <div class="metric-value">${metrics.errorRate.toFixed(2)}<span class="metric-unit">%</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Successful Requests</div>
          <div class="metric-value">${metrics.successfulRequests}</div>
        </div>
        <div class="metric-card ${metrics.failedRequests > 0 ? "danger" : ""}">
          <div class="metric-label">Failed Requests</div>
          <div class="metric-value">${metrics.failedRequests}</div>
        </div>
      </div>

      <div class="section-title">Summary</div>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <p><strong>Test Name:</strong> ${testName}</p>
        <p><strong>Status:</strong> ${metrics.errorRate < 5 ? '<span class="status-badge pass">PASS</span>' : '<span class="status-badge fail">FAIL</span>'}</p>
        <p><strong>Execution Time:</strong> ${new Date().toISOString()}</p>
      </div>

      ${metrics.errors.size > 0 ? `
      <div class="section-title">Error Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Error Type</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${errorRows}
        </tbody>
      </table>
      ` : ""}
    </div>

    <div class="footer">
      <p>Generated by k6-perf-reporter</p>
    </div>
  </div>
</body>
</html>
`;
        return html;
    }
    generateCSVReport(metrics, testName) {
        const timestamp = new Date().toISOString();
        let csv = "k6 Performance Test Report\n";
        csv += `Test Name,${testName}\n`;
        csv += `Generated,${timestamp}\n\n`;
        csv += "RESPONSE TIME METRICS\n";
        csv += `Metric,Value (ms)\n`;
        csv += `P50,${metrics.responseTimeP50.toFixed(2)}\n`;
        csv += `P95,${metrics.responseTimeP95.toFixed(2)}\n`;
        csv += `P99,${metrics.responseTimeP99.toFixed(2)}\n\n`;
        csv += "THROUGHPUT & REQUESTS\n";
        csv += `Metric,Value\n`;
        csv += `Throughput (req/s),${metrics.throughput.toFixed(2)}\n`;
        csv += `Total Requests,${metrics.totalRequests}\n`;
        csv += `Successful Requests,${metrics.successfulRequests}\n`;
        csv += `Failed Requests,${metrics.failedRequests}\n`;
        csv += `Error Rate (%),${metrics.errorRate.toFixed(2)}\n\n`;
        if (metrics.errors.size > 0) {
            csv += "ERROR BREAKDOWN\n";
            csv += "Error Type,Count\n";
            metrics.errors.forEach((count, error) => {
                csv += `"${error}",${count}\n`;
            });
        }
        return csv;
    }
    generateJSONReport(metrics, testName) {
        const errorObject = Object.fromEntries(metrics.errors);
        const report = {
            testName,
            generatedAt: new Date().toISOString(),
            metrics: {
                responseTime: {
                    p50: metrics.responseTimeP50,
                    p95: metrics.responseTimeP95,
                    p99: metrics.responseTimeP99,
                },
                throughput: {
                    requestsPerSecond: metrics.throughput,
                },
                requests: {
                    total: metrics.totalRequests,
                    successful: metrics.successfulRequests,
                    failed: metrics.failedRequests,
                    errorRate: metrics.errorRate,
                },
                errors: errorObject,
            },
        };
        return JSON.stringify(report, null, 2);
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=reports.js.map