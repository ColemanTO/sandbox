#!/usr/bin/env python3
"""Print the frame on screen at the start of each story and step of a recorded sprint demo.

Usage: frames_at.py demo/output/Sprint5Demo

Reads timeline.json (seconds from the first frame) and frames.txt (each frame's duration) and
prints one line per timeline entry: time, type, text and the frame image to open. Each step is
sampled 1 second after it starts, so its caption is already on screen.
"""
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = Path(sys.argv[1])
    timeline = json.loads((out / "timeline.json").read_text())

    files, durations = [], []
    for line in (out / "frames.txt").read_text().splitlines():
        if line.startswith("file "):
            files.append(line[6:-1])
        elif line.startswith("duration "):
            durations.append(float(line.split()[1]))
    files = files[: len(durations)]  # the last file is repeated without a duration

    starts, t = [], 0.0
    for d in durations:
        starts.append(t)
        t += d
    print(f"Video length: {t:.1f}s, {len(files)} frames\n")

    for entry in timeline:
        at = entry["at"] + 1.0
        index = max((i for i, s in enumerate(starts) if s <= at), default=0)
        label = entry.get("title") or entry.get("text", "")
        story = entry.get("id", "")
        print(f"{entry['at']:6.1f}s  {entry['type']:<5} {story:<6} {label}\n        {files[index]}")


if __name__ == "__main__":
    main()
