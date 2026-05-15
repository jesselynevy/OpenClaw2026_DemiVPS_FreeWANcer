import { qwenpawChat } from "../../agent/qwenpaw.js";
import { INTAKE_PROMPT } from "../../agent/prompts.js";
import { createPrivateClientChannel, assignClientRoleToMember } from "../../services/channelManager.js";
import { getClientByDiscordId, getClientByChannelId, upsertClient } from "../../db/database.js";
import { isHandoffTrigger, stripHandoffTag, executeHandoff } from "../../services/handoff.js";

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

async function sendLong(target, text) {
  for (let i = 0; i < text.length; i += 2000) {
    await target.send(text.slice(i, i + 2000));
  }
}

// ─── Intake channel: onboard new client ──────────────────────────────────────

async function handleIntake(client, message) {
  const existing = getClientByDiscordId(message.author.id);

  if (existing?.private_channel_id) {
    const ch = message.guild.channels.cache.get(existing.private_channel_id);
    const ref = ch ? `<#${ch.id}>` : `channel ID \`${existing.private_channel_id}\``;
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

  upsertClient(message.author.id, privateChannel.id);

  await privateChannel.send(
    `Halo <@${message.author.id}>! 👋 Selamat datang di **FreeWANcer**.\n\n` +
    `Channel ini adalah ruang privat kita untuk diskusi proyekmu. ` +
    `Ceritakan dulu apa yang kamu butuhkan — jenis pekerjaan, deadline, dan budget kalau ada.`
  );
  await message.reply(`Channel proyekmu sudah dibuat: <#${privateChannel.id}> ✅`);

  // Notify freelancer zone
  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    const notifCh = message.guild.channels.cache.get(notifId);
    notifCh?.send(
      `📥 **Klien baru masuk:** <@${message.author.id}> (${message.author.username})\n` +
      `Channel: <#${privateChannel.id}>`
    );
  }
}

// ─── Project channel: AI intake or freelancer+AI monitor ─────────────────────

async function handleProjectChannel(client, message) {
  const chId = message.channelId;
  const existing = getClientByChannelId(chId);
  if (!existing) return;

  const phase = existing.phase ?? "intake";

  // ── /handoff  — freelancer manually triggers handoff ──
  if (message.content.trim() === "/handoff") {
    if (phase === "handoff") {
      await message.reply("⚠️ Channel ini sudah dalam fase handoff.");
      return;
    }
    const history = histories.get(chId) ?? [];
    await message.reply("⏳ Generating brief proyek...");
    await executeHandoff({
      guild: message.guild,
      discordUserId: existing.discord_user_id,
      privateChannel: message.channel,
      history,
    });
    return;
  }

  // ── /ai [pertanyaan]  — explicit AI call (works in both phases) ──
  if (message.content.startsWith("/ai ")) {
    const question = message.content.slice(4).trim();
    if (!question) return;
    const history = histories.get(chId) ?? [];
    try {
      await message.channel.sendTyping();
      const reply = await qwenpawChat({
        messages: [
          { role: "system", content: INTAKE_PROMPT },
          ...history.slice(-20),
          { role: "user", content: question },
        ],
      });
      await message.reply(reply.length <= 2000 ? reply : reply.slice(0, 1997) + "…");
    } catch (err) {
      console.error("QwenPaw /ai error:", err);
      await message.reply("Maaf, AI sedang tidak bisa diakses. 🙏");
    }
    return;
  }

  // ── Phase: handoff — AI diam, freelancer chat langsung ──
  if (phase === "handoff") return;

  // ── Phase: intake — AI jawab semua pesan ──
  if (!histories.has(chId)) histories.set(chId, []);
  const history = histories.get(chId);

  history.push({ role: "user", content: message.content });

  let rawReply;
  try {
    await message.channel.sendTyping();
    rawReply = await qwenpawChat({
      messages: [{ role: "system", content: INTAKE_PROMPT }, ...history.slice(-20)],
    });
  } catch (err) {
    console.error("QwenPaw error:", err);
    history.pop(); // remove the unprocessed user message
    await message.reply("Maaf, AI sedang tidak bisa diakses. Coba lagi sebentar ya. 🙏");
    return;
  }

  const doHandoff = isHandoffTrigger(rawReply);
  const visibleReply = stripHandoffTag(rawReply);

  history.push({ role: "assistant", content: visibleReply });

  if (visibleReply.length <= 2000) {
    await message.reply(visibleReply);
  } else {
    await sendLong(message.channel, visibleReply);
  }

  if (doHandoff) {
    await executeHandoff({
      guild: message.guild,
      discordUserId: existing.discord_user_id,
      privateChannel: message.channel,
      history,
    });
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function onMessage(client) {
  return async (message) => {
    console.log(`[msg] author=${message.author.tag} bot=${message.author.bot} channel=${message.channelId} content="${message.content.slice(0,50)}"`);
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
