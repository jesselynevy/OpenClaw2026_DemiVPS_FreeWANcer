import "dotenv/config";
import { createBotClient } from "./bot/client.js";
import { initDb } from "./db/database.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

initDb();

const client = createBotClient();
await client.login(token);
