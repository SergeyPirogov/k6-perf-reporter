# k6-perf-reporter

A comprehensive reporting tool for k6 performance tests with InfluxDB 2 integration. Generates beautiful HTML, PDF, CSV, and JSON reports with key performance metrics.

## Features

- **Multiple Report Formats**: HTML, PDF, CSV, JSON, and CLI output
- **InfluxDB 2 Integration**: Query test metrics directly from InfluxDB
- **Key Metrics**: Response time percentiles (p50, p95, p99), throughput, error rates, and error breakdown
- **Professional Reports**: Beautiful, interactive HTML reports with responsive design
- **CLI Tool**: Command-line interface for automated report generation
- **Library Support**: Use as a TypeScript/JavaScript library in your own tools

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Generate an HTML report
npx tsx src/cli.ts generate \
  --scenario api-load-test \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-01T01:00:00Z" \
  --format html
```

## Installation

```bash
npm install
npm run build
```

## Usage

### As a CLI Tool

#### HTML Report
```bash
npx tsx src/cli.ts generate \
  --scenario api-load-test \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-01T01:00:00Z" \
  --format html
```

Generates a beautiful, interactive HTML report with:
- Color-coded performance metric cards
- Responsive design that works on all devices
- Executive summary section
- Detailed error breakdown table
- Professional styling with gradient headers

#### PDF Report
```bash
npx tsx src/cli.ts generate \
  --scenario api-load-test \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-01T01:00:00Z" \
  --format pdf
```

Creates a printable PDF version of the HTML report for archival and sharing.

#### CSV Report
```bash
npx tsx src/cli.ts generate \
  --scenario api-load-test \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-01T01:00:00Z" \
  --format csv
```

Exports metrics in CSV format for import into Excel, Google Sheets, or data analysis tools.

Example CSV output:
```
k6 Performance Test Report
Test Name,api-load-test
Generated,2024-01-01T12:00:00Z

RESPONSE TIME METRICS
Metric,Value (ms)
P50,125.45
P95,385.67
P99,892.34

THROUGHPUT & REQUESTS
Metric,Value
Throughput (req/s),156.23
Total Requests,10000
Successful Requests,9950
Failed Requests,50
Error Rate (%),0.50

ERROR BREAKDOWN
Error Type,Count
ConnectionError,30
TimeoutError,15
HTTPError500,5
```

#### JSON Report
```bash
npx tsx src/cli.ts generate \
  --scenario api-load-test \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-01T01:00:00Z" \
  --format json
```

Generates machine-readable JSON for programmatic access:
```json
{
  "testName": "api-load-test",
  "generatedAt": "2024-01-01T12:00:00Z",
  "metrics": {
    "responseTime": {
      "p50": 125.45,
      "p95": 385.67,
      "p99": 892.34
    },
    "throughput": {
      "requestsPerSecond": 156.23
    },
    "requests": {
      "total": 10000,
      "successful": 9950,
      "failed": 50,
      "errorRate": 0.50
    },
    "errors": {
      "ConnectionError": 30,
      "TimeoutError": 15,
      "HTTPError500": 5
    }
  }
}
```

#### CLI Output
```bash
npx tsx src/cli.ts generate \
  --scenario api-load-test \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-01T01:00:00Z" \
  --format cli
```

Displays a pretty-printed table in your terminal:
```
━━━ k6 Performance Test Report ━━━

Test: api-load-test
Generated: 1/1/2024, 12:00:00 PM

📊 Response Times
┌────────┬───────────┐
│ Metric │ Value     │
├────────┼───────────┤
│ P50    │ 125.45 ms │
│ P95    │ 385.67 ms │
│ P99    │ 892.34 ms │
└────────┴───────────┘

⚡ Throughput & Requests
┌──────────────────────┬──────────┐
│ Metric               │ Value    │
├──────────────────────┼──────────┤
│ Throughput           │ 156.23 req/s │
│ Total Requests       │ 10000    │
│ Successful Requests  │ 9950     │
│ Failed Requests      │ 50       │
└──────────────────────┴──────────┘

❌ Error Analysis
┌────────────┬─────────┐
│ Metric     │ Value   │
├────────────┼─────────┤
│ Error Rate │ 0.50 %  │
└────────────┴─────────┘

Overall Status: ✓ PASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### As a Library

```typescript
import {
  InfluxQueryClient,
  ReportGenerator,
  CLIReporter,
} from "k6-perf-reporter";

const influxConfig = {
  url: "http://localhost:8086",
  token: "your-token",
  org: "your-org",
  bucket: "k6",
};

const influxClient = new InfluxQueryClient(influxConfig);
const reportGenerator = new ReportGenerator(influxClient);

// Generate metrics for the last hour
const metrics = await reportGenerator.generateMetrics(
  "api-load-test",
  "-1h",
  "now()"
);

// Print to CLI
const cliReporter = new CLIReporter();
cliReporter.printMetricsTable(metrics, "api-load-test");

// Or generate formatted reports
const htmlReport = reportGenerator.generateHTMLReport(metrics, "api-load-test");
const jsonReport = reportGenerator.generateJSONReport(metrics, "api-load-test");
const csvReport = reportGenerator.generateCSVReport(metrics, "api-load-test");

// Save to file
import fs from "fs";
fs.writeFileSync("report.html", htmlReport);
fs.writeFileSync("report.json", jsonReport);
fs.writeFileSync("report.csv", csvReport);
```

## Metrics Included

- **Response Times**: p50, p95, p99 percentiles (milliseconds)
- **Throughput**: Requests per second
- **Requests**: Total, successful, and failed counts
- **Error Rate**: Percentage of failed requests
- **Error Breakdown**: Distribution of error types with counts

## Time Format Examples

For InfluxDB time queries, use relative or absolute formats:

```bash
# Last hour
--start-time "-1h" --end-time "now()"

# Last 24 hours
--start-time "-24h" --end-time "now()"

# Specific date range (ISO 8601)
--start-time "2024-01-01T00:00:00Z" --end-time "2024-01-02T00:00:00Z"

# Last 30 minutes
--start-time "-30m" --end-time "now()"
```

## Environment Variables

You can configure InfluxDB settings via environment variables. They can be used in two ways:

### 1. Complete Configuration via Environment Variables

Set all four variables to use environment-only configuration:

```bash
export INFLUX_URL=http://localhost:8086
export INFLUX_TOKEN=your-influx-token
export INFLUX_ORG=your-org
export INFLUX_BUCKET=k6
```

Then run the CLI without needing a config file:
```bash
npx tsx src/cli.ts generate \
  --run-id 123456790121 \
  --start-time "-1h" \
  --end-time "now()" \
  --format cli
```

### 2. Override Specific Values from Config File

You can also use environment variables to override individual settings from `.config.json`:

```bash
# .config.json exists with default settings
export INFLUX_TOKEN=production-token

# Now the CLI will use the token from env var while other settings come from .config.json
npx tsx src/cli.ts generate --run-id 123456790121 --format cli
```

**Note:** Environment variables always take precedence over values in `.config.json`.

## Prerequisites

- Node.js 16+
- InfluxDB 2.x with k6 test data
- For PDF generation: Puppeteer (included in dependencies)

## InfluxDB Setup

Configure your k6 tests to output to InfluxDB 2:

```javascript
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 10,
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  const res = http.get("http://api.example.com/users");
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}
```

Run with InfluxDB output:
```bash
k6 run script.js \
  -o xk6-influxdb=http://localhost:8086/testdata \
  --tag testName=api-load-test
```

## Full Example Workflow

1. **Run your k6 test with InfluxDB output:**
```bash
k6 run load-test.js \
  -o xk6-influxdb=http://localhost:8086/k6db \
  --tag testName=checkout-flow-test
```

2. **Wait for test to complete, then generate reports:**
```bash
# Generate HTML report
npx tsx src/cli.ts generate \
  --url http://localhost:8086 \
  --token your-token \
  --org your-org \
  --bucket k6db \
  --test-name checkout-flow-test \
  --start-time "-30m" \
  --end-time "now()" \
  --format html \
  --output reports/checkout-flow-test.html

# Generate JSON for CI/CD integration
npx tsx src/cli.ts generate \
  --url http://localhost:8086 \
  --token your-token \
  --org your-org \
  --bucket k6db \
  --test-name checkout-flow-test \
  --start-time "-30m" \
  --end-time "now()" \
  --format json \
  --output reports/checkout-flow-test.json

# Generate CSV for spreadsheet analysis
npx tsx src/cli.ts generate \
  --url http://localhost:8086 \
  --token your-token \
  --org your-org \
  --bucket k6db \
  --test-name checkout-flow-test \
  --start-time "-30m" \
  --end-time "now()" \
  --format csv \
  --output reports/checkout-flow-test.csv

# Print summary to terminal
npx tsx src/cli.ts generate \
  --url http://localhost:8086 \
  --token your-token \
  --org your-org \
  --bucket k6db \
  --test-name checkout-flow-test \
  --start-time "-30m" \
  --end-time "now()" \
  --format cli
```

3. **Integrate with CI/CD:**
```bash
#!/bin/bash
# ci-report.sh

TEST_NAME="production-api-test"
START_TIME="-1h"
END_TIME="now()"

# Generate report
npx tsx src/cli.ts generate \
  --url $INFLUX_URL \
  --token $INFLUX_TOKEN \
  --org $INFLUX_ORG \
  --bucket $INFLUX_BUCKET \
  --scenario $TEST_NAME \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --format json \
  --output test-results.json

# Parse and check thresholds
ERROR_RATE=$(jq '.metrics.requests.errorRate' test-results.json)
if (( $(echo "$ERROR_RATE > 5.0" | bc -l) )); then
  echo "Error rate too high: $ERROR_RATE%"
  exit 1
fi

echo "Test passed! Error rate: $ERROR_RATE%"
```

## Development

```bash
# Install dependencies
npm install

# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build

# Development mode
npm run dev
```

## Architecture

```
src/
├── influx.ts          # InfluxDB client and query logic
├── reports.ts         # Report generation (HTML, CSV, JSON)
├── cli-reporter.ts    # CLI table formatting
├── cli.ts             # Command-line interface
└── index.ts           # Library exports
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
