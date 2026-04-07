# Claude Code Shell Integration Guide

## Quick Start

Use k6-perf-reporter directly in Claude Code's shell:

```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai
```

The `!` prefix runs the command in Claude Code's shell.

## Installation

### Option 1: Global Installation (Recommended)
```bash
npm install -g k6-perf-reporter
```

Then use directly:
```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai
```

### Option 2: Local Installation
```bash
npm install k6-perf-reporter
```

Then use:
```bash
! npx k6-perf-reporter generate --scenario test -st -1h -e now() --ai
```

## Setup Environment Variables

Create a `.env` file or set these in your shell:

```bash
export INFLUX_URL=http://localhost:8086
export INFLUX_TOKEN=your-influx-token
export INFLUX_ORG=your-org
export INFLUX_BUCKET=k6
```

Or create `.config.json`:

```json
{
  "influx": {
    "url": "http://localhost:8086",
    "token": "your-token",
    "org": "your-org",
    "bucket": "k6"
  }
}
```

## Usage Examples in Claude Code

### 1. Generate AI-Friendly JSON Report
```bash
! k6-perf-reporter generate \
  --scenario my-test \
  --start-time "-1h" \
  --end-time "now()" \
  --ai
```

Output:
```json
{
  "testName": "my-test",
  "status": "PASS",
  "summary": {
    "result": "PASS",
    "errorRate": 0.45,
    "passed": true
  },
  "metrics": { ... }
}
```

### 2. Generate Markdown Report
```bash
! k6-perf-reporter generate \
  --scenario my-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format markdown \
  --out report.md
```

### 3. Generate JSON Report
```bash
! k6-perf-reporter generate \
  --scenario my-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format json \
  --out report.json
```

### 4. Display in Terminal
```bash
! k6-perf-reporter generate \
  --scenario my-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format cli
```

## Time Format Options

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

## Parsing Results in Claude Code

### With --ai flag (Recommended for Claude)
```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai | jq '.summary'
```

Returns:
```json
{
  "result": "PASS",
  "errorRate": 0.45,
  "errorRateThreshold": 1,
  "passed": true,
  "totalRequests": 10000,
  "successfulRequests": 9955,
  "failedRequests": 45
}
```

### Extract specific metrics
```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai | jq '.metrics.responseTime.p95'
```

### Check if test passed
```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai | jq '.summary.passed'
```

Returns: `true` or `false`

## Workflow Examples

### 1. Check Latest Test Results
```bash
! k6-perf-reporter generate \
  --scenario checkout-flow \
  --start-time "-30m" \
  --end-time "now()" \
  --ai | jq '{status: .status, errorRate: .summary.errorRate, p95: .metrics.responseTime.p95}'
```

### 2. Generate Report and Save
```bash
! k6-perf-reporter generate \
  --scenario api-test \
  --start-time "-1h" \
  --end-time "now()" \
  --format markdown \
  --out k6-report-$(date +%Y%m%d-%H%M%S).md
```

### 3. Compare Multiple Tests
```bash
! for scenario in test-1 test-2 test-3; do
  echo "=== $scenario ===" 
  k6-perf-reporter generate --scenario $scenario -st -1h -e now() --ai | jq '.summary'
done
```

## Troubleshooting

### Command not found
```bash
! which k6-perf-reporter
```

If not found, install globally:
```bash
! npm install -g k6-perf-reporter
```

### Connection refused
Ensure InfluxDB is running and config is correct:
```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() -u http://localhost:8086 -t YOUR_TOKEN -o YOUR_ORG -b k6 --ai
```

### Invalid time format
Use relative times (easier):
```bash
! k6-perf-reporter generate --scenario test -st -1h -e now() --ai
```

Or ISO 8601:
```bash
! k6-perf-reporter generate --scenario test -st "2026-04-07T00:00:00Z" -e "2026-04-07T23:59:59Z" --ai
```

## Pro Tips

1. **Use `jq` for JSON parsing:**
   ```bash
   ! k6-perf-reporter generate ... --ai | jq '.metrics.requests'
   ```

2. **Pipe to file:**
   ```bash
   ! k6-perf-reporter generate ... --ai > report.json
   ```

3. **Chain commands:**
   ```bash
   ! k6-perf-reporter generate ... --ai | jq '.summary.passed' && echo "Test passed!" || echo "Test failed!"
   ```

4. **Use environment variables:**
   ```bash
   ! export SCENARIO=my-test
   ! k6-perf-reporter generate --scenario $SCENARIO -st -1h -e now() --ai
   ```

## Integration with Claude Code Projects

Add to your project's `.claude-code/hooks.json`:

```json
{
  "postTest": "k6-perf-reporter generate --scenario $SCENARIO -st -1h -e now() --ai"
}
```

Or use in scripts:

```bash
#!/bin/bash
# scripts/generate-report.sh
k6-perf-reporter generate \
  --scenario ${1:-my-test} \
  --start-time "-1h" \
  --end-time "now()" \
  --format ${2:-markdown} \
  --ai
```

Then call:
```bash
! bash scripts/generate-report.sh checkout-flow json
```
