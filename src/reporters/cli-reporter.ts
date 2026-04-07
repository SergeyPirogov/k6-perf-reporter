import { DataCollector, TestSummary } from "../data-collector";
import chalk from "chalk";

export class CliReporter {
  constructor(private collector: DataCollector) {}

  async generateReport(
    startTime: string,
    endTime: string,
    runId?: string
  ): Promise<string> {
    const summary = await this.collector.collectSummary(
      startTime,
      endTime,
      runId
    );

    return this.formatReport(summary);
  }

  private formatReport(summary: TestSummary): string {
    const lines: string[] = [];

    lines.push(chalk.bold.blue("\n=== K6 Performance Report ===\n"));

    lines.push(chalk.bold("Summary:"));
    lines.push(this.formatMetricLine("VUS Used", summary.vus.used.max));
    lines.push(this.formatMetricLine("VUS Limit", summary.vus.limit.max));

    lines.push("");

    return lines.join("\n");
  }

  private formatMetricLine(label: string, value: number): string {
    return `  ${label.padEnd(15)} ${chalk.green(value.toFixed(2))}`;
  }
}


