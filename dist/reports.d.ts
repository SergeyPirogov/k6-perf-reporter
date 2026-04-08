import { TestMetrics } from "./influx";
import { InfluxQueryClient } from "./influx";
export declare class ReportGenerator {
    private influxClient;
    constructor(influxClient: InfluxQueryClient);
    generateMetrics(scenario: string, startTime: string, endTime: string): Promise<TestMetrics>;
    generateHTMLReport(metrics: TestMetrics, testName: string): string;
    generateCSVReport(metrics: TestMetrics, testName: string): string;
    generateJSONReport(metrics: TestMetrics, testName: string): string;
}
//# sourceMappingURL=reports.d.ts.map