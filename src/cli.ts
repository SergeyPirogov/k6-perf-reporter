import { program } from "commander";
import fs from "fs";
import path from "path";
import { InfluxQueryClient, InfluxConfig } from "./influx";
import { ReportGenerator } from "./reports";
import { CLIReporter } from "./cli-reporter";
import { Config } from "./config";

async function generatePDFReport(
  htmlContent: string,
  outputPath: string
): Promise<void> {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();
    console.log(`✓ PDF report generated: ${outputPath}`);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
}

function main(): void {
  const startTime = Date.now();

  program
    .name("k6-perf-reporter")
    .description("Generate reports from k6 tests stored in InfluxDB 2")
    .version("1.0.0");

  program
    .command("generate")
    .description("Generate test report from InfluxDB")
    .requiredOption("-s, --scenario <name>", "k6 scenario name")
    .requiredOption(
      "-st, --start-time <time>",
      'Start time (ISO 8601 format or relative like "-1h", e.g., "2024-01-01T00:00:00Z")'
    )
    .requiredOption(
      "-e, --end-time <time>",
      'End time (ISO 8601 format or relative like "now()", e.g., "2024-01-01T01:00:00Z")'
    )
    .option(
      "-u, --url <url>",
      "InfluxDB URL (overrides config file)"
    )
    .option(
      "-t, --token <token>",
      "InfluxDB authentication token (overrides config file)"
    )
    .option(
      "-o, --org <organization>",
      "InfluxDB organization (overrides config file)"
    )
    .option(
      "-b, --bucket <bucket>",
      "InfluxDB bucket name (overrides config file)"
    )
    .option("-f, --format <format>", "Report format (html, pdf, csv, json, cli)", "cli")
    .option("-c, --config <path>", "Path to config file (default: .config.json)")
    .option("-o, --output <path>", "Output file path (auto-generated if not specified)")
    .action(
      async (options: {
        scenario: string;
        startTime: string;
        endTime: string;
        url?: string;
        token?: string;
        org?: string;
        bucket?: string;
        format: string;
        config?: string;
        output?: string;
      }) => {
        const commandStart = Date.now();
        try {
          // Load config from file, with CLI options overriding config
          let influxConfig: InfluxConfig;

          try {
            const config = Config.getInstance(options.config);
            influxConfig = config.getInfluxConfig();

            // Override with CLI options if provided
            if (options.url) influxConfig.url = options.url;
            if (options.token) influxConfig.token = options.token;
            if (options.org) influxConfig.org = options.org;
            if (options.bucket) influxConfig.bucket = options.bucket;

            console.log("✓ Loaded configuration from file");
          } catch (error) {
            // Fallback to CLI options only
            if (
              !options.url ||
              !options.token ||
              !options.org ||
              !options.bucket
            ) {
              console.error(
                "Error:",
                error instanceof Error ? error.message : error
              );
              console.error(
                "\nUsage: Either create a .config.json file or provide all options:"
              );
              console.error(
                "  npx k6-perf-reporter generate -s scenario -st start -e end -u url -t token -o org -b bucket"
              );
              process.exit(1);
            }

            influxConfig = {
              url: options.url,
              token: options.token,
              org: options.org,
              bucket: options.bucket,
            };
          }

          console.log("🔄 Connecting to InfluxDB...");
          const influxClient = new InfluxQueryClient(influxConfig);

          console.log("📊 Fetching metrics...");
          const reportGenerator = new ReportGenerator(influxClient);
          const metrics = await reportGenerator.generateMetrics(
            options.scenario,
            options.startTime,
            options.endTime
          );

          console.log("📄 Generating report...");

          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          let outputPath = options.output;
          let content = "";

          if (options.format === "html") {
            content = reportGenerator.generateHTMLReport(
              metrics,
              options.scenario
            );
            outputPath =
              outputPath ||
              `k6-report-${options.scenario}-${timestamp}.html`;
          } else if (options.format === "pdf") {
            const htmlContent = reportGenerator.generateHTMLReport(
              metrics,
              options.scenario
            );
            outputPath =
              outputPath ||
              `k6-report-${options.scenario}-${timestamp}.pdf`;
            await generatePDFReport(htmlContent, outputPath);
            const totalTime = Date.now() - commandStart;
            console.log(`✓ Report saved to: ${path.resolve(outputPath)}`);
            console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
            return;
          } else if (options.format === "csv") {
            content = reportGenerator.generateCSVReport(
              metrics,
              options.scenario
            );
            outputPath =
              outputPath ||
              `k6-report-${options.scenario}-${timestamp}.csv`;
          } else if (options.format === "json") {
            content = reportGenerator.generateJSONReport(
              metrics,
              options.scenario
            );
            outputPath =
              outputPath ||
              `k6-report-${options.scenario}-${timestamp}.json`;
          } else if (options.format === "cli") {
            const cliReporter = new CLIReporter();
            cliReporter.printMetricsTable(metrics, options.scenario);
            const totalTime = Date.now() - commandStart;
            console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
            return;
          } else {
            throw new Error(`Unknown format: ${options.format}`);
          }

          fs.writeFileSync(outputPath, content);
          const totalTime = Date.now() - commandStart;
          console.log(`✓ Report saved to: ${path.resolve(outputPath)}`);
          console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
        } catch (error) {
          console.error("Error generating report:", error);
          process.exit(1);
        }
      }
    );

  program.parse();
}

main();
