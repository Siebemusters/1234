// CLI: maak of reset een gebruiker.
//   node create-user.mjs <gebruikersnaam> <wachtwoord>
// Gebruikt hetzelfde auth-bestand als de server (CRM_AUTH_FILE of data/auth.json).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AuthStore } from "./lib/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = process.env.CRM_AUTH_FILE || join(__dirname, "data", "auth.json");

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error("Gebruik: node create-user.mjs <gebruikersnaam> <wachtwoord (min. 10 tekens)>");
  process.exit(1);
}

const auth = new AuthStore(AUTH_FILE);
try {
  if (auth.getUserByName(username)) {
    auth.setPassword(username, password);
    console.log(`Wachtwoord van "${username.toLowerCase()}" bijgewerkt.`);
  } else {
    const u = auth.createUser(username, password);
    console.log(`Gebruiker "${u.username}" aangemaakt.`);
  }
} catch (e) {
  console.error("Fout:", e.message);
  process.exit(1);
}
