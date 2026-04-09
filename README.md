# k6-perf-reporter

A comprehensive reporting tool for k6 performance tests with InfluxDB 2 integration. Generates beautiful CLI, JSON, and Slack reports with key performance metrics.

## Features

- **Multiple Report Formats**: CLI output, JSON, and Slack integration
- **InfluxDB 2 Integration**: Query test metrics directly from InfluxDB
- **Key Metrics**: RPS, HTTP requests, checks, error rates, latencies, and more
- **Real-time Slack Notifications**: Send formatted test reports directly to Slack channels
- **CLI Tool**: Command-line interface for automated report generation
- **Library Support**: Use as a TypeScript/JavaScript library in your own tools

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Generate a CLI report for the last hour
npx tsx src/cli.ts generate \
  --run-id 123456790121 \
  -st -1h \
  --format cli
```

## Installation

```bash
npm install
npm run build
```

## Configuration

Configuration can be provided via config file (`.config.json`) or environment variables. Environment variables take precedence over config file values.

### Config File (.config.json)

```json
{
  "influx": {
    "url": "http://localhost:8086",
    "token": "${INFLUX_TOKEN}",
    "org": "my-org",
    "bucket": "k6"
  },
  "slack": {
    "token": "${SLACK_TOKEN}",
    "channel": "#k6-reports"
  }
}
```

### Environment Variables

```bash
# InfluxDB Configuration (required)
export INFLUX_URL=http://localhost:8086
export INFLUX_TOKEN=your-influx-token
export INFLUX_ORG=your-org
export INFLUX_BUCKET=k6

# Slack Configuration (optional)
export SLACK_TOKEN=xoxb-your-slack-token
export SLACK_CHANNEL=#k6-reports
```

**Note:** Environment variables support `${ENV_VAR}` references in config file (e.g., `"token": "${INFLUX_TOKEN}"`).

## Usage

### As a CLI Tool

#### CLI Output (Default)

Display formatted report in terminal:

```bash
npx tsx src/cli.ts generate \
  --run-id 123456790121 \
  --start-time "-1h" \
  --format cli
```

Output includes:
- Run ID, start/end times
- Check pass rate with status
- RPS metrics (avg, p95, max)
- HTTP requests count and rate
- Request duration metrics
- Virtual users info
- Top slowest URLs
- RPS per URL
- Error requests breakdown
- Error responses with error types

#### JSON Report

```bash
npx tsx src/cli.ts generate \
  --run-id 123456790121 \
  --start-time "-1h" \
  --format json \
  --output report.json
```

Generates machine-readable JSON with all metrics for programmatic access and CI/CD integration.

#### Slack Report

Send formatted report directly to Slack:

```bash
# Via config file (recommended)
npx tsx src/cli.ts generate \
  --run-id 123456790121 \
  --start-time "-1h" \
  --format slack

# Or via environment variables
SLACK_TOKEN=xoxb-... SLACK_CHANNEL=#k6-reports npx tsx src/cli.ts generate \
  --run-id 123456790121 \
  --start-time "-1h" \
  --format slack
```

Slack message includes:
- Pass/Fail status with emoji (✅ PASS / ❌ FAIL)
- Key metrics (RPS, HTTP requests, iterations, VUs, duration)
- Error rate and failed checks
- Tables for:
  - Top slowest URLs
  - RPS per URL
  - Error requests
  - Error responses with error types

### Command Options

```
--run-id <id>              k6 test run ID (required)
-st, --start-time <time>   Start time (relative: -1h, -30m, or ISO 8601)
-et, --end-time <time>     End time (ISO 8601 format, defaults to now)
-c, --config <path>        Path to config file (default: .config.json)
-f, --format <format>      Output format: 'json', 'cli', or 'slack' (default: cli)
-o, --output <path>        Output file path (for json format)
```

### Time Format Examples

```bash
# Last hour
--start-time "-1h" --end-time "now()"

# Last 24 hours
--start-time "-24h" --end-time "now()"

# Last 30 minutes
--start-time "-30m" --end-time "now()"

# Specific date range (ISO 8601)
--start-time "2024-01-01T00:00:00Z" --end-time "2024-01-02T00:00:00Z"
```

## Metrics Included

### Response Time
- Min, max, average
- Percentiles: p50, p90, p95, p99
- Both overall and for successful responses only

### Throughput & Requests
- Requests per second (RPS)
- Total, successful, and failed request counts
- Request rate

### Checks
- Pass rate percentage
- Passed and failed check counts

### Error Analysis
- Error response count and rate
- Top error requests by status code
- Error responses grouped by type

### Performance Metrics
- Iteration duration (min, max, avg, p90, p95)
- Virtual users (current, min, max)

## Configuration Loading Priority

For each configuration value, the system checks in this order:

1. **Environment variables** (highest priority)
   - `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET`
   - `SLACK_TOKEN`, `SLACK_CHANNEL`

2. **Config file values**
   - `.config.json` or custom path via `-c` option

3. **Environment variable references in config**
   - Syntax: `"${ENV_VAR_NAME}"`
   - Example: `"token": "${INFLUX_TOKEN}"`

**Example:** Using production token via env var while keeping other settings in config file

```bash
export INFLUX_TOKEN=prod-token
npx tsx src/cli.ts generate --run-id 123 --format cli
# Uses prod-token but other influx settings from .config.json
```

## Full Example Workflow

1. **Configure InfluxDB and Slack:**

```bash
# Create .config.json
cat > .config.json << EOF
{
  "influx": {
    "url": "http://localhost:8086",
    "token": "\${INFLUX_TOKEN}",
    "org": "my-org",
    "bucket": "k6"
  },
  "slack": {
    "token": "\${SLACK_TOKEN}",
    "channel": "#k6-reports"
  }
}
EOF

# Set environment variables
export INFLUX_TOKEN=your-token
export SLACK_TOKEN=xoxb-your-slack-token
```

2. **Generate reports:**

```bash
# CLI report
npx tsx src/cli.ts generate --run-id 123456 -st -1h --format cli

# Save as JSON
npx tsx src/cli.ts generate --run-id 123456 -st -1h --format json -o report.json

# Send to Slack
npx tsx src/cli.ts generate --run-id 123456 -st -1h --format slack
```

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
  -o xk6-influxdb=http://localhost:8086/k6 \
  --tag testName=api-load-test
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

# Run example
npm run report:example
```

## Architecture

```
src/
├── config.ts               # Unified config loading (Influx + Slack)
├── data-collector.ts       # Data collection from InfluxDB
├── influx-client.ts        # InfluxDB client
├── influx-data-extractor.ts # Metric extraction
├── reporters/
│   ├── cli-reporter.ts     # CLI table formatting
│   ├── json-reporter.ts    # JSON export
│   ├── slack-reporter.ts   # Slack integration
│   └── index.ts            # Reporter exports
├── cli.ts                  # Command-line interface
└── index.ts                # Library exports
```

## Error Handling

### Missing Configuration

If required configuration is missing, the CLI will provide a helpful error message:

```
Error: InfluxDB configuration is incomplete. 
Set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET via environment variables or config file.
```

### Slack Configuration

Slack integration is optional. If not configured, Slack format option will error:

```
Error: Slack token not configured. Set SLACK_TOKEN environment variable or configure in config file.
```

Channel is required if Slack is configured:

```
Error: Slack channel is required and cannot be empty.
```

## Prerequisites

- Node.js 16+
- InfluxDB 2.x with k6 test data
- For Slack integration: Slack workspace with bot token

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
