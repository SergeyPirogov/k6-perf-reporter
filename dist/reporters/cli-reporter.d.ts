import { DataCollector } from "../data-collector";
export declare class CliReporter {
    private collector;
    constructor(collector: DataCollector);
    generateReport(startTime: string, endTime: string, runId?: string): Promise<string>;
    private formatReport;
    private formatMetricLine;
}
//# sourceMappingURL=cli-reporter.d.ts.map