import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ReporterResponse } from "./data-collector";

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
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const entry: CacheEntry = JSON.parse(raw);

      if (Date.now() - entry.timestamp > this.ttlMs) {
        fs.unlinkSync(filePath);
        return null;
      }

      return entry.data;
    } catch {
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
  }
}
