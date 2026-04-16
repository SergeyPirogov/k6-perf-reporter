import chalk from "chalk";

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function getLogLevel(): LogLevel {
  const env = process.env["LOG_LEVEL"]?.toLowerCase();
  if (env && env in LOG_LEVELS) {
    return env as LogLevel;
  }
  return "silent";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(`${chalk.gray("[DEBUG]")} ${message}`, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(`${chalk.blue("[INFO]")} ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(`${chalk.yellow("[WARN]")} ${message}`, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(`${chalk.red("[ERROR]")} ${message}`, ...args);
    }
  },
};
