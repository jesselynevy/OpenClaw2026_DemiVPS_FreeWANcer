import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createPrivateClientChannel, assignClientRoleToMember } from "../../services/channelManager.js";
import {
  getClientByDiscordId,
  upsertClient,
  ensureProject,
  getProjectsByClientId,
} from "../../db/database.js";

export function onInteraction(client) {
  return async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user, guild, member } = interaction;

    // ── Lanjut proyek lama ────────────────────────────────────────────────────
    if (customId === `continue_${user.id}`) {
      const clientRecord = getClientByDiscordId(user.id);
      if (!clientRecord) {
        await interaction.reply({ content: "Data tidak ditemukan. Coba kirim pesan di mulai-disini lagi.", ephemeral: true });
        return;
      }

      const projects = getProjectsByClientId(clientRecord.id);
      const active = projects.filter((p) => guild.channels.cache.has(p.channel_id));

      if (active.length === 0) {
        await interaction.reply({ content: "Tidak ada channel proyek aktif. Silakan mulai proyek baru.", ephemeral: true });
        return;
      }

      const list = active.map((p, i) => `${i + 1}. **${p.name}** → <#${p.channel_id}>`).join("\n");
      await interaction.reply({ content: `Proyek aktifmu:\n${list}`, ephemeral: true });
      return;
    }

    // ── Mulai proyek baru ─────────────────────────────────────────────────────
    if (customId === `newproject_${user.id}`) {
      await interaction.deferReply({ ephemeral: true });

      const clientRecord = getClientByDiscordId(user.id);
      if (!clientRecord) {
        await interaction.editReply("Data tidak ditemukan. Coba kirim pesan di mulai-disini lagi.");
        return;
      }

      const existingProjects = getProjectsByClientId(clientRecord.id);
      const count = existingProjects.length;
      const suffix = count > 0 ? `-${count + 1}` : "";
      const channelName = sanitizeChannelName(user.username, suffix);

      let newChannel;
      try {
        newChannel = await createPrivateClientChannel(guild, member, channelName);
      } catch (err) {
        console.error("Failed to create project channel:", err);
        await interaction.editReply("Gagal membuat channel baru. Hubungi admin.");
        return;
      }

      upsertClient(user.id, newChannel.id);
      ensureProject(clientRecord.id, newChannel.id, `${user.username}-project-${count + 1}`);

      await newChannel.send(
        `Halo <@${user.id}>! 👋 Ini channel proyek baru kamu.\n\n` +
        `Ceritakan apa yang kamu butuhkan — jenis pekerjaan, deadline, dan budget kalau ada.`
      );

      await interaction.editReply(`Channel proyek baru sudah dibuat: <#${newChannel.id}> ✅`);

      const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
      if (notifId) {
        const notifCh = guild.channels.cache.get(notifId);
        notifCh?.send(
          `📥 **Proyek baru dari klien existing:** <@${user.id}> (${user.username})\n` +
          `Channel: <#${newChannel.id}>`
        );
      }
      return;
    }
  };
}

function sanitizeChannelName(username, suffix = "") {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)
    .concat("-project")
    .concat(suffix);
}
