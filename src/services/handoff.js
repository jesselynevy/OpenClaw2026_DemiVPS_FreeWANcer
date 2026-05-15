import { qwenpawChat } from "../agent/qwenpaw.js";
import { getProjectByChannelId, setProjectPhase } from "../db/database.js";

export function isHandoffTrigger(aiResponse) {
  return aiResponse.includes("[HANDOFF]");
}

export function stripHandoffTag(text) {
  return text.replace("[HANDOFF]", "").trim();
}

export async function executeHandoff({ guild, discordUserId, privateChannel, history }) {
  // Transition project intake → discussion
  const project = getProjectByChannelId(privateChannel.id);
  if (project) setProjectPhase(project.id, "discussion");

  // Generate quick intake summary for freelancer
  let summary;
  try {
    summary = await qwenpawChat({
      messages: [
        {
          role: "system",
          content:
            "Buat ringkasan singkat (maks 5 bullet point) kebutuhan klien berdasarkan percakapan. " +
            "Bahasa Indonesia. Format: bullet point dengan emoji.",
        },
        ...history.slice(-20),
        { role: "user", content: "Rangkum kebutuhan klien secara singkat." },
      ],
      temperature: 0.3,
    });
  } catch (err) {
    console.error("Failed to generate handoff summary:", err);
    summary = "_Gagal generate ringkasan. Lihat riwayat percakapan di channel._";
  }

  // Post to #notifikasi
  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    const notifCh = guild.channels.cache.get(notifId);
    if (notifCh) {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      const mention = staffRoleId ? `<@&${staffRoleId}> ` : "";
      const msg =
        `${mention}🔔 **Klien siap diskusi proyek!**\n\n` +
        `**Klien:** <@${discordUserId}> — <#${privateChannel.id}>\n\n` +
        `**Ringkasan kebutuhan:**\n${summary}\n\n` +
        `Masuk ke <#${privateChannel.id}> dan ketik \`buat-prd\` setelah scope jelas.`;

      for (let i = 0; i < msg.length; i += 2000) {
        await notifCh.send(msg.slice(i, i + 2000));
      }
    }
  }

  await privateChannel.send(
    "✅ **Tim FreeWANcer sudah dinotifikasi!**\n" +
    "Freelancer akan segera bergabung untuk diskusi lebih detail.\n\n" +
    "_Sambil menunggu, ketik `/ai [pertanyaan]` kalau ada yang ingin ditanyakan._"
  );
}
