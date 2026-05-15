import { qwenpawChat } from "../../agent/qwenpaw.js";
import {
  INTAKE_PROMPT,
  PROJECT_DISCUSSION_PROMPT,
} from "../../agent/prompts.js";
import {
  createPrivateClientChannel,
  assignClientRoleToMember,
} from "../../services/channelManager.js";
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
  getContractByProjectId,
} from "../../db/database.js";
import {
  generatePrdFromChannel,
  revisePrd,
  formatPrdPost,
  askClarification,
} from "../../services/prdService.js";
import {
  executeHandoff,
  isHandoffTrigger,
  stripHandoffTag,
} from "../../services/handoff.js";
import {
  createAndSendContract,
  processSignatureUpload,
  downloadSignatureImage,
  isImageAttachment,
} from "../../services/contractService.js";
import {
  parseDeadlineInput,
  tryExtractDeadlineFromPrd,
} from "../../services/deadlineParser.js";
import { setProjectDeadline } from "../../db/database.js";
import {
  postDailySchedule,
  postDeadlineReminders,
} from "../../services/schedulerService.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";
import { generatePrdPdf } from "../../services/pdfService.js";

const histories = new Map();
const INTAKE_TRIGGER = "mulai-disini";

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

function hasFreelancerRole(member) {
  const roleId = process.env.FREELANCER_ROLE_ID ?? process.env.STAFF_ROLE_ID;
  if (!roleId || !member) return false;
  return member.roles.cache.has(roleId);
}

function isFreelancer(message, clientRecord) {
  if (hasFreelancerRole(message.member)) return true;
  if (process.env.STAFF_ROLE_ID || process.env.FREELANCER_ROLE_ID) return false;
  return message.author.id !== clientRecord.discord_user_id;
}

function isClient(message, clientRecord) {
  return message.author.id === clientRecord.discord_user_id;
}

function normalizePhase(phase) {
  if (phase === "phase3") return "execution";
  return phase ?? "intake";
}

async function sendLong(channel, text, replyToMsg = null) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 2000)
    chunks.push(text.slice(i, i + 2000));
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0 && replyToMsg) await replyToMsg.reply(chunks[i]);
    else await channel.send(chunks[i]);
  }
}

async function sendPdfAttachment(
  channel,
  content,
  version,
  projectName = "proyek",
) {
  try {
    const pdfBuffer = await generatePrdPdf(content, version, projectName);
    const safeName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 40);
    const attachment = new AttachmentBuilder(pdfBuffer, {
      name: `PRD-v${version}-${safeName}.pdf`,
    });
    await channel.send({
      content: `📎 **PRD v${version} (PDF)**`,
      files: [attachment],
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
  }
}

// ─── Intake (public channel) ───────────────────────────────────────────────────

async function handleIntake(message) {
  const content = message.content.trim().toLowerCase();
  if (content !== INTAKE_TRIGGER) {
    await message.reply(
      `Halo! Ketik **\`${INTAKE_TRIGGER}\`** untuk membuat channel privat proyek.`,
    );
    return;
  }

  const existing = getClientByDiscordId(message.author.id);

  if (existing) {
    const projects = getProjectsByClientId(existing.id);
    const activeProjects = projects.filter((p) =>
      message.guild.channels.cache.has(p.channel_id),
    );

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
          .setStyle(ButtonStyle.Success),
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

  const projectCount = existing ? getProjectsByClientId(existing.id).length : 0;
  const suffix = projectCount > 0 ? `-${projectCount + 1}` : "";
  const channelName = sanitizeChannelName(message.author.username, suffix);

  let privateChannel;
  try {
    privateChannel = await createPrivateClientChannel(
      message.guild,
      message.member,
      channelName,
    );
  } catch (err) {
    console.error("Failed to create private channel:", err);
    await message.reply("Gagal membuat channel. Hubungi admin.");
    return;
  }

  try {
    await assignClientRoleToMember(message.member);
  } catch (err) {
    console.error("Failed to assign Client role:", err);
  }

  const projectName =
    projectCount > 0
      ? `${message.author.username}-project-${projectCount + 1}`
      : `${message.author.username}-project`;

  const clientRow = upsertClient(message.author.id, privateChannel.id);
  ensureProject(clientRow.id, privateChannel.id, projectName);

  await privateChannel.send(
    `Halo <@${message.author.id}>! Selamat datang di **FreeWANcer**.\n\n` +
      `Ceritakan kebutuhan proyekmu. Setelah scope jelas, freelancer ketik \`buat-prd\`.\n\n` +
      `**Alur:** PRD → setuju kedua pihak → kontrak PDF → tanda tangan (upload foto) → mulai kerja.`,
  );
  await message.reply(`Channel proyek dibuat: <#${privateChannel.id}>`);

  const notifId = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (notifId) {
    message.guild.channels.cache
      .get(notifId)
      ?.send(
        `**Klien baru:** <@${message.author.id}> — <#${privateChannel.id}>`,
      );
  }
}

// ─── PRD handlers ──────────────────────────────────────────────────────────────

async function handleBuatPrd(message, project, clientRecord) {
  if (!isFreelancer(message, clientRecord)) {
    await message.reply("Hanya freelancer yang bisa `buat-prd`.");
    return;
  }
  const phase = normalizePhase(project.phase);
  if (phase === "execution" || phase === "contract_signing") {
    await message.reply("PRD sudah disepakati / kontrak sedang berjalan.");
    return;
  }

  await message.channel.sendTyping();
  try {
    const { content, version } = await generatePrdFromChannel(
      message.channel,
      project,
      {
        clientName:
          message.guild.members.cache.get(clientRecord.discord_user_id)
            ?.displayName ?? "Klien",
      },
    );
    await sendLong(message.channel, formatPrdPost(content, version), message);
    await sendPdfAttachment(message.channel, content, version, project.name);
  } catch (err) {
    console.error("PRD generation failed:", err);
    await message.reply("Gagal membuat PRD.");
  }
}

async function handleSetujuPrd(message, project, clientRecord) {
  const prd = getLatestPrd(project.id);
  if (!prd) {
    await message.reply("Belum ada PRD. Ketik `buat-prd` dulu.");
    return;
  }

  const phase = normalizePhase(project.phase);
  if (phase === "execution") {
    await message.reply("Proyek sudah berjalan (kontrak ditandatangani).");
    return;
  }
  if (phase === "contract_signing") {
    await message.reply(
      "PRD sudah disepakati. Selesaikan tanda tangan kontrak (upload foto).",
    );
    return;
  }

  const role = isClient(message, clientRecord)
    ? "client"
    : isFreelancer(message, clientRecord)
      ? "freelancer"
      : null;
  if (!role) {
    await message.reply("Hanya freelancer atau klien proyek ini.");
    return;
  }

  const updated = setPrdApproval(prd.id, role);
  const parts = [];
  if (role === "freelancer") parts.push("Freelancer setuju.");
  if (role === "client") parts.push("Klien setuju.");

  if (!updated.freelancer_approved || !updated.client_approved) {
    const waiting = [];
    if (!updated.freelancer_approved) waiting.push("freelancer");
    if (!updated.client_approved) waiting.push("klien");
    await message.reply(
      `${parts.join(" ")}\nMenunggu: **${waiting.join(" & ")}** (\`setuju-prd\`).`,
    );
    return;
  }

  await message.reply(`${parts.join(" ")}\nMembuat kontrak PDF...`);
  void tryExtractDeadlineFromPrd(project.id, updated.content).then((dl) => {
    if (dl) {
      message.channel.send(
        `📅 Deadline proyek tercatat: **${dl}** (dari PRD).`,
      );
    }
  });
  try {
    await createAndSendContract(
      message.channel,
      project,
      updated,
      clientRecord,
    );
  } catch (err) {
    console.error("Contract generation failed:", err);
    await message.channel.send(
      "PRD disepakati, tapi gagal membuat kontrak PDF. Freelancer hubungi admin atau coba lagi.",
    );
  }
}

async function handleRevisiPrd(message, project, clientRecord) {
  const prd = getLatestPrd(project.id);
  if (!prd) {
    await message.reply("Belum ada PRD.");
    return;
  }
  const phase = normalizePhase(project.phase);
  if (phase === "execution" || phase === "contract_signing") {
    await message.reply("Tidak bisa revisi PRD setelah kontrak dibuat.");
    return;
  }

  const note = message.content.replace(/^revisi-prd\s*/i, "").trim();
  if (!note) {
    await message.reply("Format: `revisi-prd <catatan>`");
    return;
  }

  addPrdRevisionNote(
    prd.id,
    message.author.id,
    `[${message.author.username}] ${note}`,
  );
  resetPrdApprovals(prd.id);

  if (isFreelancer(message, clientRecord)) {
    await message.channel.sendTyping();
    try {
      const { content, version } = await revisePrd(
        message.channel,
        project,
        clientRecord.discord_user_id,
        prd.id,
      );
      await sendLong(message.channel, formatPrdPost(content, version), message);
      await sendPdfAttachment(message.channel, content, version, project.name);
    } catch (err) {
      await message.reply("Gagal memperbarui PRD.");
    }
  } else {
    try {
      const clarification = await askClarification(
        message.channel,
        project,
        prd,
        note,
      );
      await sendLong(message.channel, clarification, message);
      await message.channel.send(
        "Freelancer ketik `buat-prd` untuk versi baru.",
      );
    } catch (err) {
      console.error(err);
    }
  }
}

// ─── Contract signature (image upload) ─────────────────────────────────────────

async function handleContractSignature(message, project, clientRecord) {
  if (!isImageAttachment(message)) {
    await message.reply(
      "Upload **foto tanda tangan** (PNG/JPG) sebagai lampiran pesan di channel ini.",
    );
    return;
  }

  const contract = getContractByProjectId(project.id);
  if (!contract) {
    await message.reply("Kontrak belum tersedia.");
    return;
  }

  let role = null;
  if (isClient(message, clientRecord)) role = "client";
  else if (isFreelancer(message, clientRecord)) role = "freelancer";

  if (!role) {
    await message.reply(
      "Hanya klien atau freelancer proyek ini yang bisa menandatangani.",
    );
    return;
  }

  if (role === "client" && contract.client_signed) {
    await message.reply("Klien sudah mengirim tanda tangan.");
    return;
  }
  if (role === "freelancer" && contract.freelancer_signed) {
    await message.reply("Freelancer sudah mengirim tanda tangan.");
    return;
  }

  try {
    const att = message.attachments.first();
    const sigPath = await downloadSignatureImage(att, project.id, role);
    const result = await processSignatureUpload(
      message.channel,
      project,
      contract,
      role,
      sigPath,
    );
    if (result.message) await message.reply(result.message);
  } catch (err) {
    console.error("Signature processing failed:", err);
    await message.reply(
      "Gagal memproses tanda tangan. Coba upload ulang (PNG/JPG).",
    );
  }
}

// ─── Deadline (private channel) ────────────────────────────────────────────────

async function handleSetDeadline(message, project, clientRecord) {
  if (!isFreelancer(message, clientRecord)) {
    await message.reply(
      "Hanya freelancer yang bisa set deadline (`deadline YYYY-MM-DD`).",
    );
    return;
  }
  const raw = message.content.replace(/^deadline\s*/i, "").trim();
  const date = parseDeadlineInput(raw);
  if (!date) {
    await message.reply(
      "Format: `deadline 2026-05-20` atau `deadline 20/05/2026`",
    );
    return;
  }
  setProjectDeadline(project.id, date);
  await message.reply(
    `Deadline proyek diset: **${date}** (masuk jadwal harian & reminder).`,
  );
}

// ─── Scheduler test commands ───────────────────────────────────────────────────

async function handleSchedulerChannel(client, message) {
  if (!hasFreelancerRole(message.member)) {
    await message.reply("Hanya freelancer.");
    return;
  }
  const cmd = message.content.trim().toLowerCase();
  if (cmd === "test-jadwal") {
    await message.reply("Mengirim jadwal harian...");
    await postDailySchedule(client);
    return true;
  }
  if (cmd === "test-reminder") {
    await message.reply("Mengirim reminder...");
    await postDeadlineReminders(client);
    return true;
  }
  return false;
}

// ─── Private project channel ───────────────────────────────────────────────────

async function handleProjectChannel(client, message) {
  const clientRecord = getClientByChannelId(message.channelId);
  if (!clientRecord) return;

  const project =
    getProjectByChannelId(message.channelId) ??
    ensureProject(clientRecord.id, message.channelId);
  const phase = normalizePhase(project.phase);
  const cmd = message.content.trim().toLowerCase();

  if (cmd === "/handoff") {
    if (!isFreelancer(message, clientRecord)) {
      await message.reply("Hanya freelancer.");
      return;
    }
    if (phase !== "intake") {
      await message.reply(`Proyek sudah di fase **${phase}**.`);
      return;
    }
    const history = histories.get(message.channelId) ?? [];
    await message.reply("Memproses handoff...");
    await executeHandoff({
      guild: message.guild,
      discordUserId: clientRecord.discord_user_id,
      privateChannel: message.channel,
      history,
    });
    return;
  }

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
      await message.reply(
        reply.length <= 2000 ? reply : `${reply.slice(0, 1997)}…`,
      );
    } catch {
      await message.reply("AI tidak tersedia.");
    }
    return;
  }

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
  if (cmd.startsWith("deadline")) {
    await handleSetDeadline(message, project, clientRecord);
    return;
  }

  if (phase === "contract_signing") {
    await handleContractSignature(message, project, clientRecord);
    return;
  }

  if (phase === "execution") {
    return;
  }

  if (phase === "prd_review") {
    if (
      !cmd.startsWith("revisi-prd") &&
      cmd !== "setuju-prd" &&
      cmd !== "buat-prd"
    ) {
      await message.reply(
        "Fase review PRD — gunakan `setuju-prd` atau `revisi-prd <catatan>`.",
      );
    }
    return;
  }

  if (phase === "intake") {
    if (!histories.has(message.channelId)) histories.set(message.channelId, []);
    const history = histories.get(message.channelId);
    history.push({ role: "user", content: message.content });

    let rawReply;
    try {
      await message.channel.sendTyping();
      rawReply = await qwenpawChat({
        messages: [
          { role: "system", content: INTAKE_PROMPT },
          ...history.slice(-20),
        ],
      });
    } catch {
      history.pop();
      await message.reply("AI tidak tersedia.");
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

  if (phase === "discussion") {
    if (!histories.has(message.channelId)) histories.set(message.channelId, []);
    const history = histories.get(message.channelId);
    history.push({ role: "user", content: message.content });

    let reply;
    try {
      await message.channel.sendTyping();
      reply = await qwenpawChat({
        messages: [
          { role: "system", content: PROJECT_DISCUSSION_PROMPT },
          ...history.slice(-20),
        ],
      });
    } catch {
      history.pop();
      await message.reply("AI tidak tersedia.");
      return;
    }

    history.push({ role: "assistant", content: reply });
    if (reply.length <= 2000) await message.reply(reply);
    else await sendLong(message.channel, reply);
  }
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

    const jadwalId = process.env.JADWAL_HARIAN_CHANNEL_ID;
    const reminderId = process.env.REMINDER_CHANNEL_ID;
    if (
      (jadwalId && message.channelId === jadwalId) ||
      (reminderId && message.channelId === reminderId)
    ) {
      const handled = await handleSchedulerChannel(client, message);
      if (handled) return;
    }

    await handleProjectChannel(client, message);
  };
}
