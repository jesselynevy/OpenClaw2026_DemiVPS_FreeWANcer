import { qwenpawChat } from "../../agent/qwenpaw.js";
import { INTAKE_PROMPT, PROJECT_DISCUSSION_PROMPT } from "../../agent/prompts.js";
import { createPrivateClientChannel, assignClientRoleToMember } from "../../services/channelManager.js";
import {
  getClientByDiscordId,
  getClientByChannelId,
  upsertClient,
  ensureProject,
  getProjectByChannelId,
  getProjectsByClientId,
  getLatestPrd,
  setPrdApproval,
  resetPrdApprovals,
  addPrdRevisionNote,
  setProjectPhase,
} from "../../db/database.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { isHandoffTrigger, stripHandoffTag, executeHandoff } from "../../services/handoff.js";
import { generatePrdFromChannel, revisePrd, formatPrdPost, askClarification } from "../../services/prdService.js";
import { generatePrdPdf } from "../../services/pdfService.js";
import { AttachmentBuilder } from "discord.js";

// In-memory conversation history per channel: channelId → Message[]
const histories = new Map();

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

function isFreelancer(message, clientRecord) {
  const staffRoleId = process.env.STAFF_ROLE_ID;
  if (staffRoleId) return message.member?.roles.cache.has(staffRoleId) ?? false;
  // fallback when STAFF_ROLE_ID not set: anyone who's not the client
  return message.author.id !== clientRecord.discord_user_id;
}

async function sendLong(channel, text, replyToMsg = null) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 2000) chunks.push(text.slice(i, i + 2000));
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0 && replyToMsg) await replyToMsg.reply(chunks[i]);
    else await channel.send(chunks[i]);
  }
}

async function sendPdfAttachment(channel, content, version, projectName = "proyek") {
  try {
    const pdfBuffer = await generatePrdPdf(content, version, projectName);
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40);
    const attachment = new AttachmentBuilder(pdfBuffer, { name: `PRD-v${version}-${safeName}.pdf` });
    await channel.send({ content: `📎 **PRD v${version} (PDF)**`, files: [attachment] });
  } catch (err) {
    console.error("PDF generation failed:", err);
  }
}

// ─── Intake channel: onboard new client ──────────────────────────────────────

async function handleIntake(client, message) {
  const existing = getClientByDiscordId(message.author.id);

  if (existing) {
    const projects = getProjectsByClientId(existing.id);
    const activeProjects = projects.filter((p) => message.guild.channels.cache.has(p.channel_id));

    if (activeProjects.length > 0) {
      const list = activeProjects
        .map((p, i) => `${i + 1}. **${p.name}** → <#${p.channel_id}>`)
        .join("\n");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`continue_${message.author.id}`)
          .setLabel("Lanjut Proyek Lama")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`newproject_${message.author.id}`)
          .setLabel("Mulai Proyek Baru")
          .setStyle(ButtonStyle.Success)
      );

      await message.reply({
        content:
          `Kamu sudah punya proyek aktif:\n${list}\n\n` +
          `Mau lanjut proyek lama atau mulai proyek baru?`,
        components: [row],
      });
      return;
    }
  }

  // New client or no active channels — create first/new project channel
  const projectCount = existing ? getProjectsByClientId(existing.id).length : 0;
  const suffix = projectCount > 0 ? `-${projectCount + 1}` : "";
  const channelName = sanitizeChannelName(message.author.username, suffix);

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

  const projectName = projectCount > 0
    ? `${message.author.username}-project-${projectCount + 1}`
    : `${message.author.username}-project`;

  const clientRow = upsertClient(message.author.id, privateChannel.id);
  ensureProject(clientRow.id, privateChannel.id, projectName);

  await privateChannel.send(
    `Halo <@${message.author.id}>! 👋 Selamat datang di **FreeWANcer**.\n\n` +
    `Channel ini ruang privat untuk diskusi proyekmu.\n` +
    `Ceritakan apa yang kamu butuhkan — jenis pekerjaan, deadline, dan budget kalau ada.`
  );
  await message.reply(`Channel proyekmu sudah dibuat: <#${privateChannel.id}> ✅`);

  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    const notifCh = message.guild.channels.cache.get(notifId);
    notifCh?.send(
      `📥 **Klien baru masuk:** <@${message.author.id}> (${message.author.username})\n` +
      `Channel: <#${privateChannel.id}>`
    );
  }
}

// ─── PRD command handlers ─────────────────────────────────────────────────────

async function handleBuatPrd(message, project, clientRecord) {
  if (!isFreelancer(message, clientRecord)) {
    await message.reply("Hanya freelancer yang bisa mengetik `buat-prd`.");
    return;
  }
  if (project.phase === "phase3") {
    await message.reply("Proyek sudah di Fase 3. PRD sudah disepakati.");
    return;
  }

  await message.channel.sendTyping();
  try {
    const { content, version } = await generatePrdFromChannel(message.channel, project, {
      clientName: clientRecord.discord_user_id,
    });
    setProjectPhase(project.id, "prd_review");
    await sendLong(message.channel, formatPrdPost(content, version), message);
    await sendPdfAttachment(message.channel, content, version, project.name);
  } catch (err) {
    console.error("PRD generation failed:", err);
    await message.reply("Gagal membuat PRD. Pastikan ada percakapan di channel ini dan API aktif.");
  }
}

async function handleSetujuPrd(message, project, clientRecord) {
  const prd = getLatestPrd(project.id);
  if (!prd) {
    await message.reply("Belum ada PRD. Freelancer ketik `buat-prd` dulu.");
    return;
  }
  if (project.phase === "phase3") {
    await message.reply("PRD sudah disepakati (Fase 3).");
    return;
  }

  const role =
    message.author.id === clientRecord.discord_user_id ? "client" :
    isFreelancer(message, clientRecord) ? "freelancer" : null;

  if (!role) {
    await message.reply("Hanya freelancer atau klien proyek ini yang bisa menyetujui PRD.");
    return;
  }

  const updated = setPrdApproval(prd.id, role);
  const parts = [];
  if (role === "freelancer") parts.push("✅ Freelancer setuju.");
  if (role === "client") parts.push("✅ Klien setuju.");

  if (updated.freelancer_approved && updated.client_approved) {
    setProjectPhase(project.id, "phase3");
    await message.reply(
      `${parts.join(" ")}\n\n🎉 **Kedua pihak setuju!** Masuk **Fase 3: Eksekusi Proyek**.\n` +
      `PRD v${updated.version} menjadi acuan kerja.`
    );
    return;
  }

  const waiting = [];
  if (!updated.freelancer_approved) waiting.push("freelancer");
  if (!updated.client_approved) waiting.push("klien");
  await message.reply(
    `${parts.join(" ")}\nMenunggu persetujuan: **${waiting.join(" dan ")}** (ketik \`setuju-prd\`).`
  );
}

async function handleRevisiPrd(message, project, clientRecord) {
  const prd = getLatestPrd(project.id);
  if (!prd) {
    await message.reply("Belum ada PRD. Freelancer ketik `buat-prd` dulu.");
    return;
  }
  if (project.phase === "phase3") {
    await message.reply("PRD sudah final (Fase 3). Untuk perubahan besar, diskusikan dulu.");
    return;
  }

  const note = message.content.replace(/^revisi-prd\s*/i, "").trim();
  if (!note) {
    await message.reply(
      "Format: `revisi-prd <catatan perubahan>`\n" +
      "Contoh: `revisi-prd tambahkan detail format file output PNG 300dpi`"
    );
    return;
  }

  addPrdRevisionNote(prd.id, message.author.id, `[${message.author.username}] ${note}`);
  resetPrdApprovals(prd.id);

  const roleLabel = isFreelancer(message, clientRecord) ? "Freelancer" : "Klien";
  await message.reply(`📝 ${roleLabel} mengajukan revisi. Catatan dicatat.`);

  if (isFreelancer(message, clientRecord)) {
    await message.channel.sendTyping();
    try {
      const { content, version } = await revisePrd(
        message.channel, project, clientRecord.discord_user_id, prd.id
      );
      await sendLong(message.channel, formatPrdPost(content, version), message);
      await sendPdfAttachment(message.channel, content, version, project.name);
    } catch (err) {
      console.error("PRD revision failed:", err);
      await message.reply("Gagal memperbarui PRD. Coba lagi.");
    }
  } else {
    try {
      const clarification = await askClarification(message.channel, project, prd, note);
      await sendLong(message.channel, clarification, message);
      await message.channel.send(
        "Setelah klarifikasi selesai, **freelancer** ketik `buat-prd` untuk generate PRD versi baru."
      );
    } catch (err) {
      console.error("Clarification failed:", err);
    }
  }
}

// ─── Project channel ──────────────────────────────────────────────────────────

async function handleProjectChannel(client, message) {
  const clientRecord = getClientByChannelId(message.channelId);
  if (!clientRecord) return;

  const project =
    getProjectByChannelId(message.channelId) ??
    ensureProject(clientRecord.id, message.channelId);

  const phase = project.phase ?? "intake";
  const cmd = message.content.trim().toLowerCase();

  // ── /handoff — freelancer manually moves intake → discussion ──
  if (cmd === "/handoff") {
    if (!isFreelancer(message, clientRecord)) {
      await message.reply("Hanya freelancer yang bisa mengetik `/handoff`.");
      return;
    }
    if (phase !== "intake") {
      await message.reply(`⚠️ Proyek sudah di fase **${phase}**.`);
      return;
    }
    const history = histories.get(message.channelId) ?? [];
    await message.reply("⏳ Memproses handoff...");
    await executeHandoff({
      guild: message.guild,
      discordUserId: clientRecord.discord_user_id,
      privateChannel: message.channel,
      history,
    });
    return;
  }

  // ── /ai — explicit AI call (works in any phase) ──
  if (message.content.startsWith("/ai ")) {
    const question = message.content.slice(4).trim();
    if (!question) return;
    const history = histories.get(message.channelId) ?? [];
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

  // ── PRD commands (available in discussion + prd_review) ──
  if (cmd === "buat-prd") { await handleBuatPrd(message, project, clientRecord); return; }
  if (cmd === "setuju-prd") { await handleSetujuPrd(message, project, clientRecord); return; }
  if (cmd.startsWith("revisi-prd")) { await handleRevisiPrd(message, project, clientRecord); return; }

  // ── phase3 / prd_review: AI silent for non-commands ──
  if (phase === "prd_review" || phase === "phase3") return;

  // ── intake: AI receptionist, detect handoff ──
  if (phase === "intake") {
    if (!histories.has(message.channelId)) histories.set(message.channelId, []);
    const history = histories.get(message.channelId);
    history.push({ role: "user", content: message.content });

    let rawReply;
    try {
      await message.channel.sendTyping();
      rawReply = await qwenpawChat({
        messages: [{ role: "system", content: INTAKE_PROMPT }, ...history.slice(-20)],
      });
    } catch (err) {
      console.error("QwenPaw error:", err);
      history.pop();
      await message.reply("Maaf, AI sedang tidak bisa diakses. Coba lagi sebentar ya. 🙏");
      return;
    }

    const doHandoff = isHandoffTrigger(rawReply);
    const visibleReply = stripHandoffTag(rawReply);
    history.push({ role: "assistant", content: visibleReply });

    if (visibleReply.length <= 2000) await message.reply(visibleReply);
    else await sendLong(message.channel, visibleReply);

    if (doHandoff) {
      await executeHandoff({
        guild: message.guild,
        discordUserId: clientRecord.discord_user_id,
        privateChannel: message.channel,
        history,
      });
    }
    return;
  }

  // ── discussion: AI assists both parties ──
  if (!histories.has(message.channelId)) histories.set(message.channelId, []);
  const history = histories.get(message.channelId);
  history.push({ role: "user", content: message.content });

  let reply;
  try {
    await message.channel.sendTyping();
    reply = await qwenpawChat({
      messages: [{ role: "system", content: PROJECT_DISCUSSION_PROMPT }, ...history.slice(-20)],
    });
  } catch (err) {
    console.error("QwenPaw error:", err);
    history.pop();
    await message.reply("Maaf, AI sedang tidak bisa diakses. Coba lagi sebentar ya. 🙏");
    return;
  }

  history.push({ role: "assistant", content: reply });
  if (reply.length <= 2000) await message.reply(reply);
  else await sendLong(message.channel, reply);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function onMessage(client) {
  return async (message) => {
    console.log(`[msg] author=${message.author.tag} channel=${message.channelId} content="${message.content.slice(0, 50)}"`);
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
