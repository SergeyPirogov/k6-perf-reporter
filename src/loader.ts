import chalk from "chalk";

export class Loader {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;
  private message = "";

  start(message: string): void {
    this.message = message;
    this.currentFrame = 0;

    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(this.frames[this.currentFrame])} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write("\r" + " ".repeat(this.message.length + 3) + "\r");
  }

  success(message: string): void {
    this.stop();
    console.log(`${chalk.green("✓")} ${message}`);
  }

  error(message: string): void {
    this.stop();
    console.log(`${chalk.red("✗")} ${message}`);
  }
}
