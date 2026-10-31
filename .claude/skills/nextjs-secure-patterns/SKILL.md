---
name: nextjs-secure-patterns
description: Secure, consistent patterns for this Next.js 15 + Drizzle + Anthropic SDK codebase. Use when writing route handlers, database code, middleware, forms, or any code that touches uploads or model output.
---

# Next.js secure patterns

- **Route handlers** (`src/app/api/**/route.ts`): `runtime = "nodejs"`; return via `json()`/`fail()` from `src/lib/http.ts` (no-store). Validate bodies with zod. Rate limit before expensive work. Log details server-side, return a short reference id to the client.
- **Uploads**: check size, then magic bytes (`sniff`), never trust `file.type` or the filename.
- **Model output** is untrusted: force a tool call, then whitelist, coerce and clamp (`sanitise`). Never feed raw document text into a later prompt; pass structured data only.
- **Database**: Drizzle only, no string-built SQL. Store extracted fields and findings, never uploaded files. Respect `RETENTION_DAYS`.
- **React**: no `dangerouslySetInnerHTML`. Render text as text. Keep secrets out of client components; only `NEXT_PUBLIC_*` reaches the browser (we use none).
- **CSP**: nonce-based via `src/middleware.ts`; pages that need the nonce are dynamic (`export const dynamic = "force-dynamic"`). Do not add inline scripts.
- **Params** in Next 15 route handlers are a Promise: `const { name } = await params`.
- **Definition of done**: `npm run typecheck && npm test && npm run eval` pass, MEMORY.md updated.
