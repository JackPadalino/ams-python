import { useCallback, useEffect, useRef, useState } from "react";

// Must match the slots in public/python-worker.js.
const INPUT_READY = 0;
const INPUT_LENGTH = 1;
const STOP = 2;
const SLEEP = 3;

const INPUT_BUFFER_BYTES = 64 * 1024;
const TIME_LIMIT_MS = 30_000; // running time, not counting waits for input()
const STOP_GRACE_MS = 1500; // how long Stop waits before force-restarting Python

const encoder = new TextEncoder();

/**
 * Runs Python in a background worker.
 *
 * status: "loading" | "ready" | "running" | "unsupported" | "failed"
 * output: [{ kind: "stdout" | "stderr" | "input", text }]
 * result: how the last run ended ({ kind: "finished" | "stopped" | "timeout" |
 *         "output_limit" | "error" | "internal", ... }) or null while running.
 */
export function usePythonRunner() {
  const [status, setStatus] = useState("loading");
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [output, setOutput] = useState([]);
  const [result, setResult] = useState(null);

  const workerRef = useRef(null);
  const shared = useRef(null);
  const pending = useRef([]); // output chunks not yet shown
  const frame = useRef(0);
  const run = useRef({ active: false, waiting: false, usedMs: 0, lastTick: 0, stopReason: null });
  const timers = useRef({ tick: 0, kill: 0 });

  const flushOutput = useCallback(() => {
    frame.current = 0;
    const chunks = pending.current;
    if (!chunks.length) return;
    pending.current = [];
    setOutput((prev) => {
      const next = prev.slice();
      for (const chunk of chunks) {
        const last = next[next.length - 1];
        if (last && last.kind === chunk.kind) {
          next[next.length - 1] = { kind: last.kind, text: last.text + chunk.text };
        } else {
          next.push(chunk);
        }
      }
      return next;
    });
  }, []);

  const addOutput = useCallback(
    (kind, text) => {
      pending.current.push({ kind, text });
      if (!frame.current) frame.current = requestAnimationFrame(flushOutput);
    },
    [flushOutput],
  );

  const finishRun = useCallback(
    (finalResult) => {
      const r = run.current;
      if (!r.active) return;
      r.active = false;
      r.waiting = false;
      clearInterval(timers.current.tick);
      clearTimeout(timers.current.kill);
      cancelAnimationFrame(frame.current);
      flushOutput();
      setWaitingForInput(false);
      let res = finalResult;
      if (res.kind === "stopped" && r.stopReason === "timeout") res = { kind: "timeout" };
      setResult(res);
      setStatus("ready");
    },
    [flushOutput],
  );

  const startWorker = useCallback(() => {
    if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
      setStatus("unsupported");
      return;
    }
    const controlBuffer = new SharedArrayBuffer(4 * 4);
    const inputBuffer = new SharedArrayBuffer(INPUT_BUFFER_BYTES);
    const interruptBuffer = new SharedArrayBuffer(1);
    shared.current = {
      control: new Int32Array(controlBuffer),
      input: new Uint8Array(inputBuffer),
      interrupt: new Uint8Array(interruptBuffer),
    };

    const worker = new Worker("/python-worker.js", { type: "module" });
    workerRef.current = worker;
    setStatus("loading");

    worker.onmessage = (event) => {
      const msg = event.data;
      switch (msg.type) {
        case "ready":
          setStatus("ready");
          break;
        case "output":
          addOutput(msg.kind, msg.text);
          break;
        case "input-request":
          run.current.waiting = true;
          flushOutput();
          setWaitingForInput(true);
          break;
        case "input-received":
          run.current.waiting = false;
          run.current.lastTick = performance.now();
          setWaitingForInput(false);
          break;
        case "done":
          finishRun(msg.result);
          break;
        case "fatal":
          console.error("Python worker failed:", msg.message);
          finishRun({ kind: "internal", message: msg.message });
          setStatus("failed");
          break;
      }
    };
    worker.onerror = (event) => {
      console.error("Python worker error:", event.message);
      setStatus("failed");
    };
    worker.postMessage({ type: "init", controlBuffer, inputBuffer, interruptBuffer });
  }, [addOutput, finishRun, flushOutput]);

  useEffect(() => {
    startWorker();
    return () => {
      clearInterval(timers.current.tick);
      clearTimeout(timers.current.kill);
      workerRef.current?.terminate();
    };
  }, [startWorker]);

  const stop = useCallback(
    (reason = "user") => {
      const r = run.current;
      if (!r.active || r.stopReason) return;
      r.stopReason = reason;
      const { control, interrupt } = shared.current;
      Atomics.store(control, STOP, 1);
      interrupt[0] = 2; // SIGINT: Python raises KeyboardInterrupt soon
      Atomics.notify(control, INPUT_READY);
      Atomics.notify(control, SLEEP);
      // If Python doesn't stop in time (stuck somewhere it can't be
      // interrupted), throw the worker away and start a fresh one.
      timers.current.kill = setTimeout(() => {
        if (!run.current.active) return;
        workerRef.current?.terminate();
        finishRun({ kind: "stopped" });
        startWorker();
      }, STOP_GRACE_MS);
    },
    [finishRun, startWorker],
  );

  const runCode = useCallback(
    (code) => {
      if (status !== "ready" || run.current.active) return;
      const { control, interrupt } = shared.current;
      control.fill(0);
      interrupt[0] = 0;
      pending.current = [];
      setOutput([]);
      setResult(null);
      setStatus("running");
      run.current = { active: true, waiting: false, usedMs: 0, lastTick: performance.now(), stopReason: null };
      timers.current.tick = setInterval(() => {
        const r = run.current;
        const now = performance.now();
        if (!r.waiting) r.usedMs += now - r.lastTick;
        r.lastTick = now;
        if (r.usedMs > TIME_LIMIT_MS) stop("timeout");
      }, 250);
      workerRef.current.postMessage({ type: "run", code });
    },
    [status, stop],
  );

  const sendInput = useCallback(
    (text) => {
      if (!run.current.waiting) return;
      const { control, input } = shared.current;
      let bytes = encoder.encode(text);
      if (bytes.length > input.length) bytes = bytes.subarray(0, input.length);
      input.set(bytes);
      addOutput("input", text + "\n");
      Atomics.store(control, INPUT_LENGTH, bytes.length);
      Atomics.store(control, INPUT_READY, 1);
      Atomics.notify(control, INPUT_READY);
    },
    [addOutput],
  );

  const clearOutput = useCallback(() => {
    if (run.current.active) return;
    setOutput([]);
    setResult(null);
  }, []);

  return { status, waitingForInput, output, result, runCode, stop, sendInput, clearOutput };
}
