#!/bin/bash

# Claude Code Skill for k6-perf-reporter
# Usage: /k6-report [options]

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SCENARIO=""
START_TIME="-1h"
END_TIME="now()"
FORMAT="cli"
AI_MODE=false
OUTPUT=""
SHOW_HELP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--scenario)
      SCENARIO="$2"
      shift 2
      ;;
    -st|--start-time)
      START_TIME="$2"
      shift 2
      ;;
    -e|--end-time)
      END_TIME="$2"
      shift 2
      ;;
    -f|--format)
      FORMAT="$2"
      shift 2
      ;;
    --ai)
      AI_MODE=true
      shift
      ;;
    -o|--out)
      OUTPUT="$2"
      shift 2
      ;;
    -h|--help)
      SHOW_HELP=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      SHOW_HELP=true
      shift
      ;;
  esac
done

# Show help
if [ "$SHOW_HELP" = true ]; then
  cat << 'EOF'
k6-perf-reporter Skill for Claude Code

Generate performance test reports from k6 tests stored in InfluxDB 2.

Usage: /k6-report [options]

Options:
  -s, --scenario <name>       k6 scenario name (required)
  -st, --start-time <time>    Start time (ISO 8601 or relative like "-1h", default: "-1h")
  -e, --end-time <time>       End time (ISO 8601 or relative like "now()", default: "now()")
  -f, --format <format>       Report format: cli, json, markdown (default: cli)
  --ai                        Output machine-readable JSON for AI integration
  -o, --out <path>            Output file path (auto-generated if not specified)
  -h, --help                  Show this help message

Examples:

  # Generate CLI report for last hour
  /k6-report --scenario api-test

  # Generate AI-friendly JSON
  /k6-report --scenario api-test --ai

  # Generate markdown report
  /k6-report --scenario api-test --format markdown --out report.md

  # Specific time range
  /k6-report --scenario api-test \
    --start-time "2026-04-07T00:00:00Z" \
    --end-time "2026-04-07T23:59:59Z"

Setup:

  1. Install globally: npm install -g k6-perf-reporter

  2. Configure InfluxDB:
     - Create .config.json in project root:
       {
         "influx": {
           "url": "http://localhost:8086",
           "token": "your-token",
           "org": "your-org",
           "bucket": "k6"
         }
       }

     - Or set environment variables:
       export INFLUX_URL=http://localhost:8086
       export INFLUX_TOKEN=your-token
       export INFLUX_ORG=your-org
       export INFLUX_BUCKET=k6

Documentation:

  - Full guide: See CLAUDE_CODE_INTEGRATION.md
  - Release info: See RELEASE.md
  - Report samples: See COMPREHENSIVE_REPORT.md

EOF
  exit 0
fi

# Validate required arguments
if [ -z "$SCENARIO" ]; then
  echo -e "${RED}Error: --scenario is required${NC}"
  echo "Use '/k6-report --help' for usage information"
  exit 1
fi

# Build command
CMD="k6-perf-reporter generate --scenario '$SCENARIO' --start-time '$START_TIME' --end-time '$END_TIME' --format '$FORMAT'"

if [ "$AI_MODE" = true ]; then
  CMD="$CMD --ai"
fi

if [ -n "$OUTPUT" ]; then
  CMD="$CMD --out '$OUTPUT'"
fi

# Show what we're doing
echo -e "${BLUE}📊 Generating k6 performance report...${NC}"
echo -e "${YELLOW}Scenario:${NC} $SCENARIO"
echo -e "${YELLOW}Time range:${NC} $START_TIME to $END_TIME"
echo -e "${YELLOW}Format:${NC} $FORMAT"

if [ "$AI_MODE" = true ]; then
  echo -e "${YELLOW}Mode:${NC} AI-friendly (structured JSON)"
fi

echo ""

# Execute command
eval "$CMD"

# Show success message
echo ""
if [ "$FORMAT" = "cli" ]; then
  echo -e "${GREEN}✅ Report generated successfully${NC}"
elif [ -n "$OUTPUT" ]; then
  echo -e "${GREEN}✅ Report saved to: $OUTPUT${NC}"
else
  echo -e "${GREEN}✅ Report generated successfully${NC}"
fi
