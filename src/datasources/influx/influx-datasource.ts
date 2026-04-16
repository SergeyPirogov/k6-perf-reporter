import { InfluxClient } from "./influx-client";
import { InfluxConfig } from "../../config";
import { logger } from "../../logger";
import { percentile } from "../../metrics";
import { DataSource } from "../datasource";
import {
  HttpReqsRow,
  HttpReqDurationRow,
  DurationMetric,
  VusMetric,
  VusMaxMetric,
  IterationsMetric,
  ChecksMetric,
  IterationDurationMetric,
  ErrorResponsesTextMetric,
  ErrorResponseMetric,
} from "../../types";

export class InfluxDataSource implements DataSource {
  private client: InfluxClient;
  private config: InfluxConfig;

  constructor(config: InfluxConfig) {
    this.client = new InfluxClient(config);
    this.config = config;
  }

  async fetchHttpReqsData(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqsRow[]> {
    logger.debug(`fetchHttpReqsData: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_value", "_time", "url", "method", "status"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`fetchHttpReqsData: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) return [];

    return results.map((r) => ({
      _value: typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0,
      _time: r._time as string,
      url: r.url as string,
      method: r.method as string,
      status: typeof r.status === "string" ? parseInt(r.status, 10) : (r.status as number) || 0,
    }));
  }

  async fetchHttpReqDurationData(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<HttpReqDurationRow[]> {
    logger.debug(`fetchHttpReqDurationData: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_req_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value", "url", "method", "status"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`fetchHttpReqDurationData: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) return [];

    return results.map((r) => ({
      _value: typeof r._value === "string" ? parseFloat(r._value) : (r._value as number) || 0,
      url: r.url as string,
      method: r.method as string,
      status: typeof r.status === "string" ? parseInt(r.status, 10) : (r.status as number) || 0,
    }));
  }

  async calculateTestDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<DurationMetric> {
    logger.debug(`calculateTestDuration: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const firstQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> group()
        |> sort(columns: ["_time"], desc: false)
        |> limit(n: 1)
    `;

    const lastQuery = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "http_reqs" and r.runId == "${runId}")
        |> keep(columns: ["_time"])
        |> group()
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const [firstResults, lastResults] = await Promise.all([
      this.client.queryData(firstQuery),
      this.client.queryData(lastQuery),
    ]);

    if (!firstResults?.length || !lastResults?.length) {
      logger.info("calculateTestDuration: no data found, returning empty duration");
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const firstTime = firstResults[0]._time as string;
    const lastTime = lastResults[0]._time as string;

    if (!firstTime || !lastTime) {
      return { startTime: "", endTime: "", durationSeconds: 0 };
    }

    const startTimeMs = new Date(firstTime).getTime();
    const endTimeMs = new Date(lastTime).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    logger.info(`calculateTestDuration: ${durationSeconds.toFixed(1)}s (${firstTime} -> ${lastTime})`);
    return {
      startTime: firstTime,
      endTime: lastTime,
      durationSeconds,
    };
  }

  async extractVus(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<VusMetric> {
    logger.debug(`extractVus: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractVus: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractVus: no data found, returning zeros");
      return { current: 0, min: 0, max: 0 };
    }

    const values = results.map((r) => (r._value as number) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    logger.info(`extractVus: current=${max}, min=${min}, max=${max}`);
    return { current: max, min, max };
  }

  async extractVusMax(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<VusMaxMetric> {
    logger.debug(`extractVusMax: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "vus_max" and r.runId == "${runId}")
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractVusMax: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractVusMax: no data found, returning zeros");
      return { min: 0, max: 0 };
    }

    const values = results.map((r) => (r._value as number) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    logger.info(`extractVusMax: min=${min}, max=${max}`);
    return { min, max };
  }

  async extractIterations(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<IterationsMetric> {
    logger.debug(`extractIterations: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iterations" and r.runId == "${runId}")
        |> keep(columns: ["_value", "_time"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractIterations: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractIterations: no data found, returning zeros");
      return { total: 0, rate: 0 };
    }

    const total = results.length;

    const timeValues = results
      .map((r) => r._time)
      .filter((t) => t !== null && t !== undefined) as string[];

    if (timeValues.length < 2) {
      return { total, rate: 0 };
    }

    timeValues.sort();
    const startTimeMs = new Date(timeValues[0]).getTime();
    const endTimeMs = new Date(timeValues[timeValues.length - 1]).getTime();
    const durationSeconds = (endTimeMs - startTimeMs) / 1000;

    const rate = durationSeconds > 0 ? total / durationSeconds : 0;

    logger.info(`extractIterations: total=${total}, rate=${rate.toFixed(2)} iter/s`);
    return { total, rate };
  }

  async extractChecks(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ChecksMetric> {
    logger.debug(`extractChecks: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "checks" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractChecks: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractChecks: no data found, returning zeros");
      return { passes: 0, fails: 0, passRate: 0 };
    }

    const passes = results.filter((r) => (r._value as number) === 1).length;
    const fails = results.filter((r) => (r._value as number) === 0).length;
    const total = passes + fails;
    const passRate = total > 0 ? (passes / total) * 100 : 0;

    logger.info(`extractChecks: passes=${passes}, fails=${fails}, passRate=${passRate.toFixed(2)}%`);
    return { passes, fails, passRate };
  }

  async extractIterationDuration(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<IterationDurationMetric> {
    logger.debug(`extractIterationDuration: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "iteration_duration" and r.runId == "${runId}")
        |> keep(columns: ["_value"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractIterationDuration: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractIterationDuration: no data found, returning zeros");
      return { avg: 0, min: 0, med: 0, max: 0, p90: 0, p95: 0 };
    }

    const values = results
      .map((r) => {
        const val = r._value;
        return typeof val === "string" ? parseFloat(val) : (val as number) || 0;
      })
      .sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const med = percentile(values, 50);
    const p90 = percentile(values, 90);
    const p95 = percentile(values, 95);

    logger.info(`extractIterationDuration: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    return { avg, min, med, max, p90, p95 };
  }

  async extractErrorResponsesText(
    runId: string,
    startTime: string,
    endTime: string
  ): Promise<ErrorResponsesTextMetric> {
    logger.debug(`extractErrorResponsesText: runId=${runId}, range=[${startTime}, ${endTime}]`);

    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "error_responses" and r.runId == "${runId}")
        |> keep(columns: ["endpoint", "method", "status", "err"])
    `;

    const results = await this.client.queryData(query);
    logger.debug(`extractErrorResponsesText: query returned ${results?.length ?? 0} rows`);

    if (!results || results.length === 0) {
      logger.info("extractErrorResponsesText: no error response texts found");
      return { responses: [] };
    }

    const groupedErrors = new Map<string, ErrorResponseMetric>();

    results.forEach((r) => {
      const url = r.endpoint as string;
      const method = r.method as string;
      const status = r.status as number;
      const error = String(r.err || "");
      const key = `${method}|${url}|${status}`;

      if (groupedErrors.has(key)) {
        groupedErrors.get(key)!.count++;
      } else {
        groupedErrors.set(key, { url, method, status, error, count: 1 });
      }
    });

    const responses = Array.from(groupedErrors.values())
      .sort((a, b) => b.count - a.count);

    logger.info(`extractErrorResponsesText: ${results.length} rows grouped into ${responses.length} unique errors`);
    return { responses };
  }
}
