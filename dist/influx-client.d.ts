export interface InfluxConfig {
    url: string;
    token: string;
    org: string;
    bucket: string;
}
export interface QueryResult {
    [key: string]: any;
}
export declare class InfluxDBClient {
    private client;
    private queryApi;
    constructor(config: InfluxConfig);
    query(fluxQuery: string): Promise<QueryResult[]>;
}
//# sourceMappingURL=influx-client.d.ts.map