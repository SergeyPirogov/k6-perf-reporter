import { DataExtractor, MetricsData } from "./data-extractor";
export interface SummaryMetrics {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
}
export interface VusSummary {
    used: SummaryMetrics;
    limit: SummaryMetrics;
}
export interface TestSummary {
    vus: VusSummary;
    pods: SummaryMetrics;
    httpReqsDuration: SummaryMetrics;
    iterationDuration: SummaryMetrics;
    totalRequests: number;
    totalIterations: number;
    totalErrors: number;
    errorPercent: number;
    duration: number;
    rps: number;
    ips: number;
    top10SlowestRequests: MetricsData[];
    httpRequestsStatsByUrl: MetricsData[];
    httpRequestsRpsByUrl: MetricsData[];
}
export declare class DataCollector {
    private extractor;
    constructor(extractor: DataExtractor);
    collectSummary(startTime: string, endTime: string, runId?: string): Promise<TestSummary>;
    private getTotalValue;
    private calculateMetrics;
}
//# sourceMappingURL=data-collector.d.ts.map