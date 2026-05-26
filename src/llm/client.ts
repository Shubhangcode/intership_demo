import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const client = new Anthropic();

export async function callLLM({
  system,
  user,
  model = "claude-haiku-4-5-20251001",
}: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: user }],
  });

  const raw = (msg.content[0] as { text: string }).text;
  const cleaned = raw
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    try {
      return jsonrepair(cleaned);
    } catch {
      throw new Error(
        `Could not parse or repair JSON from LLM output:\n${cleaned.slice(0, 300)}`
      );
    }
  }
}
