"use node";

import Anthropic from "@anthropic-ai/sdk";

export const anthropic = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const MODEL = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const;
