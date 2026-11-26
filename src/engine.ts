export type EngineResult = {
  median: number;
  count: number;
  lower: number;
  upper: number;
  lowerRoot: number | null;
  upperRoot: number | null;
  lowerValues: number[];
  upperValues: number[];
  orderingValid: boolean;
  balanceValid: boolean;
};
// Development fallback. Mirrors the C++ max/min heap implementation; active engine is labeled in the UI.
class Heap {
  a: number[] = [];
  private max: boolean;
  constructor(max: boolean) {
    this.max = max;
  }
  push(x: number) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.before(a[p], x)) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = x;
  }
  pop() {
    const a = this.a;
    if (!a.length) return undefined;
    const root = a[0],
      last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && this.before(a[c + 1], a[c])) c++;
        if (this.before(last, a[c])) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return root;
  }
  peek() {
    return this.a[0];
  }
  private before(a: number, b: number) {
    return this.max ? a >= b : a <= b;
  }
}
export class MedianEngine {
  private low = new Heap(true);
  private high = new Heap(false);
  private count = 0;
  insert(score: number): EngineResult {
    if (!this.low.a.length || score <= this.low.peek()!) this.low.push(score);
    else this.high.push(score);
    if (this.low.a.length > this.high.a.length + 1)
      this.high.push(this.low.pop()!);
    else if (this.high.a.length > this.low.a.length)
      this.low.push(this.high.pop()!);
    this.count++;
    return this.result();
  }
  result(): EngineResult {
    const l = this.low.peek(),
      h = this.high.peek();
    return {
      median: this.count % 2 ? l! : (l! + h!) / 2,
      count: this.count,
      lower: this.low.a.length,
      upper: this.high.a.length,
      lowerRoot: l ?? null,
      upperRoot: h ?? null,
      lowerValues: this.low.a.slice(0, 24).sort((a, b) => b - a),
      upperValues: this.high.a.slice(0, 24).sort((a, b) => a - b),
      orderingValid: !this.low.a.length || !this.high.a.length || l! <= h!,
      balanceValid:
        this.low.a.length === this.high.a.length ||
        this.low.a.length === this.high.a.length + 1,
    };
  }
  reset() {
    this.low = new Heap(true);
    this.high = new Heap(false);
    this.count = 0;
  }
}
export const engineName = "TypeScript development fallback";
export interface MedianEnginePort {
  insert(score: number): EngineResult;
  result(): EngineResult;
  reset(): void;
}

type WasmInstance = {
  WasmMedianEngine: new () => {
    insert(score: number): number;
    snapshot(): EngineResult;
    reset(): void;
  };
};

export async function loadMedianEngine(): Promise<{
  engine: MedianEnginePort;
  name: string;
}> {
  try {
    const response = await fetch("/wasm/median_engine.js");
    if (!response.ok) return { engine: new MedianEngine(), name: engineName };
    const moduleUrl = URL.createObjectURL(
      new Blob([await response.text()], { type: "text/javascript" }),
    );
    const imported = (await import(/* @vite-ignore */ moduleUrl)) as {
      default: (options: {
        locateFile: (path: string) => string;
      }) => Promise<WasmInstance>;
    };
    const module = await imported.default({
      locateFile: (path) => `/wasm/${path}`,
    });
    URL.revokeObjectURL(moduleUrl);
    const instance = new module.WasmMedianEngine();
    const engine: MedianEnginePort = {
      insert(score) {
        instance.insert(score);
        return instance.snapshot();
      },
      result: () => instance.snapshot(),
      reset: () => instance.reset(),
    };
    return { engine, name: "C++17 WebAssembly · Emscripten" };
  } catch (error) {
    console.warn(
      "WebAssembly median engine unavailable; using fallback",
      error,
    );
    return { engine: new MedianEngine(), name: engineName };
  }
}

export function parseScores(text: string) {
  const lines = text.split(/\r?\n/),
    scores: number[] = [],
    errors: string[] = [];
  let scoreColumn = -1;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const cells = t.split(/[;,\t]/).map((s) => s.trim());
    if (
      scoreColumn < 0 &&
      !scores.length &&
      !errors.length &&
      cells.some((c) => /^score$/i.test(c))
    ) {
      scoreColumn = cells.findIndex((c) => /^score$/i.test(c));
      return;
    }
    const selected =
      scoreColumn >= 0 ? [cells[scoreColumn] ?? ""] : cells.filter(Boolean);
    for (const cell of selected) {
      if (!/^[+-]?\d+$/.test(cell)) {
        errors.push(`Line ${i + 1}: “${cell}” is not a signed integer.`);
        continue;
      }
      const n = Number(cell);
      if (!Number.isSafeInteger(n) || n < -2147483648 || n > 2147483647)
        errors.push(`Line ${i + 1}: “${cell}” is outside signed 32-bit range.`);
      else scores.push(n);
    }
  });
  if (!scores.length && !errors.length)
    errors.push("No score values were found.");
  if (scores.length > 100000)
    errors.push("Files may contain at most 100,000 scores.");
  return { scores, errors };
}
