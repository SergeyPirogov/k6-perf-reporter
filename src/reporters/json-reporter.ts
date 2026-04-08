export class JsonReporter {
  report(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}
