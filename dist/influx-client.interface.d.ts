import { ResponseTimePercentiles, RequestStats, VUsStats, ChecksStats, DataTransferStats, ErrorDetail, EndpointSummary, ErrorEndpointSummary, ErrorEndpointDetailedSummary, HttpPhaseStats, SlowestRequest, RpsEndpointStats } from "./types";
export interface IInfluxQueryClient {
    getResponseTimePercentiles(startTime: string, endTime: string, runId?: string): Promise<ResponseTimePercentiles>;
    getRequestStats(startTime: string, endTime: string, runId?: string): Promise<RequestStats>;
    getVUsStats(startTime: string, endTime: string): Promise<VUsStats>;
    getPodCount(startTime: string, endTime: string): Promise<number>;
    getDroppedIterations(startTime: string, endTime: string, runId?: string): Promise<number>;
    getSlowestRequests(startTime: string, endTime: string, topN: number, runId?: string): Promise<SlowestRequest[]>;
    getIterationDurationPercentiles(startTime: string, endTime: string, runId?: string): Promise<ResponseTimePercentiles>;
    getChecksStats(startTime: string, endTime: string, runId?: string): Promise<ChecksStats>;
    getHttpPhaseStats(startTime: string, endTime: string, runId?: string): Promise<Record<string, HttpPhaseStats>>;
    getDataTransferStats(startTime: string, endTime: string, runId?: string): Promise<DataTransferStats>;
    getRequestsByEndpoint(startTime: string, endTime: string, runId?: string): Promise<Record<string, number>>;
    getRpsPerEndpoint(startTime: string, endTime: string, runId?: string): Promise<Record<string, RpsEndpointStats>>;
    getRequestsSummary(startTime: string, endTime: string, runId?: string): Promise<Record<string, EndpointSummary>>;
    getErrorBreakdown(startTime: string, endTime: string, runId?: string): Promise<Record<string, number>>;
    getErrorDetails(startTime: string, endTime: string, runId?: string): Promise<ErrorDetail[]>;
    getErrorRequestsSummary(startTime: string, endTime: string, runId?: string): Promise<Record<string, ErrorEndpointSummary>>;
    getErrorRequestsDetailedSummary(startTime: string, endTime: string, runId?: string): Promise<ErrorEndpointDetailedSummary[]>;
}
//# sourceMappingURL=influx-client.interface.d.ts.map