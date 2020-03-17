declare module 'gauge' {
  class Gauge {
    pulse(): void;
    show(status: string, completed?: number): void;
  }
  export = Gauge;
}
