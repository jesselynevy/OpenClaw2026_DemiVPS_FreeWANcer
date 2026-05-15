import "dotenv/config";
import { createBotClient } from "./bot/client.js";
import { initDb } from "./db/database.js";
import { startSchedulers } from "./scheduler/cron.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

initDb();

const client = createBotClient();
client.once("ready", async () => {
    console.log(`Logged in as ${client.user?.tag ?? "unknown"}`);
    startSchedulers(client);
})
await client.login(token);
