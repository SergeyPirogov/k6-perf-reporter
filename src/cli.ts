#!/usr/bin/env node

import { program } from "commander";
import { Config, DataSourceType } from "./config";
import { DataCollector } from "./data-collector";
import { createDataSource } from "./datasources";
import { JsonReporter, CliReporter, SlackReporter, MarkdownReporter } from "./reporters";

function main(): void {
  program
    .name("k6-reporter")
    .description("Generate CLI reports from k6 performance tests")
    .version("1.6.0");

  program
    .command("generate")
    .description("Generate performance test report")
    .requiredOption("--run-id <id>", "k6 test run ID")
    .option("-st, --start-time <time>", "Start time in ISO 8601 format or relative like '-1h'")
    .option("-et, --end-time <time>", "End time in ISO 8601 format (defaults to now)")
    .option("-c, --config <path>", "Path to config file", ".config.json")
    .option("-d, --datasource <type>", "Data source: 'influxdb' or 'prometheus'")
    .option("-f, --format <format>", "Output format: 'json', 'cli', 'markdown', or 'slack'", "cli")
    .option("-o, --output <path>", "Output file path (for json format)")
    .option("--no-cache", "Disable cache, always fetch fresh data")
    .action(async (options) => {
      try {
        const configInstance = Config.getInstance(options.config);
        const dsType = (options.datasource || configInstance.getDataSourceType()) as DataSourceType;
        const dataSource = createDataSource(dsType, configInstance);
        const cacheTtl = options.cache ? configInstance.getCacheConfig().ttl : 0;
        const collector = new DataCollector(dataSource, cacheTtl);
        const report = await collector.collect(
          options.runId,
          options.startTime || "-1h",
          options.endTime || "now()"
        );

        if (options.format === "json") {
          const jsonReporter = new JsonReporter();
          jsonReporter.report(report, options.output);
        } else if (options.format === "markdown") {
          const markdownReporter = new MarkdownReporter();
          markdownReporter.report(report, options.output);
        } else if (options.format === "slack") {
          const slackConfig = configInstance.getSlackConfig();
          if (!slackConfig) {
            throw new Error("Slack token not configured. Set SLACK_TOKEN environment variable or configure in config file.");
          }
          const slackReporter = new SlackReporter(slackConfig.token, slackConfig.channel);
          await slackReporter.report(report);
          console.log("Report sent to Slack");
        } else {
          const cliReporter = new CliReporter();
          cliReporter.report(report);
        }
      } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program
    .command("help")
    .description("Show help and examples")
    .action(() => {
      console.log(`
k6-reporter - Generate reports from k6 performance tests

USAGE:
  k6-reporter <command> [options]

COMMANDS:
  generate    Generate performance test report
  help        Show this help message

GENERATE COMMAND:
  k6-reporter generate --run-id <id> [options]

OPTIONS:
  --run-id <id>           k6 test run ID (required)
  -st, --start-time       Start time (relative: -1h, -30m, or ISO 8601)
  -et, --end-time         End time (ISO 8601 format, defaults to now)
  -c, --config            Path to config file (default: .config.json)
  -d, --datasource        Data source: 'influxdb' or 'prometheus' (default: influxdb)
  -f, --format            Output format: 'json', 'cli', 'markdown', or 'slack' (default: cli)
  -o, --output            Output file path (for json and markdown formats)
  --no-cache              Disable cache, always fetch fresh data
  -h, --help              Show command help
  -V, --version           Show version

EXAMPLES:

  1. Generate CLI report for the last hour:
     k6-reporter generate --run-id 123456790121 -st -1h

  2. Generate report for specific time range:
     k6-reporter generate --run-id 123456790121 -st -3h -et -1h

  3. Export as JSON:
     k6-reporter generate --run-id 123456790121 --format json

  4. Save JSON report to file:
     k6-reporter generate --run-id 123456790121 --format json -o report.json

  5. Generate Markdown report and save to file:
     k6-reporter generate --run-id 123456790121 --format markdown -o report.md

  6. Send report to Slack:
     SLACK_TOKEN=xoxb-... k6-reporter generate --run-id 123456790121 --format slack

  7. Use custom config file:
     k6-reporter generate --run-id 123456790121 -c /path/to/config.json

  8. Use Prometheus datasource:
     k6-reporter generate --run-id 123456790121 -d prometheus

  9. Get help for generate command:
     k6-reporter generate --help

TIME FORMAT:

  Relative times (from now):
    -1h     Last hour
    -30m    Last 30 minutes
    -1d     Last day

  ISO 8601 format:
    2024-04-08T12:00:00Z
    2024-04-08T12:00:00+02:00

CONFIG FILE:

  The config file (.config.json) supports multiple datasources:

  {
    "dataSource": "influxdb",
    "influx": {
      "url": "https://influxdb.example.com",
      "token": "your-influx-token",
      "org": "your-org",
      "bucket": "your-bucket"
    }
  }

ENVIRONMENT VARIABLES:

  DATASOURCE         Data source type (influxdb, prometheus)
  INFLUX_URL         InfluxDB URL
  INFLUX_TOKEN       InfluxDB token
  INFLUX_ORG         InfluxDB organization
  INFLUX_BUCKET      InfluxDB bucket
  SLACK_TOKEN        Slack bot token
  SLACK_CHANNEL      Slack channel ID
  CACHE_TTL          Cache TTL in seconds (default: 3600)
      `);
    });

  program.parse();
}

main();
