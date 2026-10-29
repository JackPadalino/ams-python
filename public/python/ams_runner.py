"""Runs student code inside Pyodide and reports errors in a structured way.

The browser worker loads this file once, then calls ``run(source)`` for each
press of the Run button. ``_amsio`` is a small JavaScript module the worker
registers; it handles output, input() and sleeping.
"""

import builtins
import difflib
import json
import keyword
import linecache
import sys
import time
import traceback

import _amsio

FILENAME = "main.py"


class OutputLimitReached(BaseException):
    """Raised when a program prints far too much (usually an endless loop).

    It derives from BaseException so a student's ``except Exception`` can't
    swallow it.
    """


class _Writer:
    def __init__(self, kind):
        self.kind = kind

    def write(self, text):
        text = str(text)
        if text and not _amsio.write(self.kind, text):
            raise OutputLimitReached
        return len(text)

    def flush(self):
        pass

    def isatty(self):
        return False

    @property
    def encoding(self):
        return "utf-8"


def _input(prompt=""):
    prompt = str(prompt)
    if prompt:
        sys.stdout.write(prompt)
    answer = _amsio.read_input(prompt)
    if answer is None:  # the Stop button was pressed while waiting
        raise KeyboardInterrupt
    return answer


def _sleep(seconds):
    seconds = float(seconds)
    if seconds < 0:
        raise ValueError("sleep length must be non-negative")
    if _amsio.sleep(seconds):  # returns True if Stop was pressed
        raise KeyboardInterrupt


sys.stdout = _Writer("stdout")
sys.stderr = _Writer("stderr")
builtins.input = _input
time.sleep = _sleep


def _suggest(name, candidates):
    """Find the name the student probably meant, e.g. 'pritn' -> 'print'."""
    options = {c for c in candidates if c and not c.startswith("_") and c != name}
    by_lower = {c.lower(): c for c in options}
    if name.lower() in by_lower:
        return by_lower[name.lower()]
    matches = difflib.get_close_matches(name, options, n=1, cutoff=0.8)
    return matches[0] if matches else None


def _report(exc, user_globals):
    info = {
        "kind": "error",
        "type": type(exc).__name__,
        "message": str(exc),
        "line": None,
        "name": None,
        "suggestion": None,
        "objType": None,
    }

    te = traceback.TracebackException.from_exception(exc)
    te.__cause__ = None
    te.__context__ = None

    if isinstance(exc, SyntaxError):
        info["message"] = exc.msg or ""
        info["line"] = exc.lineno
        info["text"] = (exc.text or "").rstrip("\n")
        te.stack = traceback.StackSummary.from_list([])
    else:
        frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == FILENAME]
        if frames:
            info["line"] = frames[-1].lineno
        te.stack = traceback.StackSummary.from_list(frames)

        if isinstance(exc, NameError):
            name = getattr(exc, "name", None)
            info["name"] = name
            if name:
                candidates = list(user_globals) + dir(builtins) + keyword.kwlist
                info["suggestion"] = _suggest(name, candidates)
        elif isinstance(exc, AttributeError):
            name = getattr(exc, "name", None)
            info["name"] = name
            if hasattr(exc, "obj"):
                info["objType"] = type(exc.obj).__name__
                if name:
                    info["suggestion"] = _suggest(name, dir(exc.obj))
        elif isinstance(exc, ImportError):
            info["name"] = getattr(exc, "name", None)

    info["traceback"] = "".join(te.format()).rstrip("\n")
    return info


def run(source):
    """Run one program. Returns a JSON string describing how it ended."""
    linecache.cache[FILENAME] = (len(source), None, source.splitlines(True), FILENAME)
    user_globals = {"__name__": "__main__", "__builtins__": builtins}
    result = {"kind": "finished"}
    try:
        code = compile(source, FILENAME, "exec")
        exec(code, user_globals)
    except SystemExit:
        pass
    except KeyboardInterrupt:
        result = {"kind": "stopped"}
    except OutputLimitReached:
        result = {"kind": "output_limit"}
    except BaseException as exc:  # noqa: BLE001 - we report everything
        result = _report(exc, user_globals)
    return json.dumps(result)
