"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Config {
    constructor(configPath) {
        const resolvedPath = configPath || path_1.default.join(process.cwd(), ".config.json");
        if (!fs_1.default.existsSync(resolvedPath)) {
            throw new Error(`Config file not found at ${resolvedPath}. Copy .config.example.json to .config.json and fill in your values.`);
        }
        const rawConfig = fs_1.default.readFileSync(resolvedPath, "utf-8");
        this.config = JSON.parse(rawConfig);
        // Replace environment variables in config
        this.config.influx.token = this.replaceEnvVars(this.config.influx.token);
        this.config.influx.url = this.replaceEnvVars(this.config.influx.url);
        this.config.influx.org = this.replaceEnvVars(this.config.influx.org);
        this.config.influx.bucket = this.replaceEnvVars(this.config.influx.bucket);
        this.validate();
    }
    replaceEnvVars(value) {
        return value.replace(/\$\{([^}]+)\}/g, (_match, envVar) => {
            const envValue = process.env[envVar];
            if (!envValue) {
                throw new Error(`Environment variable ${envVar} is not set. Please set it before running the command.`);
            }
            return envValue;
        });
    }
    validate() {
        const { influx } = this.config;
        if (!influx.url)
            throw new Error("Config: influx.url is required");
        if (!influx.token)
            throw new Error("Config: influx.token is required");
        if (!influx.org)
            throw new Error("Config: influx.org is required");
        if (!influx.bucket)
            throw new Error("Config: influx.bucket is required");
    }
    static getInstance(configPath) {
        if (!Config.instance) {
            Config.instance = new Config(configPath);
        }
        return Config.instance;
    }
    static reset() {
        Config.instance = undefined;
    }
    getInfluxConfig() {
        return {
            url: this.config.influx.url,
            token: this.config.influx.token,
            org: this.config.influx.org,
            bucket: this.config.influx.bucket,
        };
    }
    getConfig() {
        return this.config;
    }
}
exports.Config = Config;
//# sourceMappingURL=config.js.map