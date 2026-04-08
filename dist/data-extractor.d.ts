import { InfluxDBClient, InfluxConfig } from "./influx-client";
export interface MetricsData {
    timestamp: string;
    value: number;
    [key: string]: any;
}
export declare class DataExtractor {
    private client;
    private bucket;
    constructor(client: InfluxDBClient, config: InfluxConfig);
    getVus(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getMaxVus(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getPodsCount(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getTotalErrors(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getTotalRequests(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getTotalIterations(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getIterationDuration(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getTop10SlowestRequests(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getHttpRequestsStatsByUrl(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getHttpRequestsCountByStatus(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getHttpRequestsRpsByUrl(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getHttpRequestsPercentiles(startTime: string, endTime: string, runId?: string): Promise<Map<string, {
        p95: number;
        p99: number;
    }>>;
    getTestDuration(startTime: string, endTime: string, runId?: string): Promise<number>;
    getHttpReqsDuration(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    getRPS(startTime: string, endTime: string, runId?: string): Promise<MetricsData[]>;
    private formatMetrics;
}
//# sourceMappingURL=data-extractor.d.ts.map