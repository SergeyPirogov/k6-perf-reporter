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
}

export class DataCollector {
  constructor(private extractor: DataExtractor) {}

  async collectSummary(
    startTime: string,
    endTime: string,
    runId?: string
  ): Promise<TestSummary> {
    const [vusData, maxVusData] = await Promise.all([
      this.extractor.getVus(startTime, endTime, runId),
      this.extractor.getMaxVus(startTime, endTime, runId),
    ]);

    return {
      vus: {
        used: this.calculateMetrics(vusData),
        limit: this.calculateMetrics(maxVusData),
      },
    };
  }

  private calculateMetrics(data: MetricsData[]): SummaryMetrics {
    if (data.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const values = data.map((d) => d.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }
}


