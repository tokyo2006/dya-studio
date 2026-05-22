import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

let tag = "0.0.0";

try {
  tag = execSync("git describe --tags --exact-match HEAD", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] })
    .toString()
    .trim()
    .replace(/^v/, "");
} catch {
  try {
    tag = execSync("git describe --tags HEAD", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim()
      .replace(/^v/, "");
  } catch {
    tag = "0.0.0";
  }
}

pkg.version = tag;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log(`Version set to: ${tag}`);