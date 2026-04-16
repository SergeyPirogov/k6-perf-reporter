import { writeFileSync } from "fs";
import { ReporterResponse } from "../data-collector";

export class MarkdownReporter {
  report(data: ReporterResponse, outputPath?: string): void {
    const markdown = this.generateMarkdown(data);

    if (outputPath) {
      writeFileSync(outputPath, markdown);
      console.log(`Report saved to ${outputPath}`);
    } else {
      console.log(markdown);
    }
  }

  private generateMarkdown(data: ReporterResponse): string {
    const reportData = data.data as Record<string, unknown>;
    let markdown = "";

    // Header
    markdown += `# k6 Performance Test Report\n\n`;
    markdown += `- **Run ID:** ${data.runId}\n`;
    markdown += `- **Start:** ${data.startTime}\n`;
    markdown += `- **End:** ${data.endTime}\n\n`;

    // Summary section
    markdown += this.generateSummary(reportData);

    // Main metrics
    markdown += this.generateMetrics(reportData);

    // Tables
    markdown += this.generateTables(reportData);

    return markdown;
  }

  private generateSummary(reportData: Record<string, unknown>): string {
    let summary = "## Summary\n\n";

    let errorPercent = 0;
    let failedChecks = 0;

    if (reportData.httpReqFailed) {
      const failed = reportData.httpReqFailed as Record<string, number>;
      errorPercent = typeof failed.failureRate === "number" ? failed.failureRate : 0;
    }

    if (reportData.checks) {
      const checks = reportData.checks as Record<string, number>;
      failedChecks = typeof checks.fails === "number" ? checks.fails : 0;
    }

    const isSuccess = errorPercent < 1 && failedChecks === 0;
    const status = isSuccess ? "✓ PASS" : "✗ FAIL";

    summary += `**Status:** ${status}\n\n`;
    summary += `| Metric | Value |\n`;
    summary += `|--------|-------|\n`;
    summary += `| Error Rate | ${errorPercent.toFixed(2)}% |\n`;
    summary += `| Failed Checks | ${failedChecks} |\n\n`;

    return summary;
  }

  private generateMetrics(reportData: Record<string, unknown>): string {
    let metrics = "## Metrics\n\n";

    if (reportData.checks) {
      const checks = reportData.checks as Record<string, number>;
      const passRate = typeof checks.passRate === "number" ? checks.passRate : 0;
      metrics += `- **Checks:** ${passRate.toFixed(2)}% (${checks.passes} ✓${checks.fails ? `, ${checks.fails} ✗` : ""})\n`;
    }

    if (reportData.rpsAggregated) {
      const rpsAgg = reportData.rpsAggregated as Record<string, unknown>;
      const avg = typeof rpsAgg.avg === "number" ? rpsAgg.avg : 0;
      const p95 = typeof rpsAgg.p95 === "number" ? rpsAgg.p95 : 0;
      const max = typeof rpsAgg.max === "number" ? rpsAgg.max : 0;
      metrics += `- **RPS:** avg=${avg.toFixed(2)}, p(95)=${p95.toFixed(2)}, max=${max.toFixed(2)}\n`;
    }

    if (reportData.httpReqs) {
      const httpReqs = reportData.httpReqs as Record<string, number>;
      metrics += `- **HTTP Requests:** ${httpReqs.total} (${httpReqs.rate.toFixed(6)}/s)\n`;
    }

    if (reportData.iterations) {
      const iterations = reportData.iterations as Record<string, number>;
      metrics += `- **Iterations:** ${iterations.total} (${iterations.rate.toFixed(6)}/s)\n`;
    }

    if (reportData.httpReqDuration) {
      const duration = reportData.httpReqDuration as Record<string, number>;
      metrics += `- **HTTP Duration:** avg=${this.formatDuration(duration.avg || 0)}, p(95)=${this.formatDuration(duration.p95 || 0)}\n`;
    }

    if (reportData.vus) {
      const vus = reportData.vus as Record<string, number>;
      metrics += `- **VUs:** ${vus.current} (min=${vus.min}, max=${vus.max})\n`;
    }

    metrics += "\n";
    return metrics;
  }

  private generateTables(reportData: Record<string, unknown>): string {
    let tables = "";

    if (reportData.topSlowUrls) {
      const topSlowUrls = reportData.topSlowUrls as Record<string, unknown>;
      const urls = topSlowUrls.urls as Array<{ method: string; url: string; p95Duration: number }>;
      if (urls && urls.length > 0) {
        tables += "## Top 10 Slowest URLs\n\n";
        const tableData = [
          ["#", "Method", "URL", "p(95)"],
          ...urls.map((u, i) => [String(i + 1), u.method, u.url, this.formatDuration(u.p95Duration)]),
        ];
        tables += this.tableToMarkdown(tableData) + "\n\n";
      }
    }

    if (reportData.rpsPerUrl) {
      const rpsPerUrl = reportData.rpsPerUrl as Record<string, unknown>;
      const urls = rpsPerUrl.urls as Array<{ method: string; url: string; count: number; rps: { avg: number; p95: number; max: number } }>;
      if (urls && urls.length > 0) {
        tables += "## RPS per URL\n\n";
        const tableData = [
          ["#", "Method", "URL", "Count", "avg", "p(95)", "max"],
          ...urls.map((u, i) => [String(i + 1), u.method, u.url, String(u.count), u.rps.avg.toFixed(2), u.rps.p95.toFixed(2), u.rps.max.toFixed(2)]),
        ];
        tables += this.tableToMarkdown(tableData) + "\n\n";
      }
    }

    if (reportData.successRequests) {
      const successRequests = reportData.successRequests as Record<string, unknown>;
      const requests = successRequests.requests as Array<{ method: string; url: string; status: number; count: number; min: number; avg: number; p95: number }>;
      if (requests && requests.length > 0) {
        tables += "## Top Successful Requests\n\n";
        const tableData = [
          ["#", "Method", "URL", "Status", "Count", "Min", "Avg", "p(95)"],
          ...requests.map((r, i) => [String(i + 1), r.method, r.url, String(r.status), String(r.count), this.formatDuration(r.min), this.formatDuration(r.avg), this.formatDuration(r.p95)]),
        ];
        tables += this.tableToMarkdown(tableData) + "\n\n";
      }
    }

    if (reportData.errorRequests) {
      const errorRequests = reportData.errorRequests as Record<string, unknown>;
      const errors = errorRequests.errors as Array<{ method: string; url: string; status: number; count: number }>;
      if (errors && errors.length > 0) {
        tables += "## Top Error Requests\n\n";
        const tableData = [
          ["#", "Method", "URL", "Code", "Count"],
          ...errors.map((e, i) => [String(i + 1), e.method, e.url, String(e.status), String(e.count)]),
        ];
        tables += this.tableToMarkdown(tableData) + "\n\n";
      }
    }

    if (reportData.errorResponsesText) {
      const errorResponsesText = reportData.errorResponsesText as Record<string, unknown>;
      const responses = errorResponsesText.responses as Array<{ url: string; method: string; status: number; error: string; count: number }>;
      if (responses && responses.length > 0) {
        tables += "## Error Responses\n\n";
        const tableData = [
          ["#", "Method", "URL", "Status", "Error", "Count"],
          ...responses.map((r, i) => {
            let url = r.url;
            try {
              const urlObj = new URL(url);
              url = urlObj.pathname;
            } catch {
              // If not a full URL, use as-is
            }
            return [String(i + 1), r.method, url, String(r.status), r.error, String(r.count)];
          }),
        ];
        tables += this.tableToMarkdown(tableData) + "\n\n";
      }
    }

    return tables;
  }

  private tableToMarkdown(tableData: string[][]): string {
    if (tableData.length === 0) {
      return "";
    }

    const [headers, ...rows] = tableData;
    let markdown = "| " + headers.join(" | ") + " |\n";
    markdown += "|" + headers.map(() => " --- ").join("|") + "|\n";
    rows.forEach((row) => {
      markdown += "| " + row.join(" | ") + " |\n";
    });

    return markdown;
  }

  private formatDuration(ms: number): string {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}µs`;
    }
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }
}
