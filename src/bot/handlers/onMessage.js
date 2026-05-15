import { qwenpawChat } from "../../agent/qwenpaw.js";
import { INTAKE_PROMPT, PROJECT_DISCUSSION_PROMPT } from "../../agent/prompts.js";
import { createPrivateClientChannel, assignClientRoleToMember } from "../../services/channelManager.js";
import {
  getClientByDiscordId,
  getClientByChannelId,
  upsertClient,
  ensureProject,
  getProjectByChannelId,
  getLatestPrd,
  setPrdApproval,
  resetPrdApprovals,
  addPrdRevisionNote,
  setProjectPhase,
} from "../../db/database.js";
import {
  generatePrdFromChannel,
  revisePrd,
  formatPrdPost,
  askClarification,
} from "../../services/prdService.js";

const histories = new Map();
const INTAKE_TRIGGER = "mulai-disini";

function sanitizeChannelName(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .concat("-project");
}

function isFreelancer(message, clientRecord) {
  const staffRoleId = process.env.STAFF_ROLE_ID;
  if (staffRoleId && message.member?.roles.cache.has(staffRoleId)) return true;
  return message.author.id !== clientRecord.discord_user_id;
}

function isClient(message, clientRecord) {
  return message.author.id === clientRecord.discord_user_id;
}

function normalizeCommand(content) {
  return content.trim().toLowerCase();
}

async function sendLong(channel, text, { replyTo } = {}) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 2000) chunks.push(text.slice(i, i + 2000));
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0 && replyTo) await replyTo.reply(chunks[i]);
    else await channel.send(chunks[i]);
  }
}

async function handleIntake(message) {
  const content = normalizeCommand(message.content);
  if (content !== INTAKE_TRIGGER) {
    await message.reply(
      `Halo! Untuk mulai proyek, ketik **\`${INTAKE_TRIGGER}\`** di channel ini. ` +
        `Kamu akan mendapat channel privat untuk diskusi dengan freelancer.`,
    );
    return;
  }

  const existing = getClientByDiscordId(message.author.id);
  if (existing?.private_channel_id) {
    const ch = message.guild.channels.cache.get(existing.private_channel_id);
    const ref = ch ? `<#${ch.id}>` : `channel ID ${existing.private_channel_id}`;
    await message.reply(`Kamu sudah punya channel proyek, lanjutkan di sana: ${ref}`);
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

  const clientRow = upsertClient(message.author.id, privateChannel.id);
  ensureProject(clientRow.id, privateChannel.id, `${message.author.username}-project`);

  await privateChannel.send(
    `Halo <@${message.author.id}>! Selamat datang di FreeWANcer.\n\n` +
      `Channel ini untuk diskusi proyek dengan freelancer. ` +
      `Setelah scope disepakati, freelancer mengetik \`buat-prd\` untuk generate dokumen PRD.\n\n` +
      `**Perintah PRD:**\n` +
      `• \`buat-prd\` — generate PRD (freelancer)\n` +
      `• \`setuju-prd\` — setujui PRD\n` +
      `• \`revisi-prd <catatan>\` — minta perubahan`,
  );

  await message.reply(`Channel proyekmu sudah dibuat: <#${privateChannel.id}>`);

  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    const notifCh = message.guild.channels.cache.get(notifId);
    if (notifCh) {
      await notifCh.send(
        `**Klien baru:** <@${message.author.id}> (${message.author.username})\nChannel: <#${privateChannel.id}>`,
      );
    }
  }
}

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
    const { prd, content, version } = await generatePrdFromChannel(message.channel, project, {
      clientName: clientRecord.discord_user_id,
    });
    await sendLong(message.channel, formatPrdPost(content, version));
    await message.reply(`PRD v${version} sudah dibuat. Silakan review — freelancer & klien ketik \`setuju-prd\` jika setuju.`);
    void prd;
  } catch (err) {
    console.error("PRD generation failed:", err);
    await message.reply("Gagal membuat PRD. Pastikan ada percakapan di channel ini dan API LLM aktif.");
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

  const role = isClient(message, clientRecord) ? "client" : isFreelancer(message, clientRecord) ? "freelancer" : null;
  if (!role) {
    await message.reply("Hanya freelancer atau klien proyek ini yang bisa menyetujui PRD.");
    return;
  }

  const updated = setPrdApproval(prd.id, role);
  const parts = [];

  if (role === "freelancer" && updated.freelancer_approved) parts.push("Freelancer sudah setuju.");
  if (role === "client" && updated.client_approved) parts.push("Klien sudah setuju.");

  if (updated.freelancer_approved && updated.client_approved) {
    setProjectPhase(project.id, "phase3");
    await message.reply(
      `${parts.join(" ")}\n\n**Kedua pihak setuju** — masuk **Fase 3: Eksekusi proyek**. PRD v${updated.version} menjadi acuan kerja.`,
    );
    return;
  }

  const waiting = [];
  if (!updated.freelancer_approved) waiting.push("freelancer (`setuju-prd`)");
  if (!updated.client_approved) waiting.push("klien (`setuju-prd`)");
  await message.reply(`${parts.join(" ")}\nMenunggu persetujuan: ${waiting.join(" dan ")}.`);
}

async function handleRevisiPrd(message, project, clientRecord) {
  const prd = getLatestPrd(project.id);
  if (!prd) {
    await message.reply("Belum ada PRD. Freelancer ketik `buat-prd` dulu.");
    return;
  }

  if (project.phase === "phase3") {
    await message.reply("PRD sudah final (Fase 3). Untuk perubahan besar, buat proyek baru.");
    return;
  }

  const note = message.content.replace(/^revisi-prd\s*/i, "").trim();
  if (!note) {
    await message.reply("Format: `revisi-prd <catatan perubahan>`");
    return;
  }

  addPrdRevisionNote(prd.id, message.author.id, `[${message.author.username}] ${note}`);
  resetPrdApprovals(prd.id);

  const roleLabel = isClient(message, clientRecord) ? "Klien" : "Freelancer";
  await message.reply(`${roleLabel} mengajukan revisi. Catatan dicatat.`);

  if (!isFreelancer(message, clientRecord)) {
    const clarification = await askClarification(message.channel, project, prd, note);
    await sendLong(message.channel, clarification, { replyTo: message });
    await message.channel.send(
      "Setelah klarifikasi selesai, **freelancer** ketik `buat-prd` lagi untuk generate PRD versi baru.",
    );
    return;
  }

  await message.channel.sendTyping();
  try {
    const { content, version } = await revisePrd(message.channel, project, clientRecord.discord_user_id, prd.id);
    await sendLong(message.channel, formatPrdPost(content, version));
    await message.reply(`PRD v${version} diperbarui. Kedua pihak review lagi dengan \`setuju-prd\` atau \`revisi-prd\`.`);
  } catch (err) {
    console.error("PRD revision failed:", err);
    await message.reply("Gagal memperbarui PRD. Coba lagi atau periksa koneksi API.");
  }
}

async function handleProjectChannel(client, message) {
  const clientRecord = getClientByChannelId(message.channelId);
  if (!clientRecord) return;

  let project = getProjectByChannelId(message.channelId);
  if (!project) {
    project = ensureProject(clientRecord.id, message.channelId);
  }

  const cmd = normalizeCommand(message.content);

  if (cmd === "buat-prd") {
    await handleBuatPrd(message, project, clientRecord);
    return;
  }
  if (cmd === "setuju-prd") {
    await handleSetujuPrd(message, project, clientRecord);
    return;
  }
  if (cmd.startsWith("revisi-prd")) {
    await handleRevisiPrd(message, project, clientRecord);
    return;
  }

  if (project.phase === "prd_review" || project.phase === "phase3") {
    return;
  }

  const chId = message.channelId;
  if (!histories.has(chId)) histories.set(chId, []);
  const history = histories.get(chId);
  history.push({ role: "user", content: message.content });
  const trimmed = history.slice(-20);

  let reply;
  try {
    await message.channel.sendTyping();
    reply = await qwenpawChat({
      messages: [{ role: "system", content: PROJECT_DISCUSSION_PROMPT }, ...trimmed],
    });
  } catch (err) {
    console.error("LLM error:", err);
    await message.reply("Maaf, AI sedang tidak bisa diakses. Coba lagi sebentar.");
    return;
  }

  history.push({ role: "assistant", content: reply });
  await sendLong(message.channel, reply, { replyTo: message });
}

export function onMessage(client) {
  return async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const intakeId = process.env.INTAKE_CHANNEL_ID;
    if (intakeId && message.channelId === intakeId) {
      await handleIntake(message);
      return;
    }

    await handleProjectChannel(client, message);
  };
}
