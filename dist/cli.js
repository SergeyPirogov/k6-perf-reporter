#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const config_1 = require("./config");
const influx_client_1 = require("./influx-client");
const data_extractor_1 = require("./data-extractor");
const data_collector_1 = require("./data-collector");
const cli_reporter_1 = require("./reporters/cli-reporter");
function main() {
    commander_1.program
        .name("k6-perf-reporter")
        .description("Generate reports from k6 tests stored in InfluxDB 2")
        .version("1.0.0");
    commander_1.program
        .command("generate")
        .description("Generate test report from InfluxDB")
        .option("-st, --start-time <time>", 'Start time (ISO 8601 format or relative like "-1h", defaults to "-1h")')
        .option("-e, --end-time <time>", 'End time (ISO 8601 format or relative like "now()", defaults to "now()")')
        .option("-u, --url <url>", "InfluxDB URL (overrides config file)")
        .option("-t, --token <token>", "InfluxDB authentication token (overrides config file)")
        .option("-o, --org <organization>", "InfluxDB organization (overrides config file)")
        .option("-b, --bucket <bucket>", "InfluxDB bucket name (overrides config file)")
        .option("-f, --format <format>", "Report format (json, cli, markdown)", "cli")
        .option("-c, --config <path>", "Path to config file (default: .config.json)")
        .option("--out <path>", "Output file path (auto-generated if not specified)")
        .option("-r, --run-id <id>", "Filter results by k6 runId tag (optional)")
        .action(async (options) => {
        try {
            const config = config_1.Config.getInstance(options.config);
            console.log("✓ Configuration loaded");
            const influxConfig = config.getInfluxConfig();
            const client = new influx_client_1.InfluxDBClient(influxConfig);
            const extractor = new data_extractor_1.DataExtractor(client, influxConfig);
            const collector = new data_collector_1.DataCollector(extractor);
            const startTime = options.startTime || "-1h";
            const endTime = options.endTime || "now()";
            if (options.format === "cli") {
                const reporter = new cli_reporter_1.CliReporter(collector);
                const report = await reporter.generateReport(startTime, endTime, options.runId);
                console.log(report);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("Error:", errorMsg);
            process.exit(1);
        }
    });
    commander_1.program.parse();
}
main();
//# sourceMappingURL=cli.js.map