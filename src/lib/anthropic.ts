import Anthropic from "@anthropic-ai/sdk";
let client: Anthropic | null | undefined;
// Timeout and retries are sized to fit the route's maxDuration (60 s): one 40 s attempt, no hidden retries.
export function getClient(): Anthropic | null {
  if (client === undefined) client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: 40_000, maxRetries: 0 }) : null;
  return client;
}
export const model = () => process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
