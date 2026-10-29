// Runs Python (Pyodide) off the main thread so the page never freezes.
//
// The page and this worker share memory (SharedArrayBuffer) so Python can
// truly pause: input() and time.sleep() block here with Atomics.wait until
// the page answers or the Stop button is pressed.
//
// control (Int32Array) slots:
const INPUT_READY = 0; // page sets to 1 when an input() answer is waiting
const INPUT_LENGTH = 1; // byte length of that answer
const STOP = 2; // page sets to 1 when Stop is pressed
const SLEEP = 3; // always 0; time.sleep() waits on it so Stop can wake it

const OUTPUT_LIMIT = 100_000; // characters per run

import { loadPyodide } from "/pyodide/pyodide.mjs";

let pyodide;
let runner;
let control;
let inputBytes;
let outputCount = 0;

const decoder = new TextDecoder();

const amsio = {
  write(kind, text) {
    outputCount += text.length;
    if (outputCount > OUTPUT_LIMIT) return false;
    self.postMessage({ type: "output", kind, text });
    return true;
  },

  read_input() {
    self.postMessage({ type: "input-request" });
    while (Atomics.load(control, INPUT_READY) === 0 && Atomics.load(control, STOP) === 0) {
      Atomics.wait(control, INPUT_READY, 0);
    }
    self.postMessage({ type: "input-received" });
    if (Atomics.load(control, STOP) === 1) return undefined; // becomes None
    const length = Atomics.load(control, INPUT_LENGTH);
    // TextDecoder can't read shared memory directly, so copy it out first.
    const copy = new Uint8Array(length);
    copy.set(inputBytes.subarray(0, length));
    Atomics.store(control, INPUT_READY, 0);
    return decoder.decode(copy);
  },

  sleep(seconds) {
    if (Atomics.load(control, STOP) === 0) {
      Atomics.wait(control, SLEEP, 0, seconds * 1000);
    }
    return Atomics.load(control, STOP) === 1;
  },
};

async function init(msg) {
  control = new Int32Array(msg.controlBuffer);
  inputBytes = new Uint8Array(msg.inputBuffer);
  pyodide = await loadPyodide({ indexURL: "/pyodide/" });
  pyodide.setInterruptBuffer(new Uint8Array(msg.interruptBuffer));
  pyodide.registerJsModule("_amsio", amsio);
  const source = await (await fetch("/python/ams_runner.py")).text();
  pyodide.FS.writeFile("/home/pyodide/ams_runner.py", source);
  runner = pyodide.pyimport("ams_runner");
  self.postMessage({ type: "ready" });
}

function run(code) {
  outputCount = 0;
  let result;
  try {
    result = JSON.parse(runner.run(code));
  } catch (err) {
    // Something went wrong outside the student's code (e.g. Stop pressed at
    // an awkward moment). Treat a stop as a stop; anything else is internal.
    result = Atomics.load(control, STOP) === 1
      ? { kind: "stopped" }
      : { kind: "internal", message: String(err) };
  }
  self.postMessage({ type: "done", result });
}

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === "init") await init(msg);
    else if (msg.type === "run") run(msg.code);
  } catch (err) {
    self.postMessage({ type: "fatal", message: String(err) });
  }
};
