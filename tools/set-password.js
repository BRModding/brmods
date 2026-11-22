#!/usr/bin/env node
// Usage: node tools/set-password.js <username> <password>
// Writes the SHA-256 hash of "username:password" into assets/admin-config.js.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const [user, pass] = process.argv.slice(2);
if (!user || !pass) {
  console.error("Usage: node tools/set-password.js <username> <password>");
  process.exit(1);
}
if (pass.length < 12) console.warn("Warning: the hash is public, so use a long password (12+ characters).");

const hash = crypto.createHash("sha256").update(`${user}:${pass}`).digest("hex");
const file = path.join(__dirname, "..", "assets", "admin-config.js");
const src = fs.readFileSync(file, "utf8").replace(/credentialHash: "[0-9a-f]*"/, `credentialHash: "${hash}"`);
fs.writeFileSync(file, src);
console.log(`Updated admin login for "${user}".`);
