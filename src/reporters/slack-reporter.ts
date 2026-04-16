import { WebClient } from "@slack/web-api";
import { KnownBlock } from "@slack/types";
import { ReporterResponse } from "../data-collector";
import { table } from "table";

export class SlackReporter {
  private client: WebClient;
  private channel: string;
  private readonly MAX_BLOCKS_PER_MESSAGE = 50;
  private readonly MAX_BLOCK_TEXT_LENGTH = 3000;
  private readonly MAX_CELL_LENGTH = 80;

  constructor(token: string, channel: string) {
    this.client = new WebClient(token);
    if (!channel || channel.trim() === "") {
      throw new Error("Slack channel is required and cannot be empty");
    }
    this.channel = channel;
  }

  async report(data: ReporterResponse): Promise<void> {
    const blocks = this.generateBlocks(data);
    await this.sendMessages(blocks);
  }

  private generateBlocks(data: ReporterResponse): KnownBlock[] {
    const reportData = data.data as Record<string, unknown>;
    const blocks: KnownBlock[] = [];

    blocks.push(...this.generateHeaderBlocks(data));
    blocks.push(...this.generateMetricsBlocks(reportData));
    blocks.push(...this.generateSummaryBlocks(reportData));
    blocks.push(...this.generateTableBlocks(reportData));

    return blocks;
  }

  private generateHeaderBlocks(data: ReporterResponse): KnownBlock[] {
    const formatDate = (dateStr: string): string => {
      try {
        const date = new Date(dateStr);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        const hours = String(date.getUTCHours()).padStart(2, "0");
        const minutes = String(date.getUTCMinutes()).padStart(2, "0");
        const seconds = String(date.getUTCSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      } catch {
        return dateStr;
      }
    };

    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "k6 Performance Test Report",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Run ID:* ${data.runId} | *Start:* ${formatDate(data.startTime)} | *End:* ${formatDate(data.endTime)}`,
          },
        ],
      },
      {
        type: "divider",
      },
    ];
  }

  private generateSummaryBlocks(reportData: Record<string, unknown>): KnownBlock[] {
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
    const status = isSuccess ? "PASS" : "FAIL";
    const statusEmoji = isSuccess ? "✅" : ":triangular_flag_on_post:";

    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusEmoji} *${status}* • Error Rate: ${errorPercent.toFixed(2)}%`,
        },
      },
      {
        type: "divider",
      },
    ];
  }

  private generateMetricsBlocks(reportData: Record<string, unknown>): KnownBlock[] {
    let metrics = "";

    if (reportData.duration) {
      const duration = reportData.duration as Record<string, unknown>;
      const durationSeconds = typeof duration.durationSeconds === "number" ? duration.durationSeconds : 0;
      metrics += `• Test Duration: ${this.formatTestDuration(durationSeconds)}\n`;
    }

    if (reportData.checks) {
      const checks = reportData.checks as Record<string, number>;
      const passRate = typeof checks.passRate === "number" ? checks.passRate : 0;
      metrics += `• Checks: ${passRate.toFixed(2)}% (${checks.passes} ✓${checks.fails ? `, ${checks.fails} ✗` : ""})\n`;
    }

    if (reportData.rpsAggregated) {
      const rpsAgg = reportData.rpsAggregated as Record<string, unknown>;
      const avg = typeof rpsAgg.avg === "number" ? rpsAgg.avg : 0;
      const p95 = typeof rpsAgg.p95 === "number" ? rpsAgg.p95 : 0;
      const max = typeof rpsAgg.max === "number" ? rpsAgg.max : 0;
      metrics += `• RPS: avg=${avg.toFixed(2)} · p95=${p95.toFixed(2)} · max=${max.toFixed(2)}\n`;
    }

    if (reportData.httpReqs) {
      const httpReqs = reportData.httpReqs as Record<string, number>;
      metrics += `• HTTP Requests: ${httpReqs.total} (${httpReqs.rate.toFixed(2)}/s)\n`;
    }

    if (reportData.iterations) {
      const iterations = reportData.iterations as Record<string, number>;
      metrics += `• Iterations: ${iterations.total} (${iterations.rate.toFixed(2)}/s)\n`;
    }

    if (reportData.httpReqDuration) {
      const duration = reportData.httpReqDuration as Record<string, number>;
      metrics += `• HTTP Duration: avg=${this.formatDuration(duration.avg || 0)} · p95=${this.formatDuration(duration.p95 || 0)}\n`;
    }

    if (reportData.vus) {
      const vus = reportData.vus as Record<string, number>;
      metrics += `• VUs: ${vus.current} (min=${vus.min}, max=${vus.max})\n`;
    }

    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Metrics*\n${metrics}`,
        },
      },
    ];
  }

  private generateTableBlocks(reportData: Record<string, unknown>): KnownBlock[] {
    const blocks: KnownBlock[] = [];

    if (reportData.topSlowUrls) {
      const topSlowUrls = reportData.topSlowUrls as Record<string, unknown>;
      const urls = topSlowUrls.urls as Array<{ method: string; url: string; p95Duration: number }>;
      if (urls && urls.length > 0) {
        const tableData = [
          ["#", "Method", "URL", "p(95)"],
          ...urls.map((u, i) => [String(i + 1), u.method, u.url, this.formatDuration(u.p95Duration)]),
        ];
        blocks.push(...this.createSafeTableBlocks("Top 10 Slowest URLs", tableData));
      }
    }

    if (reportData.rpsPerUrl) {
      const rpsPerUrl = reportData.rpsPerUrl as Record<string, unknown>;
      const urls = rpsPerUrl.urls as Array<{ method: string; url: string; count: number; rps: { avg: number; p95: number; max: number } }>;
      if (urls && urls.length > 0) {
        const tableData = [
          ["#", "Method", "URL", "Count", "avg", "p(95)", "max"],
          ...urls.map((u, i) => [String(i + 1), u.method, u.url, String(u.count), u.rps.avg.toFixed(2), u.rps.p95.toFixed(2), u.rps.max.toFixed(2)]),
        ];
        blocks.push(...this.createSafeTableBlocks("RPS per URL", tableData));
      }
    }

    if (reportData.successRequests) {
      const successRequests = reportData.successRequests as Record<string, unknown>;
      const requests = successRequests.requests as Array<{ method: string; url: string; status: number; count: number; min: number; avg: number; p95: number }>;
      if (requests && requests.length > 0) {
        const tableData = [
          ["#", "Method", "URL", "Status", "Count", "Min", "Avg", "p(95)"],
          ...requests.map((r, i) => [String(i + 1), r.method, r.url, String(r.status), String(r.count), this.formatDuration(r.min), this.formatDuration(r.avg), this.formatDuration(r.p95)]),
        ];
        blocks.push(...this.createSafeTableBlocks("Top Successful Requests", tableData));
      }
    }

    if (reportData.errorRequests) {
      const errorRequests = reportData.errorRequests as Record<string, unknown>;
      const errors = errorRequests.errors as Array<{ method: string; url: string; status: number; count: number }>;
      if (errors && errors.length > 0) {
        const tableData = [
          ["#", "Method", "URL", "Code", "Count"],
          ...errors.map((e, i) => [String(i + 1), e.method, e.url, String(e.status), String(e.count)]),
        ];
        blocks.push(...this.createSafeTableBlocks("Top Error Requests", tableData));
      }
    }

    if (reportData.errorResponsesText) {
      const errorResponsesText = reportData.errorResponsesText as Record<string, unknown>;
      const responses = errorResponsesText.responses as Array<{ url: string; method: string; status: number; error: string }>;
      if (responses && responses.length > 0) {
        const groupedErrors = new Map<string, { method: string; url: string; status: number; error: string; count: number }>();

        responses.forEach((r) => {
          const key = `${r.method}|${r.url}|${r.status}|${r.error}`;
          if (groupedErrors.has(key)) {
            const entry = groupedErrors.get(key)!;
            entry.count++;
          } else {
            groupedErrors.set(key, {
              method: r.method,
              url: r.url,
              status: r.status,
              error: r.error || "",
              count: 1,
            });
          }
        });

        const tableData = [
          ["#", "Method", "URL", "Status", "Error", "Count"],
          ...Array.from(groupedErrors.values()).map((r, i) => {
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
        blocks.push(...this.createSafeTableBlocks("Error Responses", tableData));
      }
    }

    return blocks;
  }

  private truncateCell(value: string, maxLength: number = this.MAX_CELL_LENGTH): string {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength - 1) + "…";
  }

  private truncateTableCells(tableData: string[][]): string[][] {
    return tableData.map((row, i) => (i === 0 ? row : row.map((cell) => this.truncateCell(cell))));
  }

  private createSafeTableBlocks(title: string, tableData: string[][]): KnownBlock[] {
    const truncated = this.truncateTableCells(tableData);
    const header = truncated[0];
    const rows = truncated.slice(1);
    const blocks: KnownBlock[] = [];
    let currentRows = [header];

    for (const row of rows) {
      const candidate = [...currentRows, row];
      const text = `*${title}${blocks.length > 0 ? " (cont.)" : ""}*\n\`\`\`\n${this.formatTable(candidate)}\`\`\``;

      if (text.length > this.MAX_BLOCK_TEXT_LENGTH && currentRows.length > 1) {
        const blockText = `*${title}${blocks.length > 0 ? " (cont.)" : ""}*\n\`\`\`\n${this.formatTable(currentRows)}\`\`\``;
        blocks.push({ type: "section", text: { type: "mrkdwn", text: blockText } });
        currentRows = [header, row];
      } else {
        currentRows = candidate;
      }
    }

    if (currentRows.length > 1) {
      const blockText = `*${title}${blocks.length > 0 ? " (cont.)" : ""}*\n\`\`\`\n${this.formatTable(currentRows)}\`\`\``;
      blocks.push({ type: "section", text: { type: "mrkdwn", text: blockText } });
    }

    return blocks;
  }

  private formatTable(tableData: string[][]): string {
    if (tableData.length === 0) {
      return "";
    }

    const columnCount = tableData[0].length;
    const columnConfig: Record<number, { alignment: "left" | "right" | "center" }> = {};
    for (let i = 0; i < columnCount; i++) {
      columnConfig[i] = { alignment: "left" };
    }

    return table(tableData, {
      border: {
        topBody: "─",
        topJoin: "┬",
        topLeft: "┌",
        topRight: "┐",
        bottomBody: "─",
        bottomJoin: "┴",
        bottomLeft: "└",
        bottomRight: "┘",
        bodyLeft: "│",
        bodyRight: "│",
        bodyJoin: "│",
        joinBody: "─",
        joinLeft: "├",
        joinRight: "┤",
        joinJoin: "┼",
      },
      drawHorizontalLine: (index) => index === 1,
      columns: columnConfig,
    });
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

  private formatTestDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (minutes === 0) {
      return `${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  }

  private async sendMessages(blocks: KnownBlock[]): Promise<void> {
    for (let i = 0; i < blocks.length; i += this.MAX_BLOCKS_PER_MESSAGE) {
      const messageBatch = blocks.slice(i, i + this.MAX_BLOCKS_PER_MESSAGE);
      await this.sendMessage(messageBatch);
    }
  }

  private async sendMessage(blocks: KnownBlock[]): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: this.channel,
        text: "k6 Performance Test Report",
        blocks,
      });
    } catch (error) {
      throw new Error(`Failed to send Slack message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
