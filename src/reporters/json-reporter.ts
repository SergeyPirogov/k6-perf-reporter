import { writeFileSync } from "fs";
import { ReporterResponse } from "../data-collector";

export class JsonReporter {
  report(data: ReporterResponse, outputPath?: string): void {
    const json = JSON.stringify(data, null, 2);

    if (outputPath) {
      writeFileSync(outputPath, json);
      console.log(`Report saved to ${outputPath}`);
    } else {
      console.log(json);
    }
  }
}
