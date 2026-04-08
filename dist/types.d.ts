export interface ResponseTimePercentiles {
    p50: number;
    p95: number;
    p99: number;
}
export interface RequestStats {
    total: number;
    success: number;
    failed: number;
}
export interface VUsStats {
    vusMax: number;
    vusConfiguredMax: number;
}
export interface ChecksStats {
    total: number;
    succeeded: number;
    failed: number;
    successRate: number;
}
export interface DataTransferStats {
    received: number;
    sent: number;
    receivedRate: number;
    sentRate: number;
}
export interface ErrorDetail {
    status: number;
    url: string;
    count: number;
}
export interface EndpointSummary {
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
}
export interface ErrorEndpointSummary {
    count: number;
    minResponseTime: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    maxResponseTime: number;
}
export interface ErrorEndpointDetailedSummary {
    url: string;
    method: string;
    status: number;
    count: number;
    minResponseTime: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    maxResponseTime: number;
}
export interface HttpPhaseStats {
    avg: number;
    min: number;
    max: number;
    p90: number;
    p95: number;
}
export interface SlowestRequest {
    url: string;
    p95: number;
    max: number;
}
export interface RpsEndpointStats {
    avg: number;
    max: number;
    p95: number;
}
export interface TestMetrics {
    responseTimeP50: number;
    responseTimeP95: number;
    responseTimeP99: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    errorRate: number;
    errors: Record<string, number>;
    errorDetails: ErrorDetail[];
    errorRequestsSummary: Record<string, ErrorEndpointSummary>;
    errorRequestsDetailedSummary: ErrorEndpointDetailedSummary[];
    vusMax: number;
    vusConfiguredMax: number;
    podCount: number;
    droppedIterations: number;
    slowestRequests: SlowestRequest[];
    iterationDurationP50: number;
    iterationDurationP95: number;
    iterationDurationP99: number;
    checksTotal: number;
    checksSucceeded: number;
    checksFailed: number;
    checksSuccessRate: number;
    httpPhases: Record<string, HttpPhaseStats>;
    dataReceivedBytes: number;
    dataSentBytes: number;
    dataReceivedRate: number;
    dataSentRate: number;
    requestsByEndpoint: Record<string, number>;
    rpsPerEndpoint: Record<string, RpsEndpointStats>;
    requestsSummary: Record<string, EndpointSummary>;
}
//# sourceMappingURL=types.d.ts.map