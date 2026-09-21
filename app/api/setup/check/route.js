import { timingSafeEqual } from "node:crypto";
import { redTestImage } from "../../../../lib/setup-image.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const expected = process.env.SETUP_CHECK_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || !/^[a-f0-9]{64}$/.test(supplied) || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return reply({ error: "unauthorized" }, 401);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return reply({ error: "api_key_not_configured", provider: "anthropic" }, 503);
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 128, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: redTestImage().split(",")[1] } }, { type: "text", text: "What is the single dominant color of this image? Reply with exactly one English uppercase color word." }] }] }),
      signal: AbortSignal.timeout(45000),
    });
    if (!upstream.ok) {
      const errorBody = await upstream.json().catch(() => ({}));
      const errorType = errorBody?.error?.type;
      return reply({ error: "upstream_failed", provider: "anthropic", upstreamStatus: upstream.status, upstreamErrorType: typeof errorType === "string" && /^[a-z_]+$/.test(errorType) ? errorType : undefined }, 502);
    }
    const result = await upstream.json();
    const answer = (result.content ?? []).filter(item => item.type === "text").map(item => item.text).join("").trim().replace(/[.!]/g, "").toUpperCase();
    const passed = answer === "RED";
    return reply({ ok: passed, provider: "anthropic", imageInputVerified: passed, model: result.model ?? model, usage: result.usage ?? null }, passed ? 200 : 502);
  } catch (error) {
    return reply({ error: error?.name === "TimeoutError" || error?.name === "AbortError" ? "upstream_timeout" : "upstream_unavailable", provider: "anthropic" }, 502);
  }
}
