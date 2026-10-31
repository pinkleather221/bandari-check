---
name: memory-keeper
description: How every agent reads and writes MEMORY.md, the shared project memory. Use at the start and end of every task, and whenever a decision, bug or open question appears.
---

# Memory keeper

`MEMORY.md` is the only memory that survives between sessions and between subagents. If it is not written there, it is lost.

## Read
Read the whole file first. Obey `## Decisions` unless you log a reason to change one.

## Write
Append a log entry under `## Log` (newest at the bottom):

```
### 2026-10-31 14:20 · builder
- Did: <one line per change, with file paths>
- Why: <the reason or decision>
- Verified: <commands run and results> / Not verified: <what you could not run>
- Next: <the single most useful next step and who should do it>
```

Also update, in place: `## Status` (what works, what is broken), `## Decisions` (add, never silently remove), `## Open questions`, `## Next` (max 5 items, ordered).

## Rules
- Facts only. Say "not run" instead of implying a pass.
- No secrets, keys, real customer data or document contents.
- Keep entries under 12 lines. If the file passes 300 lines, compress old log entries into `## Archive` keeping decisions intact.
- A Stop hook blocks finishing when code is newer than MEMORY.md; update the file rather than touching it.
