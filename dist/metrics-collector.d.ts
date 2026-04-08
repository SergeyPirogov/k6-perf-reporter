import { TestMetrics } from "./types";
import { IInfluxDataExtractor } from "./influx-data-extractor.interface";
import { Logger } from "./logger";
export declare class MetricsCollector {
    private influxClient;
    private logger;
    constructor(influxClient: IInfluxDataExtractor, logger?: Logger);
    collect(scenario: string, startTime: string, endTime: string, runId?: string): Promise<TestMetrics>;
}
//# sourceMappingURL=metrics-collector.d.ts.map