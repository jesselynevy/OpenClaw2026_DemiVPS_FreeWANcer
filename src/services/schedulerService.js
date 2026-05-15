import cron from "node-cron";
import { qwenpawChat } from "../agent/qwenpaw.js";
import { DAILY_BRIEFING_PROMPT, REMINDER_PROMPT } from "../agent/prompts.js";
import {
  getActiveProjectsForSchedule,
  getProjectsNeedingReminder,
  markProjectReminded,
  getPendingInvoices,
  markInvoiceReminded,
} from "../db/database.js";

const PHASE_LABEL = {
  intake: "Intake",
  discussion: "Diskusi",
  prd_review: "Review PRD",
  contract_signing: "Tanda tangan kontrak",
  execution: "Eksekusi",
  phase3: "Eksekusi",
};

function freelancerMention() {
  const roleId = process.env.FREELANCER_ROLE_ID ?? process.env.STAFF_ROLE_ID;
  return roleId ? `<@&${roleId}>` : "";
}

function formatProjectLine(p) {
  const dl = p.deadline_at ?? "TBD";
  const phase = PHASE_LABEL[p.phase] ?? p.phase;
  return (
    `- **${p.name}** | fase: ${phase} | deadline: **${dl}** | channel: <#${p.channel_id}> | klien: <@${p.client_discord_id}>`
  );
}

function daysUntil(deadlineAt) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(`${deadlineAt}T00:00:00`);
  return Math.round((dl - today) / 86400000);
}

async function sendLong(channel, text, prefix = "") {
  const body = prefix ? `${prefix}\n\n${text}` : text;
  for (let i = 0; i < body.length; i += 2000) {
    await channel.send(body.slice(i, i + 2000));
  }
}

function buildProjectListText(projects) {
  if (projects.length === 0) {
    return "Tidak ada proyek aktif saat ini.";
  }
  return projects.map(formatProjectLine).join("\n");
}

export async function postDailySchedule(client) {
  const channelId = process.env.JADWAL_HARIAN_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    console.error("jadwal-harian: channel not found or not text");
    return;
  }

  const projects = getActiveProjectsForSchedule();
  const listText = buildProjectListText(projects);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let body;
  try {
    body = await qwenpawChat({
      temperature: 0.4,
      messages: [
        { role: "system", content: DAILY_BRIEFING_PROMPT },
        {
          role: "user",
          content: `Tanggal: ${today}\n\nDaftar proyek aktif:\n${listText}\n\nBuat jadwal harian freelancer.`,
        },
      ],
    });
  } catch (err) {
    console.error("Daily schedule LLM failed:", err);
    body =
      `## Jadwal Hari Ini — ${today}\n\n` +
      `**Ringkasan deadline proyek:**\n${listText}\n\n` +
      `_AI tidak tersedia — gunakan daftar di atas._`;
  }

  const mention = freelancerMention();
  await sendLong(channel, body, mention ? `${mention} **Jadwal harian**` : "**Jadwal harian**");
  console.log("[scheduler] Daily schedule posted");
}

/**
 * Called immediately when a new project is created.
 * Posts a new-project ping to jadwal channel, then reposts the full daily schedule.
 */
export async function postNewProjectAlert(client, { clientDiscordId, channelId, projectName }) {
  const jadwalId = process.env.JADWAL_HARIAN_CHANNEL_ID;
  if (!jadwalId) return;

  const channel = await client.channels.fetch(jadwalId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const mention = freelancerMention();
  await channel.send(
    `${mention ? mention + " " : ""}📋 **Proyek baru masuk!**\n` +
    `**Proyek:** ${projectName}\n` +
    `**Klien:** <@${clientDiscordId}> → <#${channelId}>\n\n` +
    `Jadwal harian diperbarui di bawah:`,
  ).catch(console.error);

  await postDailySchedule(client);
}

export async function postDeadlineReminders(client) {
  const channelId = process.env.REMINDER_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    console.error("reminder: channel not found or not text");
    return;
  }

  const withinDays = Number(process.env.REMINDER_DAYS_BEFORE ?? 3);
  const projects = getProjectsNeedingReminder(withinDays);
  if (projects.length === 0) {
    console.log("[scheduler] No reminders due");
    return;
  }

  const lines = projects.map((p) => {
    const d = daysUntil(p.deadline_at);
    let urgency = "🟡";
    if (d < 0) urgency = "🔴 TERLAMBAT";
    else if (d <= 1) urgency = "🔴";
    else if (d <= 3) urgency = "🟠";
    const label = d < 0 ? `${Math.abs(d)} hari terlambat` : d === 0 ? "hari ini" : `${d} hari lagi`;
    return `${urgency} **${p.name}** — deadline **${p.deadline_at}** (${label}) → <#${p.channel_id}>`;
  });

  let body;
  try {
    body = await qwenpawChat({
      temperature: 0.3,
      messages: [
        { role: "system", content: REMINDER_PROMPT },
        {
          role: "user",
          content: `Proyek yang perlu perhatian:\n${lines.join("\n")}\n\nBuat pengingat singkat untuk freelancer.`,
        },
      ],
    });
  } catch {
    body = `⏰ **Pengingat deadline**\n\n${lines.join("\n")}`;
  }

  const mention = freelancerMention();
  await sendLong(channel, body, mention ? `${mention} **Reminder**` : "**Reminder**");

  for (const p of projects) {
    markProjectReminded(p.id);
  }
  console.log(`[scheduler] Reminders posted (${projects.length} projects)`);
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / 86400000);
}

function daysPastDue(dueDateStr) {
  if (!dueDateStr) return 0;
  const due = new Date(`${dueDateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - due) / 86400000));
}

async function buildFollowUpText(invoice, daysLate, isUrgent) {
  const rp = Number(invoice.amount).toLocaleString("id-ID");
  const label = invoice.type === "dp" ? "DP 50%" : "Pelunasan 50%";
  const context =
    `Invoice: #${invoice.invoice_number}\nJumlah: Rp ${rp} (${label})\n` +
    `Jatuh tempo: ${invoice.due_date}\nTerlambat: ${daysLate} hari`;

  try {
    return await qwenpawChat({
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: isUrgent
            ? "Kamu adalah asisten penagihan yang tegas tapi sopan untuk layanan freelance. Tulis follow-up singkat (2-3 kalimat) dalam Bahasa Indonesia mengingatkan klien bahwa pembayaran sudah terlambat dan minta segera diselesaikan. Sertakan opsi menghubungi freelancer jika ada kendala."
            : "Kamu adalah asisten penagihan yang ramah untuk layanan freelance. Tulis pengingat singkat (2-3 kalimat) dalam Bahasa Indonesia bahwa invoice akan jatuh tempo dan mohon segera dibayar.",
        },
        { role: "user", content: context },
      ],
    });
  } catch {
    const rp2 = Number(invoice.amount).toLocaleString("id-ID");
    const lbl = invoice.type === "dp" ? "DP 50%" : "Pelunasan 50%";
    return isUrgent
      ? `Hai, invoice **#${invoice.invoice_number}** (${lbl}, Rp ${rp2}) sudah terlambat **${daysLate} hari**. Mohon segera selesaikan pembayaran atau hubungi freelancer.`
      : `Pengingat: invoice **#${invoice.invoice_number}** (${lbl}, Rp ${rp2}) jatuh tempo **${invoice.due_date}**. Mohon segera dibayar.`;
  }
}

export async function pollAndNotifyPayments(client) {
  const invoices = getPendingInvoices();
  if (invoices.length === 0) return;

  const notifChannelId = process.env.NOTIFICATIONS_CHANNEL_ID;
  const va = process.env.STATIC_VA_NUMBER ?? "7000108979916425";

  for (const inv of invoices) {
    const daysCreated = daysSince(inv.created_at);
    const daysLate = daysPastDue(inv.due_date);
    const lastReminded = inv.last_reminder_at ? daysSince(inv.last_reminder_at) : 999;

    // Day 1: first reminder, Day 3: follow-up, past due: daily
    const shouldRemind =
      (daysCreated >= 1 && inv.reminder_count === 0) ||
      (daysCreated >= 3 && inv.reminder_count === 1) ||
      (daysLate > 0 && lastReminded >= 1);

    if (!shouldRemind) continue;

    const isUrgent = daysCreated >= 3 || daysLate > 0;
    const channel = await client.channels.fetch(inv.channel_id).catch(() => null);
    if (!channel?.isTextBased()) continue;

    const followUpText = await buildFollowUpText(inv, daysLate, isUrgent);
    await channel.send(
      `⏰ <@${inv.client_discord_id}> ${followUpText}\n\n🏦 **Virtual Account:** \`${va}\``,
    ).catch(console.error);

    if (daysLate > 0 && notifChannelId) {
      const notifCh = await client.channels.fetch(notifChannelId).catch(() => null);
      notifCh?.send(
        `🚨 Invoice \`${inv.invoice_number}\` proyek **${inv.project_name}** terlambat **${daysLate} hari** — verifikasi manual diperlukan. <#${inv.channel_id}>`,
      ).catch(console.error);
    }

    markInvoiceReminded(inv.id);
  }
}

function parseDailyCron() {
  // Full cron expression takes priority, e.g. "0 8,14,19 * * *" for 3x a day
  if (process.env.SCHEDULE_DAILY_CRON) return process.env.SCHEDULE_DAILY_CRON;
  // Simple HH:MM format (single time)
  const at = process.env.SCHEDULE_DAILY_AT ?? "08:00";
  const m = at.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "0 8 * * *";
  return `${Number(m[2])} ${Number(m[1])} * * *`;
}

export function startScheduler(client) {
  const tz = process.env.SCHEDULE_TZ ?? "Asia/Jakarta";
  const dailyCron = parseDailyCron();
  const reminderCron = process.env.SCHEDULE_REMINDER_CRON ?? "0 9,15 * * *";

  if (!process.env.JADWAL_HARIAN_CHANNEL_ID && !process.env.REMINDER_CHANNEL_ID) {
    console.warn("[scheduler] JADWAL_HARIAN_CHANNEL_ID / REMINDER_CHANNEL_ID not set — scheduler off");
    return;
  }

  if (process.env.JADWAL_HARIAN_CHANNEL_ID) {
    cron.schedule(dailyCron, () => postDailySchedule(client), { timezone: tz });
    console.log(`[scheduler] Daily jadwal: ${dailyCron} (${tz})`);
  }

  if (process.env.REMINDER_CHANNEL_ID) {
    cron.schedule(reminderCron, () => postDeadlineReminders(client), { timezone: tz });
    console.log(`[scheduler] Reminders: ${reminderCron} (${tz})`);
  }

  // Payment polling: every 2 hours
  const paymentPollCron = process.env.SCHEDULE_PAYMENT_POLL_CRON ?? "0 */2 * * *";
  cron.schedule(paymentPollCron, () => pollAndNotifyPayments(client), { timezone: tz });
  console.log(`[scheduler] Payment poll: ${paymentPollCron} (${tz})`);
}
