export interface Logger {
  log(message: string): void;
  error(message: string): void;
}

export const consoleLogger: Logger = {
  log: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
};

export const noopLogger: Logger = {
  log: () => {},
  error: () => {},
};
