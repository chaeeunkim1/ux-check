export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "ux-check", stage: "deployment-preparation", revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" }, { headers: { "Cache-Control": "no-store" } });
}
