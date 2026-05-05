import { NextResponse } from "next/server";
import { callLlama } from "@/lib/llm";

export async function GET() {
  const result = await callLlama("Summarize this review: The food was great.");
  return NextResponse.json({ result });
}
