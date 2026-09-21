import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const cli = process.argv[2] || process.env.VERCEL_CLI_PATH || readFileSync(new URL("../.vercel/cli-path.txt", import.meta.url), "utf8").trim();
const project = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"));
const keys = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "SETUP_CHECK_TOKEN"];
const variables = keys.map(key => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error("Missing local variable: " + key);
  return { key, value, type: key === "ANTHROPIC_MODEL" ? "plain" : "sensitive", target: ["production", "preview"] };
});
// CLI 59 cannot serialize a top-level array here; submit one JSON object at a time.
for (const variable of variables) {
  const result = spawnSync(process.execPath, [cli, "api", "/v10/projects/" + project.projectId + "/env?upsert=true&teamId=" + project.orgId, "--method", "POST", "--header", "Content-Type: application/json", "--input", "-", "--silent"], { input: JSON.stringify(variable), encoding: "utf8", timeout: 90000, windowsHide: true });
  if (result.status !== 0) {
    let detail = String(result.stderr || result.error?.message || "");
    for (const secret of variables) detail = detail.split(secret.value).join("[REDACTED]");
    console.error("Environment sync failed for", variable.key, "Exit code:", result.status, detail.slice(0, 1500));
    process.exit(1);
  }
}
console.log(JSON.stringify({ project: project.projectName, syncedKeys: keys, targets: ["production", "preview"], valuesPrinted: false }));
