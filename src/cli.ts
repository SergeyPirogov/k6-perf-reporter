#!/usr/bin/env node

import { program } from "commander";
import { Config } from "./config";
import { DataCollector } from "./data-collector";
import { JsonReporter, CliReporter, SlackReporter } from "./reporters";

function main(): void {
  program
    .name("k6-reporter")
    .description("Generate CLI reports from k6 tests stored in InfluxDB")
    .version("1.6.0");

  program
    .command("generate")
    .description("Generate performance test report")
    .requiredOption("--run-id <id>", "k6 test run ID")
    .option("-st, --start-time <time>", "Start time in ISO 8601 format or relative like '-1h'")
    .option("-et, --end-time <time>", "End time in ISO 8601 format (defaults to now)")
    .option("-c, --config <path>", "Path to config file", ".config.json")
    .option("-f, --format <format>", "Output format: 'json', 'cli', or 'slack'", "cli")
    .option("-o, --output <path>", "Output file path (for json format)")
    .action(async (options) => {
      try {
        const config = Config.getInstance(options.config).getInfluxConfig();
        const collector = new DataCollector(config);
        const report = await collector.collect(
          options.runId,
          options.startTime || "-1h",
          options.endTime || "now()"
        );

        if (options.format === "json") {
          const jsonReporter = new JsonReporter();
          jsonReporter.report(report, options.output);
        } else if (options.format === "slack") {
          const slackConfig = Config.getInstance(options.config).getSlackConfig();
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
k6-reporter - Generate CLI reports from k6 tests stored in InfluxDB

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
  -f, --format            Output format: 'json', 'cli', or 'slack' (default: cli)
  -o, --output            Output file path (for json format)
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

  5. Send report to Slack:
     SLACK_TOKEN=xoxb-... k6-reporter generate --run-id 123456790121 --format slack

  6. Use custom config file:
     k6-reporter generate --run-id 123456790121 -c /path/to/config.json

  7. Get help for generate command:
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

  The config file (.config.json) should contain InfluxDB connection settings:

  {
    "influxUrl": "https://influxdb.example.com",
    "influxToken": "your-influx-token",
    "influxOrg": "your-org",
    "influxBucket": "your-bucket"
  }
      `);
    });

  program.parse();
}

main();
