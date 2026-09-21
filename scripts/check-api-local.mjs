import { POST } from "../app/api/setup/check/route.js";
const request = new Request("http://localhost/api/setup/check", { method: "POST", headers: { Authorization: "Bearer " + (process.env.SETUP_CHECK_TOKEN || "") } });
const result = await POST(request);
const report = await result.json();
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: "local-server-route", status: result.status, ...report }, null, 2));
if (!result.ok || !report.ok) process.exitCode = 1;
