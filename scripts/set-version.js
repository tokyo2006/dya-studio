import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const tag = execSync("git describe --tags --exact-match HEAD 2>/dev/null || git describe --tags HEAD 2>/dev/null || echo '0.0.0'")
  .toString()
  .trim()
  .replace(/^v/, "");

pkg.version = tag;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log(`Version set to: ${tag}`);