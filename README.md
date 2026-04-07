# k6-perf-reporter

A comprehensive CLI tool for generating performance test reports from k6 tests stored in InfluxDB 2. Outputs in multiple formats including JSON, CLI, and Markdown with AI-friendly structured output.

## Features

- **Multiple Report Formats**: JSON, CLI (pretty tables), Markdown, and more
- **AI-Friendly Output**: `--ai` flag for machine-readable structured JSON
- **InfluxDB 2 Integration**: Query test metrics directly from InfluxDB
- **Key Metrics**: Response time percentiles (p50, p95, p99), throughput, error rates, detailed request/endpoint summaries
- **CLI Tool**: Command-line interface with global installation support
- **Claude Code Integration**: Shell integration for easy usage in Claude Code
- **Automated Releases**: GitHub Actions for npm publishing
- **Status Tracking**: 1% error rate threshold with pass/fail status

## Quick Start

### Installation

```bash
# Global installation (recommended)
npm install -g k6-perf-reporter

# Or use directly with npx
npx k6-perf-reporter generate --scenario test -st -1h -e now() --format cli
```

### Basic Usage

```bash
k6-perf-reporter generate \
  --scenario api-load-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format cli
```

## Report Formats

### CLI Output (Terminal Display)
```bash
k6-perf-reporter generate \
  --scenario api-load-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format cli
```

Displays formatted tables in your terminal:
```
━━━ k6 Performance Test Report ━━━

Test: api-load-test
Generated: 4/7/2026, 3:45:00 PM

📋 Summary
┌──────────────────┬────────────┐
│ Total Requests   │ 10,000     │
│ Successful       │ 9,955      │
│ Failed           │ 45         │
│ Error Rate       │ 0.0045%    │
└──────────────────┴────────────┘

📊 Response Times
┌────────┬───────────┐
│ P50    │ 125.45 ms │
│ P95    │ 385.67 ms │
│ P99    │ 892.34 ms │
└────────┴───────────┘

Overall Status: ✓ PASS
Error Rate: 0.0045% (threshold: < 1%)
```

### JSON Report (Machine-Readable)
```bash
k6-perf-reporter generate \
  --scenario api-load-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format json \
  --out report.json
```

Generates structured JSON with top-level status and summary for easy parsing:
```json
{
  "testName": "api-load-test",
  "status": "PASS",
  "summary": {
    "result": "PASS",
    "errorRate": 0.45,
    "errorRateThreshold": 1,
    "passed": true,
    "totalRequests": 10000,
    "successfulRequests": 9955,
    "failedRequests": 45
  },
  "metrics": {
    "responseTime": { "p50": 125.45, "p95": 385.67, "p99": 892.34 },
    "requests": { "total": 10000, "successful": 9955, "failed": 45, "errorRate": 0.45 },
    "requestsSummary": { ... },
    "errorRequestsDetailedSummary": [ ... ]
  }
}
```

### Markdown Report (Documentation)
```bash
k6-perf-reporter generate \
  --scenario api-load-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format markdown \
  --out report.md
```

Generates GitHub-flavored markdown with formatted tables, perfect for documentation and version control.

### AI-Friendly Output
```bash
k6-perf-reporter generate \
  --scenario api-load-test \
  --start-time "-1h" \
  --end-time "now()" \
  --ai
```

Outputs structured JSON without verbose logs, optimized for AI parsing and scripting.

## Usage Examples

### Configuration

Create a `.config.json` file to avoid passing options repeatedly:

```json
{
  "influx": {
    "url": "http://localhost:8086",
    "token": "your-influx-token",
    "org": "your-org",
    "bucket": "k6"
  }
}
```

Then use simplified commands:
```bash
k6-perf-reporter generate \
  --scenario api-load-test \
  --start-time "-1h" \
  --end-time "now()"
```

### Time Format Options

```bash
# Last hour
--start-time "-1h" --end-time "now()"

# Last 24 hours
--start-time "-24h" --end-time "now()"

# Specific date range (ISO 8601)
--start-time "2026-01-01T00:00:00Z" --end-time "2026-01-02T00:00:00Z"

# Last 30 minutes
--start-time "-30m" --end-time "now()"
```

### CLI Options

```
k6-perf-reporter generate [OPTIONS]

Required Options:
  -s, --scenario <name>       k6 scenario name
  -st, --start-time <time>    Start time (ISO 8601 or relative like "-1h")
  -e, --end-time <time>       End time (ISO 8601 or relative like "now()")

Optional Options:
  -f, --format <format>       Report format: json, cli, markdown (default: cli)
  -c, --config <path>         Path to config file (default: .config.json)
  --out <path>                Output file path (auto-generated if not specified)
  --ai                        Output machine-readable JSON for AI integration
  -u, --url <url>             InfluxDB URL (overrides config)
  -t, --token <token>         InfluxDB token (overrides config)
  -o, --org <organization>    InfluxDB organization (overrides config)
  -b, --bucket <bucket>       InfluxDB bucket (overrides config)
```

## Claude Code Integration

Use k6-perf-reporter directly in Claude Code with the `!` prefix:

```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai | jq '.summary'
```

### Quick Commands

**Check latest test results:**
```bash
! k6-perf-reporter generate --scenario api-test -st -1h -e now() --ai | jq '.summary'
```

**Extract specific metrics:**
```bash
! k6-perf-reporter generate --scenario api-test -st -1h -e now() --ai | jq '.metrics.responseTime.p95'
```

**Check if test passed:**
```bash
! k6-perf-reporter generate --scenario api-test -st -1h -e now() --ai | jq '.summary.passed'
```

For detailed integration guide, see [CLAUDE_CODE_INTEGRATION.md](./CLAUDE_CODE_INTEGRATION.md)

## Metrics Included

- **Response Times**: p50, p95, p99 percentiles
- **Throughput**: Requests per second
- **Requests Summary**: Per-endpoint breakdown with method, count, success/fail rates, and response time stats
- **Error Analysis**: Detailed error requests summary with status codes and response times
- **Iteration Metrics**: Duration percentiles
- **Concurrency**: VUs, pod count, dropped iterations
- **Checks**: k6 check pass/fail rates
- **Data Transfer**: Bytes sent/received and rates

## Release Process

Releases are automated via GitHub Actions. To create a release:

```bash
npm version patch     # Updates version and creates tag
git push origin main --tags
```

GitHub Actions will automatically build, test, and publish to npm.

For detailed release instructions, see [RELEASE.md](./RELEASE.md)

## Environment Variables

Set these for easier usage:

```bash
export INFLUX_URL=http://localhost:8086
export INFLUX_TOKEN=your-influx-token
export INFLUX_ORG=your-org
export INFLUX_BUCKET=k6
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

## npm Scripts

```bash
npm run dev              # Run development mode
npm run build            # Build TypeScript to JavaScript
npm run start            # Run built CLI
npm run report           # Run CLI in development
npm run report:example   # Run example report (CLI format)
npm run report:markdown  # Run example report (Markdown format)
npm run report:ai        # Run example report (AI-friendly JSON)
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript type checking
```

## Prerequisites

- Node.js 16+
- InfluxDB 2.x with k6 test data

## Project Structure

```
src/
├── cli.ts                    # CLI entry point with --ai flag support
├── config.ts                 # Configuration loader
├── influx.ts                 # InfluxDB query client
├── metrics-collector.ts      # Metrics aggregation
├── reporters/
│   ├── cli.ts               # Terminal table formatter
│   ├── json.ts              # JSON reporter with status/summary
│   └── markdown.ts          # Markdown reporter
└── index.ts                 # Library exports
```

## Documentation

- [CLAUDE_CODE_INTEGRATION.md](./CLAUDE_CODE_INTEGRATION.md) - Claude Code shell integration guide
- [RELEASE.md](./RELEASE.md) - Release process and GitHub Actions setup

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
