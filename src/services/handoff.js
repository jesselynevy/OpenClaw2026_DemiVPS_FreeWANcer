import { qwenpawChat } from "../agent/qwenpaw.js";
import { PRD_PROMPT } from "../agent/prompts.js";
import { updateClientPhase } from "../db/database.js";

export function isHandoffTrigger(aiResponse) {
  return aiResponse.includes("[HANDOFF]");
}

// Strip the [HANDOFF] tag from text shown to the client
export function stripHandoffTag(text) {
  return text.replace("[HANDOFF]", "").trim();
}

export async function executeHandoff({ guild, discordUserId, privateChannel, history }) {
  updateClientPhase(discordUserId, "handoff");

  // Generate PRD brief from conversation history
  let brief;
  try {
    brief = await qwenpawChat({
      messages: [
        { role: "system", content: PRD_PROMPT },
        ...history.slice(-30),
      ],
      temperature: 0.3,
    });
  } catch (err) {
    console.error("Failed to generate PRD:", err);
    brief = "_Gagal generate brief otomatis. Silakan lihat riwayat percakapan di channel klien._";
  }

  // Post structured brief to #notifikasi
  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    const notifCh = guild.channels.cache.get(notifId);
    if (notifCh) {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      const mention = staffRoleId ? `<@&${staffRoleId}> ` : "";
      const msg =
        `${mention}📋 **Brief Proyek Baru Masuk!**\n\n` +
        `**Klien:** <@${discordUserId}>\n` +
        `**Channel:** <#${privateChannel.id}>\n\n` +
        brief;

      // Discord max 2000 chars per message
      for (let i = 0; i < msg.length; i += 2000) {
        await notifCh.send(msg.slice(i, i + 2000));
      }
    }
  }

  // Confirm to client in their private channel
  await privateChannel.send(
    "✅ **Brief proyekmu sudah dikirim ke freelancer!**\n" +
    "Tunggu sebentar ya, mereka akan segera menghubungi kamu langsung di channel ini. 🙏\n\n" +
    "_Sambil nunggu, kalau ada yang mau ditanya ketik `/ai [pertanyaanmu]`_"
  );
}
