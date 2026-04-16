import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ReporterResponse } from "./data-collector";
import { logger } from "./logger";

interface CacheEntry {
  timestamp: number;
  data: ReporterResponse;
}

export class Cache {
  private cacheDir: string;
  private ttlMs: number;

  constructor(ttlSeconds: number, cacheDir?: string) {
    this.ttlMs = ttlSeconds * 1000;
    this.cacheDir = cacheDir || path.resolve(".cache");
  }

  private getCacheKey(runId: string, startTime: string, endTime: string): string {
    const raw = `${runId}:${startTime}:${endTime}`;
    return crypto.createHash("md5").update(raw).digest("hex");
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  get(runId: string, startTime: string, endTime: string): ReporterResponse | null {
    const key = this.getCacheKey(runId, startTime, endTime);
    const filePath = this.getCachePath(key);

    if (!fs.existsSync(filePath)) {
      logger.debug(`Cache.get: miss (no file) key=${key}`);
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const entry: CacheEntry = JSON.parse(raw);

      if (Date.now() - entry.timestamp > this.ttlMs) {
        logger.debug(`Cache.get: expired key=${key}, age=${Math.round((Date.now() - entry.timestamp) / 1000)}s, ttl=${Math.round(this.ttlMs / 1000)}s`);
        fs.unlinkSync(filePath);
        return null;
      }

      logger.debug(`Cache.get: hit key=${key}, age=${Math.round((Date.now() - entry.timestamp) / 1000)}s`);
      return entry.data;
    } catch {
      logger.warn(`Cache.get: failed to read cache file ${filePath}`);
      return null;
    }
  }

  set(runId: string, startTime: string, endTime: string, data: ReporterResponse): void {
    const key = this.getCacheKey(runId, startTime, endTime);
    const filePath = this.getCachePath(key);

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const entry: CacheEntry = {
      timestamp: Date.now(),
      data,
    };

    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
    logger.debug(`Cache.set: wrote key=${key} to ${filePath}`);
  }
}
