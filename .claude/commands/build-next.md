---
description: Run the next task from MEMORY.md through the right subagents
---
Read MEMORY.md. Use the planner subagent to confirm the top item under `## Next`, delegate it to the owning subagent, then run security-reviewer if it touched uploads, routes, middleware or rendering, and qa-demo to run all checks. Finish by confirming MEMORY.md was updated by each agent.
