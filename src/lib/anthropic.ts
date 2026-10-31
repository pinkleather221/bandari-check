import Anthropic from "@anthropic-ai/sdk";
let client: Anthropic | null | undefined;
export function getClient(): Anthropic | null {
  if (client === undefined) client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: 90_000, maxRetries: 2 }) : null;
  return client;
}
export const model = () => process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
