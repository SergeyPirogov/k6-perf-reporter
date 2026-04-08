import chalk from "chalk";
import { ReporterResponse } from "../data-collector";
import { table } from "table";

export class CliReporter {
  report(data: ReporterResponse): void {
    this.printHeader(data);
    this.printReport(data);
  }

  private printHeader(data: ReporterResponse): void {
    console.log("\n---");
    console.log(`Run ID: ${data.runId}`);
    console.log(`Start: ${data.startTime}`);
    console.log(`End: ${data.endTime}\n`);
  }

  private printReport(data: ReporterResponse): void {
    const reportData = data.data as Record<string, unknown>;

    if (reportData.checks) {
      const checks = reportData.checks as Record<string, number>;
      const passRate = typeof checks.passRate === "number" ? checks.passRate : 0;
      const checkmark = passRate === 100 ? "✓" : "✗";
      console.log(
        `checks${this.padRight("checks", 30)}: ${chalk.cyan(passRate.toFixed(2) + "%")} ${checkmark} ${chalk.cyan(String(checks.passes))} ${checkmark === "✗" ? "✗ " + chalk.cyan(String(checks.fails || 0)) : ""}`
      );
    }

    if (reportData.httpReqs) {
      const httpReqs = reportData.httpReqs as Record<string, number>;
      console.log(
        `http_reqs${this.padRight("http_reqs", 30)}: ${chalk.cyan(String(httpReqs.total))} ${chalk.gray(httpReqs.rate.toFixed(6) + "/s")}`
      );
    }

    if (reportData.httpReqFailed) {
      const failed = reportData.httpReqFailed as Record<string, number>;
      const failureRate = typeof failed.failureRate === "number" ? failed.failureRate : 0;
      const checkmark = failureRate === 0 ? "✓" : "✗";
      console.log(
        `http_req_failed${this.padRight("http_req_failed", 30)}: ${chalk.cyan(failureRate.toFixed(2) + "%")} ${checkmark} ${chalk.cyan(String(failed.failed || 0))} ✗ ${chalk.cyan(String(failed.total || 0))}`
      );
    }

    if (reportData.errorResponses) {
      const errorResponses = reportData.errorResponses as Record<string, number>;
      console.log(
        `error_responses${this.padRight("error_responses", 30)}: ${chalk.cyan(String(errorResponses.count))} ${chalk.gray(errorResponses.rate.toFixed(6) + "/s")}`
      );
    }

    if (reportData.httpReqDuration) {
      const duration = reportData.httpReqDuration as Record<string, number>;
      console.log(
        `http_req_duration${this.padRight("http_req_duration", 30)}: avg=${chalk.cyan(this.formatDuration(duration.avg || 0))} min=${chalk.cyan(this.formatDuration(duration.min || 0))} med=${chalk.cyan(this.formatDuration((duration.min || 0) + (duration.max || 0) / 2))} max=${chalk.cyan(this.formatDuration(duration.max || 0))} p(90)=${chalk.cyan(this.formatDuration(duration.p90 || 0))} p(95)=${chalk.cyan(this.formatDuration(duration.p95 || 0))}`
      );
    }

    if (reportData.iterations) {
      const iterations = reportData.iterations as Record<string, number>;
      console.log(
        `iterations${this.padRight("iterations", 30)}: ${chalk.cyan(String(iterations.total))} ${chalk.gray(iterations.rate.toFixed(6) + "/s")}`
      );
    }

    if (reportData.iterationDuration) {
      const itDuration = reportData.iterationDuration as Record<string, number>;
      console.log(
        `iteration_duration${this.padRight("iteration_duration", 30)}: avg=${chalk.cyan(this.formatDuration(itDuration.avg || 0))} min=${chalk.cyan(this.formatDuration(itDuration.min || 0))} med=${chalk.cyan(this.formatDuration((itDuration.min || 0) + (itDuration.max || 0) / 2))} max=${chalk.cyan(this.formatDuration(itDuration.max || 0))} p(90)=${chalk.cyan(this.formatDuration(itDuration.p90 || 0))} p(95)=${chalk.cyan(this.formatDuration(itDuration.p95 || 0))}`
      );
    }

    if (reportData.vus) {
      const vus = reportData.vus as Record<string, number>;
      console.log(
        `vus${this.padRight("vus", 30)}: ${chalk.cyan(String(vus.current))} min=${chalk.cyan(String(vus.min))} max=${chalk.cyan(String(vus.max))}`
      );
    }

    if (reportData.vusMax) {
      const vusMax = reportData.vusMax as Record<string, number>;
      console.log(
        `vus_max${this.padRight("vus_max", 30)}: ${chalk.cyan(String(vusMax.max))} min=${chalk.cyan(String(vusMax.min))} max=${chalk.cyan(String(vusMax.max))}`
      );
    }

    if (reportData.topSlowUrls) {
      const topSlowUrls = reportData.topSlowUrls as Record<string, unknown>;
      const urls = topSlowUrls.urls as Array<{ method: string; url: string; p95Duration: number }>;
      if (urls && urls.length > 0) {
        console.log("\nTop 10 Slowest URLs:");
        console.log("");
        const tableData = [
          ["Method", "URL", "p(95) ms"],
          ...urls.map((u) => [u.method, u.url, this.formatDuration(u.p95Duration)]),
        ];
        console.log(table(tableData, { border: { topBody: "─", topJoin: "", topLeft: "", topRight: "", bottomBody: "", bottomJoin: "", bottomLeft: "", bottomRight: "", bodyLeft: "", bodyRight: "", bodyJoin: "", joinBody: "─", joinLeft: "", joinRight: "", joinJoin: "" }, drawHorizontalLine: (index) => index === 1, columns: { 0: { alignment: "left" }, 1: { alignment: "left" }, 2: { alignment: "left" } } }));
      }
    }

    if (reportData.errorRequests) {
      const errorRequests = reportData.errorRequests as Record<string, unknown>;
      const errors = errorRequests.errors as Array<{ method: string; url: string; status: number; p95Duration: number; count: number }>;
      if (errors && errors.length > 0) {
        console.log("\nTop Error Requests:");
        console.log("");
        const tableData = [
          ["Method", "URL", "Code", "Count"],
          ...errors.map((e) => [e.method, e.url, String(e.status), String(e.count)]),
        ];
        console.log(table(tableData, { border: { topBody: "─", topJoin: "", topLeft: "", topRight: "", bottomBody: "", bottomJoin: "", bottomLeft: "", bottomRight: "", bodyLeft: "", bodyRight: "", bodyJoin: "", joinBody: "─", joinLeft: "", joinRight: "", joinJoin: "" }, drawHorizontalLine: (index) => index === 1, columns: { 0: { alignment: "left" }, 1: { alignment: "left" }, 2: { alignment: "left" }, 3: { alignment: "left" } } }));
      }
    }

    if (reportData.successRequests) {
      const successRequests = reportData.successRequests as Record<string, unknown>;
      const requests = successRequests.requests as Array<{ method: string; url: string; status: number; count: number; min: number; avg: number; p95: number }>;
      if (requests && requests.length > 0) {
        console.log("\nTop Successful Requests:");
        console.log("");
        const tableData = [
          ["Method", "URL", "Status", "Count", "Min", "Avg", "p(95)"],
          ...requests.map((r) => [r.method, r.url, String(r.status), String(r.count), this.formatDuration(r.min), this.formatDuration(r.avg), this.formatDuration(r.p95)]),
        ];
        console.log(table(tableData, { border: { topBody: "─", topJoin: "", topLeft: "", topRight: "", bottomBody: "", bottomJoin: "", bottomLeft: "", bottomRight: "", bodyLeft: "", bodyRight: "", bodyJoin: "", joinBody: "─", joinLeft: "", joinRight: "", joinJoin: "" }, drawHorizontalLine: (index) => index === 1, columns: { 0: { alignment: "left" }, 1: { alignment: "left" }, 2: { alignment: "left" }, 3: { alignment: "left" }, 4: { alignment: "left" }, 5: { alignment: "left" }, 6: { alignment: "left" } } }));
      }
    }

    if (reportData.errorResponsesText) {
      const errorResponsesText = reportData.errorResponsesText as Record<string, unknown>;
      const responses = errorResponsesText.responses as Array<{ url: string; method: string; status: number; error: string }>;
      if (responses && responses.length > 0) {
        console.log("\nError Responses:");
        console.log("");
        const tableData = [
          ["Method", "URL", "Status", "Error"],
          ...responses.map((r) => {
            const error = r.error || "";
            // Extract path only from URL
            let url = r.url;
            try {
              const urlObj = new URL(url);
              url = urlObj.pathname;
            } catch {
              // If not a full URL, use as-is
            }
            return [r.method, url, String(r.status), error];
          }),
        ];
        console.log(table(tableData, { border: { topBody: "─", topJoin: "", topLeft: "", topRight: "", bottomBody: "", bottomJoin: "", bottomLeft: "", bottomRight: "", bodyLeft: "", bodyRight: "", bodyJoin: "", joinBody: "─", joinLeft: "", joinRight: "", joinJoin: "" }, drawHorizontalLine: (index) => index === 1, columns: { 0: { alignment: "left" }, 1: { alignment: "left" }, 2: { alignment: "left" }, 3: { alignment: "left" } } }));
      }
    }
  }

  private padRight(label: string, width: number): string {
    return ".".repeat(Math.max(0, width - label.length));
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
