import { program } from "commander";
import { Config } from "./config";
import { DataCollector } from "./data-collector";
import { JsonReporter } from "./reporters";

function main(): void {
  program
    .name("k6-reporter")
    .description("Generate CLI reports from k6 tests stored in InfluxDB")
    .version("1.0.0");

  program
    .command("generate")
    .description("Generate performance test report")
    .requiredOption("--run-id <id>", "k6 test run ID")
    .option("-st, --start-time <time>", "Start time in ISO 8601 format or relative like '-1h'")
    .option("-et, --end-time <time>", "End time in ISO 8601 format (defaults to now)")
    .option("-c, --config <path>", "Path to config file", ".config.json")
    .option("-f, --format <format>", "Output format: 'json' or 'cli'", "cli")
    .action(async (options) => {
      try {
        const config = Config.getInstance(options.config).getConfig();
        const collector = new DataCollector(config);
        const reporter = new JsonReporter();

        const report = await collector.collect(
          options.runId,
          options.startTime || "-1h",
          options.endTime || "now()"
        );

        reporter.report(report);
      } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program.parse();
}

main();
