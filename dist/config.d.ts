export interface ConfigFile {
    influx: {
        url: string;
        token: string;
        org: string;
        bucket: string;
    };
}
export declare class Config {
    private static instance;
    private config;
    private constructor();
    private replaceEnvVars;
    private validate;
    static getInstance(configPath?: string): Config;
    static reset(): void;
    getInfluxConfig(): {
        url: string;
        token: string;
        org: string;
        bucket: string;
    };
    getConfig(): ConfigFile;
}
//# sourceMappingURL=config.d.ts.map