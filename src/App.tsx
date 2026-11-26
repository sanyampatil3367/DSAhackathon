import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  Play,
  RotateCcw,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MedianEngine,
  loadMedianEngine,
  parseScores,
  type EngineResult,
  type MedianEnginePort,
} from "./engine";
import "./App.css";
type Entry = {
  index: number;
  score: number;
  median: number;
  lower: number;
  upper: number;
  timestamp: number;
  duration: number;
};
const nav = [
  ["Overview", "overview"],
  ["Live Scoreboard", "live"],
  ["Replay Studio", "replay"],
  ["Median Analytics", "analytics"],
  ["Algorithm Visualizer", "algorithm"],
  ["Performance Lab", "performance"],
  ["Testing & Validation", "testing"],
] as const;
const demo = [12, -5, 12, 2147483647, -2147483648, 0, 12];
const fmt = (n: number | undefined | null) =>
  n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1);
function App() {
  const engine = useRef<MedianEnginePort>(new MedianEngine()),
    replayTimer = useRef<number | undefined>(undefined),
    fileRef = useRef<HTMLInputElement>(null),
    allEntries = useRef<Entry[]>([]);
  const [page, setPage] = useState<string>("overview"),
    [engineLabel, setEngineLabel] = useState("Loading median engine…"),
    [entries, setEntries] = useState<Entry[]>([]),
    [state, setState] = useState<EngineResult | null>(null),
    [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [replay, setReplay] = useState<number[]>([]),
    [fileName, setFileName] = useState(""),
    [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(500),
    [replayErrors, setReplayErrors] = useState<string[]>([]),
    [bench, setBench] = useState<{
      n: number;
      sort: number;
      heap: number;
    } | null>(null),
    [tests, setTests] = useState<
      { name: string; ok: boolean; detail: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [scoreTotal, setScoreTotal] = useState(0);
  useEffect(() => {
    let active = true;
    void loadMedianEngine().then(({ engine: loaded, name }) => {
      if (!active) return;
      let latest: EngineResult | null = null;
      for (const entry of allEntries.current)
        latest = loaded.insert(entry.score);
      engine.current = loaded;
      if (latest) setState(latest);
      setEngineLabel(name);
    });
    return () => {
      active = false;
    };
  }, []);
  const add = (score: number) => {
    const t = performance.now(),
      s = engine.current.insert(score),
      duration = performance.now() - t;
    const e = {
      index: s.count,
      score,
      median: s.median,
      lower: s.lower,
      upper: s.upper,
      timestamp: Date.now(),
      duration,
    };
    setScoreTotal((v) => v + score);
    allEntries.current.push(e);
    setState(s);
    setEntries((a) => [...a, e].slice(-1500));
    return s;
  };
  const submit = (ev?: React.FormEvent) => {
    ev?.preventDefault();
    setError("");
    if (!/^[+-]?\d+$/.test(input.trim())) {
      setError("Enter a signed whole number.");
      return;
    }
    const n = Number(input);
    if (!Number.isSafeInteger(n) || n < -2147483648 || n > 2147483647) {
      setError("Score must be within the signed 32-bit range.");
      return;
    }
    if (entries.length >= 100000) {
      setError("Session limit reached (100,000 scores).");
      return;
    }
    add(n);
    setInput("");
  };
  const reset = () => {
    window.clearTimeout(replayTimer.current);
    setPlaying(false);
    engine.current.reset();
    allEntries.current = [];
    setScoreTotal(0);
    setEntries([]);
    setState(null);
    setProgress(0);
    setConfirm(false);
    setError("");
  };
  const upload = async (f?: File) => {
    if (!f) return;
    setReplayErrors([]);
    setReplay([]);
    setProgress(0);
    setPlaying(false);
    setFileName(f.name);
    const { scores, errors } = parseScores(await f.text());
    setReplayErrors(errors);
    if (!errors.length) setReplay(scores);
  };
  const loadDemo = (seq = demo, name = "Extreme & duplicate demo") => {
    setReplay(seq);
    setFileName(name);
    setReplayErrors([]);
    setProgress(0);
    setPlaying(false);
  };
  const startReplay = () => {
    if (progress === 0) reset();
    setPlaying(true);
  };
  useEffect(() => {
    if (!playing) return;
    if (progress >= replay.length) return;
    replayTimer.current = window.setTimeout(() => {
      add(replay[progress]);
      const next = progress + 1;
      setProgress(next);
      if (next >= replay.length) setPlaying(false);
    }, speed);
    return () => window.clearTimeout(replayTimer.current);
  }, [playing, progress, replay, speed]);
  const runTests = async () => {
    const { engine: e } = await loadMedianEngine();
    const cases: [string, number[], number[]][] = [
      ["Single score", [5], [5]],
      ["Two scores", [5, 1], [5, 3]],
      ["Repeated values", [2, 2, 2, 2], [2, 2, 2, 2]],
      ["Negative scores", [-5, 10, -1, 8], [-5, 2.5, -1, 3.5]],
      ["Extreme int32", [2147483647, -2147483648], [2147483647, -0.5]],
      ["Hackathon sample", demo, [12, 3.5, 12, 12, 12, 6, 12]],
    ];
    const out = cases.map(([name, x, expected]) => {
      e.reset();
      const actual = x.map((v) => e.insert(v).median);
      const ok =
        actual.length === expected.length &&
        actual.every((v, i) => v === expected[i]);
      return {
        name,
        ok,
        detail: ok
          ? "Every running median matches reference."
          : `Expected ${expected.join(", ")}, got ${actual.join(", ")}`,
      };
    });
    let seed = 727,
      vals: number[] = [];
    for (let i = 0; i < 2500; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      vals.push(seed | 0);
    }
    e.reset();
    const ref: number[] = [];
    let ok = true;
    for (const v of vals) {
      const a = e.insert(v).median;
      ref.push(v);
      ref.sort((a, b) => a - b);
      const m =
        ref.length % 2
          ? ref[(ref.length - 1) >> 1]
          : (ref[ref.length / 2 - 1] + ref[ref.length / 2]) / 2;
      if (a !== m || !e.result().orderingValid || !e.result().balanceValid) {
        ok = false;
        break;
      }
    }
    out.push({
      name: "Random differential · 2,500 entries",
      ok,
      detail: ok
        ? "All intermediate medians match repeated sorting."
        : "Mismatch detected.",
    });
    e.reset();
    let sm = 0;
    for (let i = 0; i < 100000; i++)
      sm = e.insert(((i * 7919) >>> 0) - 2147483648).median;
    const sr = e.result();
    out.push({
      name: "Stress test · 100,000 entries",
      ok: sr.count === 100000 && sr.balanceValid && sr.orderingValid,
      detail: `Processed ${sr.count.toLocaleString()}; final median ${fmt(sm)}; heap invariants ${sr.orderingValid && sr.balanceValid ? "valid" : "invalid"}.`,
    });
    setTests(out);
  };
  const runBench = () => {
    setBusy(true);
    setTimeout(async () => {
      const n = 4500;
      let seed = 41;
      const values = Array.from({ length: n }, () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed | 0;
      });
      let t = performance.now();
      const ref: number[] = [];
      for (const v of values) {
        ref.push(v);
        ref.sort((a, b) => a - b);
        if (ref.length % 2 === 1) void ref[(ref.length - 1) >> 1];
        else void ((ref[ref.length / 2 - 1] + ref[ref.length / 2]) / 2);
      }
      const sort = performance.now() - t;
      t = performance.now();
      const { engine: e } = await loadMedianEngine();
      for (const v of values) e.insert(v);
      const heap = performance.now() - t;
      setBench({ n, sort, heap });
      setBusy(false);
    }, 20);
  };
  const average = state ? scoreTotal / state.count : null;
  const chartData = useMemo(
    () =>
      entries.map((e) => ({
        index: e.index,
        median: e.median,
        score: e.score,
      })),
    [entries],
  );
  const histogram = useMemo(() => {
    if (!entries.length) return [];
    const min = Math.min(...entries.map((e) => e.score)),
      max = Math.max(...entries.map((e) => e.score)),
      bins = 12,
      step = (max - min) / bins || 1,
      counts = Array(bins).fill(0);
    entries.forEach(
      (e) => counts[Math.min(bins - 1, Math.floor((e.score - min) / step))]++,
    );
    return counts.map((count, i) => ({
      bucket: `${fmt(min + i * step)}`,
      count,
    }));
  }, [entries]);
  const recent = [...entries].slice(-8).reverse();
  const routeTitle = nav.find((n) => n[1] === page)?.[0] ?? "Overview";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={21} />
          </div>
          <div>
            <b>LiveScore</b>
            <small>ANALYTICS</small>
          </div>
        </div>
        <div className="workspace">
          <span className="live-dot" /> LOCAL SESSION{" "}
          <span className="chev">⌄</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([label, id], i) => (
            <button
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
              key={id}
            >
              <span className="nav-icon">
                {
                  [
                    <BarChart3 key="n0" />,
                    <Zap key="n1" />,
                    <Play key="n2" />,
                    <Activity key="n3" />,
                    <Layers3 key="n4" />,
                    <Gauge key="n5" />,
                    <Check key="n6" />,
                  ][i]
                }
              </span>
              {label}
              {page === id && <ChevronRight className="nav-arrow" size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-card">
            <div className="engine-light" />
            <div>
              <strong>
                {engineLabel.includes("WebAssembly")
                  ? "WebAssembly active"
                  : "Development fallback"}
              </strong>
              <small>{engineLabel}</small>
            </div>
            <CircleHelp size={14} />
          </div>
          <div className="sidebar-foot">
            LIVE SCORE ANALYTICS <span>v1.0</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            Workspace <span>/</span> {routeTitle}
          </div>
          <div className="top-right">
            <span className="engine-pill">
              <span /> {engineLabel}
            </span>
            <button className="avatar" aria-label="Profile">
              S
            </button>
          </div>
        </header>
        <div className="content">
          <motion.div
            className="page-head"
            key={page}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div>
              <div className="eyebrow">
                LIVE SCORE ANALYTICS <span>•</span> EVERY SCORE MATTERS. EVERY
                MEDIAN UPDATES.
              </div>
              <h1>
                {page === "overview"
                  ? "The pulse of every competition."
                  : routeTitle}
              </h1>
              <p>
                {page === "overview"
                  ? "Real-time statistics built for the moments that matter. Track every submission, instantly."
                  : description(page)}
              </p>
            </div>
            <div className="session-state">
              <i className={playing ? "pulsing" : ""} />
              <div>
                <strong>
                  {playing
                    ? "REPLAYING FILE"
                    : entries.length
                      ? "SESSION ACTIVE"
                      : "AWAITING SCORES"}
                </strong>
                <small>
                  {playing
                    ? `${progress} of ${replay.length} processed`
                    : entries.length
                      ? "Ready for next score"
                      : "No active input stream"}
                </small>
              </div>
            </div>
          </motion.div>
          {page === "overview" && (
            <>
              <div className="metric-grid">
                <Metric
                  icon={<Activity />}
                  label="TOTAL SCORES"
                  value={entries.length.toLocaleString()}
                  sub="In current session"
                />
                <Metric
                  icon={<Zap />}
                  label="LATEST SCORE"
                  value={entries.length ? fmt(entries.at(-1)!.score) : "—"}
                  sub={
                    entries.length
                      ? `Submission #${entries.length}`
                      : "Waiting for input"
                  }
                />
                <Metric
                  icon={<BarChart3 />}
                  label="RUNNING MEDIAN"
                  value={fmt(state?.median)}
                  sub="Live central tendency"
                  accent
                />
                <Metric
                  icon={<Layers3 />}
                  label="LOWER / UPPER HEAP"
                  value={state ? `${state.lower} / ${state.upper}` : "—"}
                  sub="Max heap · Min heap"
                />
                <Metric
                  icon={<Clock3 />}
                  label="LAST INSERT"
                  value={
                    entries.length
                      ? `${entries.at(-1)!.duration.toFixed(3)} ms`
                      : "—"
                  }
                  sub="Local insertion time"
                />
                <Metric
                  icon={<Cpu />}
                  label="ENGINE"
                  value={
                    engineLabel.includes("WebAssembly") ? "WASM" : "Fallback"
                  }
                  sub={engineLabel}
                />
              </div>
              <div className="grid-two">
                <section className="panel chart-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Median trajectory</h2>
                      <p>Most recent {chartData.length} prefix medians</p>
                    </div>
                    <span className="legend">
                      <i /> Median
                    </span>
                  </div>
                  {entries.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor="#6c8cff"
                              stopOpacity={0.24}
                            />
                            <stop
                              offset="100%"
                              stopColor="#6c8cff"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#202c40" vertical={false} />
                        <XAxis
                          dataKey="index"
                          stroke="#718097"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#718097"
                          tickLine={false}
                          axisLine={false}
                          width={48}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111b2a",
                            border: "1px solid #26344a",
                            borderRadius: 10,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="median"
                          stroke="#7e9bff"
                          strokeWidth={2.5}
                          fill="url(#fill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </section>
                <section className="panel quick-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Quick entry</h2>
                      <p>Submit the next score to the live stream</p>
                    </div>
                    <span className="shortcut">↵ ENTER</span>
                  </div>
                  <form onSubmit={submit}>
                    <label className="field-label">INCOMING SCORE</label>
                    <div className="input-row">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        inputMode="numeric"
                        placeholder="e.g. 84"
                      />
                      <button className="primary-btn" type="submit">
                        <Zap size={16} /> Add score
                      </button>
                    </div>
                    <div className="hint-row">
                      <span>Signed 32-bit integer</span>
                      <span>−2,147,483,648 to 2,147,483,647</span>
                    </div>
                    {error && <div className="error">{error}</div>}
                  </form>
                  <div className="current-median">
                    <div>
                      <span>CURRENT MEDIAN</span>
                      <strong>{fmt(state?.median)}</strong>
                    </div>
                    <div className="median-mark">
                      <Activity size={19} />
                    </div>
                  </div>
                  <div className="quick-links">
                    <button onClick={() => setPage("live")}>
                      Open scoreboard <ChevronRight size={15} />
                    </button>
                    <button onClick={() => setPage("replay")}>
                      Replay dataset <ChevronRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent submissions</h2>
                    <p>Latest incoming scores and their live medians</p>
                  </div>
                  <button className="text-btn" onClick={() => setPage("live")}>
                    View full scoreboard <ChevronRight size={14} />
                  </button>
                </div>
                <History rows={recent} />
              </section>
            </>
          )}
          {page === "live" && (
            <>
              <div className="live-layout">
                <section className="panel input-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Submit a score</h2>
                      <p>
                        Every score is processed immediately by the two-heap
                        engine.
                      </p>
                    </div>
                    <span className="status-badge">
                      <i /> STREAM READY
                    </span>
                  </div>
                  <form onSubmit={submit}>
                    <label className="field-label">SCORE VALUE</label>
                    <div className="input-row">
                      <input
                        autoFocus
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        inputMode="numeric"
                        placeholder="Enter an integer score"
                      />
                      <button type="submit" className="primary-btn">
                        <Zap size={16} /> Add score
                      </button>
                    </div>
                    <div className="hint-row">
                      <span>Whole numbers only</span>
                      <span>Range: −2³¹ to 2³¹ − 1</span>
                    </div>
                    {error && <div className="error">{error}</div>}
                  </form>
                  <div className="separator" />
                  <div className="live-stats">
                    <div>
                      <small>SCORES PROCESSED</small>
                      <b>{entries.length}</b>
                    </div>
                    <div>
                      <small>LATEST SCORE</small>
                      <b>{entries.length ? fmt(entries.at(-1)!.score) : "—"}</b>
                    </div>
                    <div>
                      <small>RUNNING MEDIAN</small>
                      <b className="blue-text">{fmt(state?.median)}</b>
                    </div>
                    <button
                      className="reset-btn"
                      onClick={() => setConfirm(true)}
                      disabled={!entries.length}
                    >
                      <RotateCcw size={15} /> Reset session
                    </button>
                  </div>
                </section>
                <section className="panel current-panel">
                  <span className="field-label">LIVE RUNNING MEDIAN</span>
                  <div className="hero-number">{fmt(state?.median)}</div>
                  <p>
                    {state
                      ? `${state.count.toLocaleString()} scores · updated just now`
                      : "The median appears after the first score."}
                  </p>
                  <div className="heap-sizes">
                    <div>
                      <i className="lower-dot" />
                      <span>Max heap</span>
                      <b>{state?.lower ?? 0}</b>
                    </div>
                    <div>
                      <i className="upper-dot" />
                      <span>Min heap</span>
                      <b>{state?.upper ?? 0}</b>
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <h2>Score history</h2>
                    <p>
                      {state?.count.toLocaleString() ?? 0} rows · newest first ·
                      showing latest 1,500
                    </p>
                  </div>
                  <button
                    className="secondary-btn"
                    onClick={() => downloadCsv(allEntries.current)}
                    disabled={!entries.length}
                  >
                    Export CSV
                  </button>
                </div>
                <History rows={[...entries].reverse()} />
              </section>
            </>
          )}
          {page === "replay" && (
            <>
              <div className="grid-two replay-grid">
                <section className="panel upload-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Replay a score stream</h2>
                      <p>
                        Upload .csv or .txt with one or more scores per line.
                      </p>
                    </div>
                    <Upload size={18} />
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt,text/plain,text/csv"
                    hidden
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                  <button
                    className="dropzone"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      upload(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <div className="upload-circle">
                      <Upload size={21} />
                    </div>
                    <strong>Drop a score file here</strong>
                    <span>
                      or click to browse · CSV, TXT · up to 100,000 scores
                    </span>
                  </button>
                  {fileName && (
                    <div className="file-row">
                      <span className="file-icon">CSV</span>
                      <div>
                        <b>{fileName}</b>
                        <small>
                          {replayErrors.length
                            ? `${replayErrors.length} validation errors`
                            : `${replay.length} scores validated`}
                        </small>
                      </div>
                      <button
                        onClick={() => {
                          setReplay([]);
                          setFileName("");
                          setReplayErrors([]);
                          setProgress(0);
                          setPlaying(false);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {replayErrors.length > 0 && (
                    <div className="error-list">
                      {replayErrors.slice(0, 8).map((x, i) => (
                        <div key={i}>{x}</div>
                      ))}
                      {replayErrors.length > 8 && (
                        <div>and {replayErrors.length - 8} more…</div>
                      )}
                    </div>
                  )}
                  <div className="dataset-row">
                    <div>
                      <b>Ready-made datasets</b>
                      <small>Load a sequence to start quickly</small>
                    </div>
                    <button
                      className="secondary-btn"
                      onClick={() => loadDemo()}
                    >
                      Extreme values
                    </button>
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        loadDemo(
                          [4, -2, 4, -2, 7, 7, 0, -9, 4],
                          "Repeated & negative demo",
                        )
                      }
                    >
                      Repeats & negatives
                    </button>
                  </div>
                </section>
                <section className="panel playback-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Playback controls</h2>
                      <p>
                        Starting a replay opens a fresh session; pause and
                        resume keep the current position.
                      </p>
                    </div>
                    <span className="shortcut">
                      {playing ? "PLAYING" : "READY"}
                    </span>
                  </div>
                  <div className="replay-progress">
                    <div>
                      <span>PROGRESS</span>
                      <b>
                        {replay.length
                          ? Math.round((progress / replay.length) * 100)
                          : 0}
                        %
                      </b>
                    </div>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${replay.length ? (progress / replay.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <small>
                      {progress} of {replay.length} scores processed
                    </small>
                  </div>
                  <label className="field-label">INTERVAL BETWEEN SCORES</label>
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value="100">100 ms · Fast</option>
                    <option value="250">250 ms · Normal</option>
                    <option value="500">500 ms · Steady</option>
                    <option value="1000">1,000 ms · Slow</option>
                  </select>
                  <div className="play-controls">
                    <button
                      className="primary-btn"
                      disabled={
                        !replay.length || playing || progress >= replay.length
                      }
                      onClick={startReplay}
                    >
                      <Play size={15} /> {progress ? "Resume" : "Start replay"}
                    </button>
                    <button
                      className="secondary-btn"
                      disabled={!playing}
                      onClick={() => setPlaying(false)}
                    >
                      Pause
                    </button>
                    <button
                      className="secondary-btn"
                      disabled={!replay.length && !progress}
                      onClick={() => {
                        reset();
                      }}
                    >
                      <RotateCcw size={15} /> Reset replay
                    </button>
                  </div>
                  <div className="replay-current">
                    <div>
                      <small>LATEST SCORE</small>
                      <b>{entries.length ? fmt(entries.at(-1)!.score) : "—"}</b>
                    </div>
                    <div>
                      <small>RUNNING MEDIAN</small>
                      <b>{fmt(state?.median)}</b>
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel reference-panel">
                <div>
                  <span className="eyebrow">REFERENCE PANEL</span>
                  <h2>Extreme & duplicate sample</h2>
                  <p>
                    Expected running medians:{" "}
                    <strong>12 · 3.5 · 12 · 12 · 12 · 6 · 12</strong>
                  </p>
                </div>
                <button className="text-btn" onClick={() => loadDemo()}>
                  Load this dataset <ChevronRight size={14} />
                </button>
              </section>
            </>
          )}
          {page === "analytics" && (
            <>
              <div className="metric-grid analytics-metrics">
                <Metric
                  icon={<Activity />}
                  label="OBSERVATIONS"
                  value={entries.length.toLocaleString()}
                  sub="Scores in active session"
                />
                <Metric
                  icon={<BarChart3 />}
                  label="CURRENT MEDIAN"
                  value={fmt(state?.median)}
                  sub="Resistant to outliers"
                  accent
                />
                <Metric
                  icon={<Gauge />}
                  label="ARITHMETIC MEAN"
                  value={fmt(average)}
                  sub="Sensitive to extremes"
                />
                <Metric
                  icon={<Zap />}
                  label="MEDIAN VS MEAN"
                  value={
                    average == null
                      ? "—"
                      : fmt(Math.abs(state!.median - average))
                  }
                  sub="Absolute difference"
                />
              </div>
              <section className="panel chart-panel tall-chart">
                <div className="panel-head">
                  <div>
                    <h2>Running median history</h2>
                    <p>
                      Most recent {chartData.length} points; each reflects the
                      stream state after one insertion
                    </p>
                  </div>
                </div>
                {entries.length ? (
                  <ResponsiveContainer width="100%" height={310}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="fill2" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor="#6c8cff"
                            stopOpacity={0.24}
                          />
                          <stop
                            offset="100%"
                            stopColor="#6c8cff"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#202c40" vertical={false} />
                      <XAxis dataKey="index" stroke="#718097" />
                      <YAxis stroke="#718097" />
                      <Tooltip
                        contentStyle={{
                          background: "#111b2a",
                          border: "1px solid #26344a",
                          borderRadius: 10,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="median"
                        stroke="#7e9bff"
                        strokeWidth={2}
                        fill="url(#fill2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </section>
              <div className="grid-two">
                <section className="panel chart-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Score distribution</h2>
                      <p>
                        12 value bands · recent {entries.length} displayed
                        points
                      </p>
                    </div>
                  </div>
                  {entries.length ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={histogram}>
                        <CartesianGrid stroke="#202c40" vertical={false} />
                        <XAxis dataKey="bucket" stroke="#718097" />
                        <YAxis stroke="#718097" />
                        <Tooltip
                          contentStyle={{
                            background: "#111b2a",
                            border: "1px solid #26344a",
                            borderRadius: 10,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#48b9a7"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </section>
                <section className="panel insight-panel">
                  <span className="insight-icon">
                    <Activity />
                  </span>
                  <h2>Why track the median?</h2>
                  <p>
                    The mean moves toward unusually high or low scores. The
                    median stays anchored to the middle of the sorted
                    distribution, making it a reliable signal of typical
                    performance.
                  </p>
                  <div className="comparison">
                    <div>
                      <span>MEAN</span>
                      <b>{fmt(average)}</b>
                    </div>
                    <div>
                      <span>MEDIAN</span>
                      <b className="blue-text">{fmt(state?.median)}</b>
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <h2>Median history</h2>
                    <p>Complete insertion-by-insertion record</p>
                  </div>
                  <button
                    className="secondary-btn"
                    onClick={() => downloadCsv(allEntries.current)}
                    disabled={!entries.length}
                  >
                    Export CSV
                  </button>
                </div>
                <History rows={[...entries].reverse()} />
              </section>
            </>
          )}
          {page === "algorithm" && (
            <>
              <div className="invariant-strip">
                <Invariant
                  good={state?.orderingValid ?? true}
                  title="ORDERING INVARIANT"
                  text="max(lower) ≤ min(upper)"
                />
                <Invariant
                  good={state?.balanceValid ?? true}
                  title="BALANCE INVARIANT"
                  text="lower size = upper or upper + 1"
                />
              </div>
              <div className="heap-grid">
                <HeapPanel
                  title="MAX HEAP · LOWER HALF"
                  tone="lower"
                  root={state?.lowerRoot ?? null}
                  values={state?.lowerValues ?? []}
                  size={state?.lower ?? 0}
                  description="Stores the smaller half. Root is the largest value in the lower partition."
                />
                <div className="median-bridge">
                  <span>MEDIAN</span>
                  <b>{fmt(state?.median)}</b>
                  <small>
                    {state?.count
                      ? state.count % 2
                        ? "max(lower)"
                        : "(max(lower) + min(upper)) / 2"
                      : "Awaiting first score"}
                  </small>
                </div>
                <HeapPanel
                  title="MIN HEAP · UPPER HALF"
                  tone="upper"
                  root={state?.upperRoot ?? null}
                  values={state?.upperValues ?? []}
                  size={state?.upper ?? 0}
                  description="Stores the larger half. Root is the smallest value in the upper partition."
                />
              </div>
              <section className="panel explainer">
                <div className="panel-head">
                  <div>
                    <h2>How one insertion works</h2>
                    <p>
                      Two roots contain exactly the boundary values needed for
                      the median.
                    </p>
                  </div>
                  <Layers3 />
                </div>
                <div className="steps">
                  <Step
                    n="01"
                    title="Route"
                    text="Compare the new score with the max-heap root. Place it in the lower or upper half."
                  />
                  <Step
                    n="02"
                    title="Rebalance"
                    text="Move a root across if needed. The lower heap holds the same count or one extra."
                  />
                  <Step
                    n="03"
                    title="Read"
                    text="Odd count: max-heap root. Even count: average the two roots using wide arithmetic."
                  />
                </div>
              </section>
              <div className="complexities">
                {[
                  ["Insert", "O(log n)"],
                  ["Rebalance", "O(log n)"],
                  ["Read median", "O(1)"],
                  ["Storage", "O(n)"],
                  ["n insertions", "O(n log n)"],
                ].map((x) => (
                  <div key={x[0]}>
                    <small>{x[0]}</small>
                    <b>{x[1]}</b>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === "performance" && (
            <>
              <section className="panel performance-intro">
                <div>
                  <span className="eyebrow">MEASURED IN THIS BROWSER</span>
                  <h2>Compare the work, not just the theory.</h2>
                  <p>
                    Run both approaches against the same deterministic input.
                    Repeated sorting recomputes the order after every insertion;
                    two heaps preserve the partition incrementally.
                  </p>
                </div>
                <button
                  className="primary-btn"
                  disabled={busy}
                  onClick={runBench}
                >
                  <Gauge size={16} />
                  {busy ? "Measuring…" : "Run benchmark"}
                </button>
              </section>
              <div className="metric-grid perf-metrics">
                <Metric
                  icon={<Zap />}
                  label="HEAP INSERT"
                  value="O(log n)"
                  sub="Two-heap insertion"
                  accent
                />
                <Metric
                  icon={<BarChart3 />}
                  label="MEDIAN READ"
                  value="O(1)"
                  sub="Root access"
                />
                <Metric
                  icon={<Activity />}
                  label="REPEATED SORT"
                  value="O(n² log n)"
                  sub="Across n insertions"
                />
                <Metric
                  icon={<Layers3 />}
                  label="HEAP STREAM"
                  value="O(n log n)"
                  sub="Across n insertions"
                />
              </div>
              {bench ? (
                <>
                  <div className="grid-two">
                    <section className="panel bench-result">
                      <span className="field-label">REPEATED FULL SORT</span>
                      <div className="bench-time">
                        {bench.sort.toFixed(1)}
                        <small> ms</small>
                      </div>
                      <p>
                        {bench.n.toLocaleString()} incremental sorts · array
                        kept sorted each step
                      </p>
                    </section>
                    <section className="panel bench-result">
                      <span className="field-label">TWO-HEAP ENGINE</span>
                      <div className="bench-time teal-text">
                        {bench.heap.toFixed(1)}
                        <small> ms</small>
                      </div>
                      <p>
                        {bench.n.toLocaleString()} insertions · binary heaps
                        with root median
                      </p>
                    </section>
                  </div>
                  <section className="panel benchmark-note">
                    <b>Observed speed ratio</b>
                    <strong>
                      {(bench.sort / Math.max(bench.heap, 0.001)).toFixed(1)}×
                    </strong>
                    <span>
                      One local browser run; timings vary by device and load.
                      The reference keeps the values sorted after each insertion
                      for a conventional repeated-sorting baseline.
                    </span>
                  </section>
                </>
              ) : (
                <div className="empty-state large-empty">
                  <Gauge size={28} />
                  <b>No benchmark run yet</b>
                  <span>
                    Run the comparison to see measured timings from this
                    browser.
                  </span>
                </div>
              )}
              <section className="panel explainer">
                <h2>Why the cost differs</h2>
                <div className="steps">
                  <Step
                    n="SORT"
                    title="Repeated sorting"
                    text="At insertion k, sorting k values costs O(k log k). Summed across n insertions, this is O(n² log n) as a coarse upper estimate."
                  />
                  <Step
                    n="HEAP"
                    title="Two heaps"
                    text="Each insertion performs heap operations in O(log n). Reading a median uses the roots in O(1), for O(n log n) total."
                  />
                  <Step
                    n="NOTE"
                    title="Benchmark method"
                    text="This browser benchmark processes identical deterministic inputs. It measures the reference and heap implementation, excluding UI rendering."
                  />
                </div>
              </section>
            </>
          )}
          {page === "testing" && (
            <>
              <section className="panel test-intro">
                <div>
                  <span className="eyebrow">VALIDATE EVERY INSERTION</span>
                  <h2>Correctness, checked against a reference.</h2>
                  <p>
                    Run deterministic edge cases, randomized differential
                    comparisons, and a 100,000-score stress test.
                  </p>
                </div>
                <button className="primary-btn" onClick={runTests}>
                  <Check size={16} /> Run validation suite
                </button>
              </section>
              <div className="metric-grid test-metrics">
                <Metric
                  icon={<Check />}
                  label="TESTS EXECUTED"
                  value={tests.length ? String(tests.length) : "—"}
                  sub="Latest validation run"
                />
                <Metric
                  icon={<Activity />}
                  label="PASSED"
                  value={
                    tests.length
                      ? String(tests.filter((t) => t.ok).length)
                      : "—"
                  }
                  sub="Actual engine results"
                  accent
                />
                <Metric
                  icon={<X />}
                  label="FAILED"
                  value={
                    tests.length
                      ? String(tests.filter((t) => !t.ok).length)
                      : "—"
                  }
                  sub="Expected zero failures"
                />
                <Metric
                  icon={<Zap />}
                  label="STRESS INPUT"
                  value={tests.length ? "100,000" : "—"}
                  sub="Maximum supported size"
                />
              </div>
              <section className="panel test-results">
                <div className="panel-head">
                  <div>
                    <h2>Test results</h2>
                    <p>Individual results from the latest run</p>
                  </div>
                  {tests.length && tests.every((t) => t.ok) ? (
                    <span className="status-badge">
                      <i /> ALL PASS
                    </span>
                  ) : null}
                </div>
                {tests.length ? (
                  tests.map((t, i) => (
                    <div className="test-row" key={i}>
                      <div className={`test-check ${t.ok ? "ok" : "bad"}`}>
                        {t.ok ? <Check size={15} /> : <X size={15} />}
                      </div>
                      <div>
                        <b>{t.name}</b>
                        <small>{t.detail}</small>
                      </div>
                      <span className={t.ok ? "green-text" : "error-text"}>
                        {t.ok ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Check size={25} />
                    <b>Validation has not run</b>
                    <span>
                      Test results are generated when you run the suite.
                    </span>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      {confirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <RotateCcw />
            </div>
            <h2>Reset this session?</h2>
            <p>
              This clears all scores, heap state, and median history. This
              action cannot be undone.
            </p>
            <div>
              <button
                className="secondary-btn"
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
              <button className="danger-btn" onClick={reset}>
                Reset session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function description(p: string) {
  return (
    (
      {
        live: "Enter signed integer scores one at a time. The running median updates on every insertion.",
        replay:
          "Load a CSV or text file and watch each score update the live median, one step at a time.",
        analytics:
          "Explore the evolving median, score distribution, and mean comparison from this session.",
        algorithm:
          "See how the lower and upper heaps preserve the median boundary after every insertion.",
        performance:
          "Measure repeated sorting against incremental two-heap maintenance in this browser.",
        testing:
          "Exercise edge cases, differential checks, and a 100,000-score stress run.",
      } as Record<string, string>
    )[p] ?? ""
  );
}
function Metric({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <b className={accent ? "blue-text" : ""}>{value}</b>
      <small>{sub}</small>
    </div>
  );
}
function EmptyChart() {
  return (
    <div className="empty-chart">
      <div className="empty-bars">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <span>Graph appears as scores arrive</span>
    </div>
  );
}
function History({ rows }: { rows: Entry[] }) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>INDEX</th>
            <th>INCOMING SCORE</th>
            <th>RUNNING MEDIAN</th>
            <th>MAX HEAP</th>
            <th>MIN HEAP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index}>
              <td className="muted-cell">{String(r.index).padStart(3, "0")}</td>
              <td className="score-cell">{fmt(r.score)}</td>
              <td>
                <span className="median-chip">{fmt(r.median)}</span>
              </td>
              <td>{r.lower}</td>
              <td>{r.upper}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state">
      <Activity size={25} />
      <b>No scores in this session</b>
      <span>Submit a score or load a replay to see the history.</span>
    </div>
  );
}
function Invariant({
  good,
  title,
  text,
}: {
  good: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className="invariant">
      <span className={good ? "inv-ok" : "inv-bad"}>
        {good ? <Check size={15} /> : <X size={15} />}
      </span>
      <div>
        <small>{title}</small>
        <b>{text}</b>
      </div>
      <i className={good ? "green-text" : "error-text"}>
        {good ? "VALID" : "BROKEN"}
      </i>
    </div>
  );
}
function HeapPanel({
  title,
  tone,
  root,
  values,
  size,
  description: d,
}: {
  title: string;
  tone: string;
  root: number | null;
  values: number[];
  size: number;
  description: string;
}) {
  return (
    <section className={`panel heap-panel ${tone}`}>
      <div className="heap-head">
        <div>
          <span className="field-label">{title}</span>
          <p>{d}</p>
        </div>
        <span className="heap-count">{size}</span>
      </div>
      <div className="root-box">
        <small>ROOT</small>
        <b>{fmt(root)}</b>
      </div>
      <div className="heap-values">
        {values.length ? (
          values.map((v, i) => (
            <span className={i === 0 ? "root-value" : ""} key={`${v}-${i}`}>
              {fmt(v)}
            </span>
          ))
        ) : (
          <span className="muted-cell">Empty heap</span>
        )}
        {size > 24 && <span className="muted-cell">+{size - 24} more</span>}
      </div>
    </section>
  );
}
function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="step">
      <span>{n}</span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}
function downloadCsv(rows: Entry[]) {
  const body = [
    "index,score,running_median,max_heap_size,min_heap_size,timestamp",
    ...rows.map((e) =>
      [
        e.index,
        e.score,
        e.median,
        e.lower,
        e.upper,
        new Date(e.timestamp).toISOString(),
      ].join(","),
    ),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = "livescore-history.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
export default App;
