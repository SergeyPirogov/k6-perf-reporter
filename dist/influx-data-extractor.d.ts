import { IInfluxDataExtractor } from "./influx-data-extractor.interface";
export interface InfluxConfig {
    url: string;
    token: string;
    org: string;
    bucket: string;
}
export interface MetricsData {
    timestamp: Date;
    metric: string;
    value: number;
    tags: Record<string, string>;
}
export type { TestMetrics } from "./types";
export declare class InfluxDataExtractor implements IInfluxDataExtractor {
    private influxDB;
    private config;
    constructor(config: InfluxConfig);
    queryMetrics(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getResponseTimePercentiles(startTime: string, endTime: string, runId?: string): Promise<{
        p50: number;
        p95: number;
        p99: number;
    }>;
    private calculatePercentile;
    private buildRunIdFilter;
    getRequestStats(startTime: string, endTime: string, runId?: string): Promise<{
        total: number;
        success: number;
        failed: number;
    }>;
    getErrorBreakdown(startTime: string, endTime: string, runId?: string): Promise<Record<string, number>>;
    getErrorDetails(startTime: string, endTime: string, runId?: string): Promise<Array<{
        status: number;
        url: string;
        count: number;
    }>>;
    getErrorRequestsSummary(startTime: string, endTime: string, runId?: string): Promise<Record<string, {
        count: number;
        minResponseTime: number;
        avgResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        maxResponseTime: number;
    }>>;
    getErrorRequestsDetailedSummary(startTime: string, endTime: string, runId?: string): Promise<Array<{
        url: string;
        method: string;
        status: number;
        count: number;
        minResponseTime: number;
        avgResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        maxResponseTime: number;
    }>>;
    getVUsStats(startTime: string, endTime: string): Promise<{
        vusMax: number;
        vusConfiguredMax: number;
    }>;
    getPodCount(startTime: string, endTime: string): Promise<number>;
    getDroppedIterations(startTime: string, endTime: string, runId?: string): Promise<number>;
    getRPSStats(startTime: string, endTime: string, runId?: string): Promise<{
        rpsMax: number;
        rpsAvg: number;
        rpsP95: number;
    }>;
    getThroughput(startTime: string, endTime: string, runId?: string): Promise<number>;
    getSlowestRequests(startTime: string, endTime: string, topN?: number, runId?: string): Promise<Array<{
        url: string;
        p95: number;
        max: number;
    }>>;
    getIterationCount(startTime: string, endTime: string, runId?: string): Promise<number>;
    getIterationDurationPercentiles(startTime: string, endTime: string, runId?: string): Promise<{
        p50: number;
        p95: number;
        p99: number;
    }>;
    getChecksStats(startTime: string, endTime: string, runId?: string): Promise<{
        total: number;
        succeeded: number;
        failed: number;
        successRate: number;
    }>;
    getHttpPhaseStats(startTime: string, endTime: string, runId?: string): Promise<Record<string, {
        avg: number;
        min: number;
        max: number;
        p90: number;
        p95: number;
    }>>;
    getDataTransferStats(startTime: string, endTime: string, runId?: string): Promise<{
        received: number;
        sent: number;
        receivedRate: number;
        sentRate: number;
    }>;
    getRequestsByEndpoint(startTime: string, endTime: string, runId?: string): Promise<Record<string, number>>;
    getRpsPerEndpoint(startTime: string, endTime: string, runId?: string): Promise<Record<string, {
        avg: number;
        max: number;
        p95: number;
    }>>;
    getRpsTimeSeriesByEndpoint(startTime: string, endTime: string, interval?: string, runId?: string): Promise<Record<string, Array<{
        timestamp: Date;
        rps: number;
    }>>>;
    getRequestsSummary(startTime: string, endTime: string, runId?: string): Promise<Record<string, {
        url: string;
        method: string;
        count: number;
        successful: number;
        failed: number;
        minResponseTime: number;
        avgResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        maxResponseTime: number;
    }>>;
}
//# sourceMappingURL=influx-data-extractor.d.ts.map