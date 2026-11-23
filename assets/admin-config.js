// Admin login credentials.
// Only a SHA-256 hash of "username:password" is stored here — never the password itself.
// To change it, run:   node tools/set-password.js <username> <password>
// Current login: admin / 0000 (a 4-digit PIN is easy to guess from this hash; use a longer password for real protection).
window.ADMIN_CONFIG = {
  credentialHash: "3e05ac42a24563324d28e58f2329a39cc71bb9242050f3b41b51823ae1bbd384"
};
