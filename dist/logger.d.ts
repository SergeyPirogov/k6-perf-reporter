export interface Logger {
    log(message: string): void;
    error(message: string): void;
}
export declare const consoleLogger: Logger;
export declare const noopLogger: Logger;
//# sourceMappingURL=logger.d.ts.map