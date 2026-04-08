"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noopLogger = exports.consoleLogger = void 0;
exports.consoleLogger = {
    log: (msg) => console.log(msg),
    error: (msg) => console.error(msg),
};
exports.noopLogger = {
    log: () => { },
    error: () => { },
};
//# sourceMappingURL=logger.js.map