"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIReporter = exports.ReportGenerator = exports.InfluxQueryClient = void 0;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const influx_1 = require("./influx");
Object.defineProperty(exports, "InfluxQueryClient", { enumerable: true, get: function () { return influx_1.InfluxQueryClient; } });
const reports_1 = require("./reports");
Object.defineProperty(exports, "ReportGenerator", { enumerable: true, get: function () { return reports_1.ReportGenerator; } });
const cli_reporter_1 = require("./cli-reporter");
Object.defineProperty(exports, "CLIReporter", { enumerable: true, get: function () { return cli_reporter_1.CLIReporter; } });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _exampleUsage() {
    const influxConfig = {
        url: process.env.INFLUX_URL || "http://localhost:8086",
        token: process.env.INFLUX_TOKEN || "your-token",
        org: process.env.INFLUX_ORG || "your-org",
        bucket: process.env.INFLUX_BUCKET || "k6",
    };
    const influxClient = new influx_1.InfluxQueryClient(influxConfig);
    const reportGenerator = new reports_1.ReportGenerator(influxClient);
    // Generate metrics for a test
    const scenario = "api-load-test";
    const startTime = "-1h"; // Last hour
    const endTime = "now()";
    try {
        const metrics = await reportGenerator.generateMetrics(scenario, startTime, endTime);
        // Print to CLI
        const cliReporter = new cli_reporter_1.CLIReporter();
        cliReporter.printMetricsTable(metrics, scenario);
        // Generate reports
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _htmlReport = reportGenerator.generateHTMLReport(metrics, scenario);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _jsonReport = reportGenerator.generateJSONReport(metrics, scenario);
        console.log("Reports generated successfully");
    }
    catch (error) {
        console.error("Error:", error);
    }
}
// Uncomment to run example
// _exampleUsage();
//# sourceMappingURL=index.js.map