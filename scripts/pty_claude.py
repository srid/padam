#!/usr/bin/env python3
"""
PTY driver for headless-but-subscription-billed Claude Code (stage 2).

We must NOT use `claude -p` (that bills SDK/API credits). Instead we run the
*interactive* `claude` TUI inside a pseudo-terminal so it authenticates via the
Max-plan OAuth login — interactive usage is subscription-billed.

To get reliable structured output out of a TUI (which is otherwise a nightmare to
scrape), we don't parse the screen at all. We send a one-line instruction telling
Claude to WRITE its answer to a file, then poll the filesystem for valid JSON.
Permissions can't stall us: `--permission-mode acceptEdits` auto-accepts the Write,
and Read needs no permission.

  python3 pty_claude.py <one-line-prompt> <watch_file> <timeout_s> [-- claude args...]

Exit 0 once <watch_file> contains a valid storyboard (object with a non-empty
`scenes` array); exit 2 on timeout (last screen dumped to stderr for debugging).
"""
import os, pty, time, select, signal, struct, fcntl, termios, re, sys, json

argv = sys.argv[1:]
prompt = argv[0]
watch = argv[1]
timeout = float(argv[2]) if len(argv) > 2 else 240.0
claude_args = argv[4:] if (len(argv) > 3 and argv[3] == "--") else [
    "--model", "sonnet", "--effort", "medium", "--permission-mode", "acceptEdits",
]


def valid(path):
    try:
        with open(path) as f:
            s = f.read()
    except Exception:
        return False
    if '"scenes"' not in s:
        return False
    try:
        d = json.loads(s)
        return isinstance(d, dict) and isinstance(d.get("scenes"), list) and len(d["scenes"]) >= 1
    except Exception:
        # The model sometimes emits slightly-invalid JSON (e.g. unescaped quotes in a
        # caption). Accept once the file looks complete + stable; direct.ts repairs &
        # zod-validates. (The poll loop re-checks after a beat, so it must be settled.)
        t = s.rstrip()
        return t.endswith("}") and t.count("{") >= 3


# Start from a clean slate so a stale file can't false-positive.
try:
    os.remove(watch)
except FileNotFoundError:
    pass

pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = "xterm-256color"
    os.execvp("claude", ["claude", *claude_args])

# Parent: give the TUI a wide window so nothing wraps; then drive it.
try:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 60, 240, 0, 0))
except Exception:
    pass


def read_avail():
    chunks = b""
    while True:
        r, _, _ = select.select([fd], [], [], 0)
        if not r:
            break
        try:
            d = os.read(fd, 65536)
        except OSError:
            break
        if not d:
            break
        chunks += d
    return chunks


# Wait until the input prompt (❯) / footer is on screen, then a beat to settle.
buf = b""
t0 = time.time()
while time.time() - t0 < 12:
    r, _, _ = select.select([fd], [], [], 0.2)
    if r:
        try:
            buf += os.read(fd, 65536)
        except OSError:
            break
    if b"\xe2\x9d\xaf" in buf or b"shortcuts" in buf:  # ❯ or footer
        break
time.sleep(1.0)
read_avail()

def strip_ansi(b):
    t = b.decode("utf-8", "replace")
    t = re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", t)
    t = re.sub(r"\x1b\][^\x07]*\x07", "", t)
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", t)


# Type the instruction, THEN submit with a separate Enter. A single combined
# write("text\r") gets absorbed as input without submitting; the TUI needs the
# Return as its own keystroke. Nudge with extra Enters until it actually starts.
os.write(fd, prompt.encode())
time.sleep(0.8)
os.write(fd, b"\r")
sys.stderr.write("pty: prompt typed + Enter; waiting for %s …\n" % watch)
sys.stderr.flush()

tail = b""
submitted = False
ts = time.time()
while time.time() - ts < 12 and not submitted:
    time.sleep(1.0)
    tail += read_avail()
    low = strip_ansi(tail)[-2000:].lower()
    # "esc to interrupt" footer (generating) or a tool line means it submitted.
    if "esc to interrupt" in low or "interrupt" in low or "write(" in low or "read(" in low or os.path.exists(watch):
        submitted = True
        break
    os.write(fd, b"\r")  # nudge: re-send Enter (no-op on an empty input box)

ok = False
t1 = time.time()
beat = 0.0
while time.time() - t1 < timeout:
    tail += read_avail()
    if len(tail) > 200000:
        tail = tail[-100000:]
    if valid(watch):
        time.sleep(1.2)  # let a final flush land, then re-check stability
        if valid(watch):
            ok = True
            break
    if time.time() - beat > 15:
        beat = time.time()
        sys.stderr.write("pty: %ds elapsed…\n" % int(time.time() - t1))
        sys.stderr.flush()
    time.sleep(0.5)

# Tear down the interactive session.
for sig in (signal.SIGINT, signal.SIGINT, signal.SIGTERM, signal.SIGKILL):
    try:
        os.kill(pid, sig)
    except ProcessLookupError:
        break
    time.sleep(0.3)

if ok:
    print("PTY_OK")
    sys.exit(0)

txt = tail.decode("utf-8", "replace")
txt = re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", txt)
txt = re.sub(r"\x1b\][^\x07]*\x07", "", txt)
txt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", txt)
sys.stderr.write("\n--- last screen (stripped) ---\n" + txt[-2500:] + "\n")
print("PTY_TIMEOUT")
sys.exit(2)
