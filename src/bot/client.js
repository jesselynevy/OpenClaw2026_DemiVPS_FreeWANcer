import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { onReady } from "./handlers/onReady.js";
import { onMessage } from "./handlers/onMessage.js";

/** Discord client setup + event registration */
export function createBotClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, onReady(client));
  client.on("messageCreate", onMessage(client));

  return client;
}
