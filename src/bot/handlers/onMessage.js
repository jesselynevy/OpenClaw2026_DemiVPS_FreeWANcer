import { qwenpawChat } from "../../agent/qwenpaw.js";
import { INTAKE_PROMPT } from "../../agent/prompts.js";
import { createPrivateClientChannel, assignClientRoleToMember } from "../../services/channelManager.js";
import { getClientByDiscordId, getClientByChannelId, upsertClient } from "../../db/database.js";

// In-memory conversation history per channel: channelId → Message[]
const histories = new Map();

function sanitizeChannelName(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .concat("-project");
}

async function handleIntake(client, message) {
  const existing = await getClientByDiscordId(message.author.id);

  if (existing?.private_channel_id) {
    const ch = message.guild.channels.cache.get(existing.private_channel_id);
    const ref = ch ? `<#${ch.id}>` : `channel ID ${existing.private_channel_id}`;
    await message.reply(`Kamu sudah punya channel proyek, lanjutkan di sana: ${ref} 👋`);
    return;
  }

  const channelName = sanitizeChannelName(message.author.username);

  let privateChannel;
  try {
    privateChannel = await createPrivateClientChannel(message.guild, message.member, channelName);
  } catch (err) {
    console.error("Failed to create private channel:", err);
    await message.reply("Terjadi kesalahan saat membuat channel. Coba lagi atau hubungi admin.");
    return;
  }

  try {
    await assignClientRoleToMember(message.member);
  } catch (err) {
    console.error("Failed to assign Client role:", err);
  }

  await upsertClient(message.author.id, privateChannel.id);

  await privateChannel.send(
    `Halo <@${message.author.id}>! 👋 Selamat datang di FreeWANcer.\n\n` +
    `Channel ini adalah ruang privat kita untuk diskusi proyekmu. ` +
    `Ceritakan dulu apa yang kamu butuhkan — jenis pekerjaan, deadline, dan budget kalau ada.`
  );

  await message.reply(`Channel proyekmu sudah dibuat: <#${privateChannel.id}> ✅`);

  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    const notifCh = message.guild.channels.cache.get(notifId);
    if (notifCh) {
      await notifCh.send(
        `📥 **Klien baru masuk:** <@${message.author.id}> (${message.author.username})\n` +
        `Channel: <#${privateChannel.id}>`
      );
    }
  }
}

async function handleProjectChannel(client, message) {
  const chId = message.channelId;

  const existing = await getClientByChannelId(chId);
  if (!existing) return;

  if (!histories.has(chId)) histories.set(chId, []);
  const history = histories.get(chId);

  history.push({ role: "user", content: message.content });

  // Keep last 20 turns to stay within context limits
  const trimmed = history.slice(-20);

  let reply;
  try {
    await message.channel.sendTyping();
    reply = await qwenpawChat({
      messages: [{ role: "system", content: INTAKE_PROMPT }, ...trimmed],
    });
  } catch (err) {
    console.error("QwenPaw error:", err);
    await message.reply("Maaf, AI sedang tidak bisa diakses. Coba lagi sebentar ya. 🙏");
    return;
  }

  history.push({ role: "assistant", content: reply });

  // Discord max message length is 2000 chars
  if (reply.length <= 2000) {
    await message.reply(reply);
  } else {
    for (let i = 0; i < reply.length; i += 2000) {
      await message.channel.send(reply.slice(i, i + 2000));
    }
  }
}

/** Route messages: intake vs. project channel */
export function onMessage(client) {
  return async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const intakeId = process.env.INTAKE_CHANNEL_ID;

    if (intakeId && message.channelId === intakeId) {
      await handleIntake(client, message);
      return;
    }

    await handleProjectChannel(client, message);
  };
}
