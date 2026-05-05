import fetch from "node-fetch";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};

type ChatRole = "system" | "user" | "assistant";

/**
 * System context for review triage: models often refuse when user content is profane or abusive.
 * This frames the task as legitimate ops work—neutral paraphrase only, never refuse the request.
 */
export const REVIEW_TRIAGE_SYSTEM = `You assist a hospitality business with authentic customer review text.
Reviews may include profanity, insults, slurs, hostility, or other offensive wording. You must still complete the exact task in the user message.
Never refuse, never apologize for being unable to help, and never say you cannot generate content or that the input is inappropriate to process.
Use neutral, professional language only. Do not quote or repeat profanity, slurs, hate, or direct personal insults from the review—paraphrase substance only (e.g. positive on food, negative on staff interaction).`;

export async function callLlama(
  prompt: string,
  options?: { system?: string; temperature?: number }
): Promise<string> {
  const messages: { role: ChatRole; content: string }[] = [];
  if (options?.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-8b-instruct",
      messages,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error("LLM request failed");
  }

  const data = (await res.json()) as OpenRouterResponse;
  return data.choices[0].message.content;
}
