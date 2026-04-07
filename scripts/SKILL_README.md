# k6-report Skill for Claude Code

A Claude Code skill for generating k6 performance test reports directly from Claude Code shell.

## Installation

### 1. Install the CLI Tool

```bash
npm install -g k6-perf-reporter
```

### 2. Configure InfluxDB Access

Create `.config.json` in your project root:

```json
{
  "influx": {
    "url": "http://localhost:8086",
    "token": "your-influx-token",
    "org": "your-organization",
    "bucket": "k6"
  }
}
```

Or set environment variables:

```bash
export INFLUX_URL=http://localhost:8086
export INFLUX_TOKEN=your-token
export INFLUX_ORG=your-org
export INFLUX_BUCKET=k6
```

## Usage

Use the `/k6-report` command in Claude Code:

### Basic Usage

```bash
/k6-report --scenario api-load-test
```

### Generate AI-Friendly JSON

```bash
/k6-report --scenario api-load-test --ai
```

### Generate Markdown Report

```bash
/k6-report --scenario api-load-test --format markdown --out report.md
```

### Specific Time Range

```bash
/k6-report --scenario api-load-test \
  --start-time "2026-04-07T00:00:00Z" \
  --end-time "2026-04-07T23:59:59Z"
```

### Last 24 Hours

```bash
/k6-report --scenario api-load-test --start-time "-24h" --end-time "now()"
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-s, --scenario` | string | required | k6 scenario name |
| `-st, --start-time` | string | `-1h` | Start time (ISO 8601 or relative) |
| `-e, --end-time` | string | `now()` | End time (ISO 8601 or relative) |
| `-f, --format` | choice | `cli` | Format: cli, json, markdown |
| `--ai` | flag | - | AI-friendly JSON output |
| `-o, --out` | string | auto | Output file path |
| `-h, --help` | flag | - | Show help message |

## Examples

### Check Last Hour's Test Results

```bash
! /k6-report --scenario checkout-flow
```

Output: Pretty-printed table in terminal

### Generate JSON for Parsing

```bash
! /k6-report --scenario checkout-flow --ai | jq '.summary'
```

Output: Structured JSON with pass/fail status and metrics

### Save Markdown Report

```bash
! /k6-report --scenario checkout-flow --format markdown --out report-$(date +%Y%m%d).md
```

Output: GitHub-flavored markdown file

### Check Multiple Scenarios

```bash
! for scenario in api-test ui-test payment-test; do
  echo "=== $scenario ==="
  /k6-report --scenario $scenario --ai | jq '.summary.passed'
done
```

Output: Pass/fail status for each scenario

## Time Format Examples

```bash
# Last hour
--start-time "-1h" --end-time "now()"

# Last 24 hours
--start-time "-24h" --end-time "now()"

# Last 30 minutes
--start-time "-30m" --end-time "now()"

# Specific date range (ISO 8601)
--start-time "2026-04-07T00:00:00Z" --end-time "2026-04-07T23:59:59Z"

# Specific time with offset
--start-time "2026-04-07T10:00:00Z" --end-time "2026-04-07T11:00:00Z"
```

## Output Formats

### CLI (Default)

Pretty-printed tables in terminal with emojis and colors.

```
━━━ k6 Performance Test Report ━━━

Test: api-load-test
Generated: 4/7/2026, 2:15:30 PM

📋 Summary
┌──────────────────┬────────────┐
│ Total Requests   │ 10,000     │
│ Successful       │ 9,955      │
│ Error Rate       │ 0.0045%    │
└──────────────────┴────────────┘
```

### JSON (AI-Friendly)

Structured JSON with status and summary sections for easy parsing.

```json
{
  "success": true,
  "status": "PASS",
  "summary": {
    "result": "PASS",
    "errorRate": 0.0045,
    "passed": true,
    "totalRequests": 10000
  },
  "metrics": { ... }
}
```

### Markdown

GitHub-flavored markdown with formatted tables for documentation.

```markdown
# k6 Performance Test Report

**Test:** api-load-test
**Status:** PASS

## 📋 Summary

| Metric | Value |
|--------|-------|
| Total Requests | 10,000 |
| Error Rate | 0.0045% |
```

## Parsing Results with jq

Extract specific metrics from JSON output:

```bash
# Check if test passed
/k6-report --scenario test --ai | jq '.summary.passed'

# Get error rate
/k6-report --scenario test --ai | jq '.summary.errorRate'

# Get P95 response time
/k6-report --scenario test --ai | jq '.metrics.responseTime.p95'

# Get all response time percentiles
/k6-report --scenario test --ai | jq '.metrics.responseTime'
```

## Troubleshooting

### Command not found

Ensure k6-perf-reporter is installed globally:

```bash
which k6-perf-reporter
npm install -g k6-perf-reporter
```

### Connection refused

Check InfluxDB connection and configuration:

```bash
/k6-report --scenario test -u http://localhost:8086 -t YOUR_TOKEN -o YOUR_ORG -b k6
```

### No data found

Verify scenario name and time range:

```bash
# Check available scenarios in InfluxDB
# Adjust --start-time to match when tests ran
/k6-report --scenario my-test --start-time "-24h" --end-time "now()"
```

## Integration Examples

### In Scripts

```bash
#!/bin/bash
# scripts/check-performance.sh

/k6-report --scenario $1 --ai | jq '.summary | {passed, errorRate, totalRequests}'
```

### In CI/CD

```bash
# GitHub Actions
- name: Check k6 Performance
  run: |
    result=$(/k6-report --scenario api-test --ai)
    passed=$(echo $result | jq '.summary.passed')
    if [ "$passed" != "true" ]; then
      echo "Performance test failed"
      exit 1
    fi
```

### Continuous Monitoring

```bash
# Monitor tests every hour
! for i in {1..24}; do
  /k6-report --scenario api-test --ai >> perf-log.json
  sleep 3600
done
```

## Documentation

- **Full Integration Guide:** [CLAUDE_CODE_INTEGRATION.md](../CLAUDE_CODE_INTEGRATION.md)
- **Release Process:** [RELEASE.md](../RELEASE.md)
- **Example Analysis:** [COMPREHENSIVE_REPORT.md](../COMPREHENSIVE_REPORT.md)

## License

MIT
