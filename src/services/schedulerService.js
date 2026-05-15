import cron from "node-cron";
import { qwenpawChat } from "../agent/qwenpaw.js";
import { DAILY_BRIEFING_PROMPT, REMINDER_PROMPT } from "../agent/prompts.js";
import {
  getActiveProjectsForSchedule,
  getProjectsNeedingReminder,
  markProjectReminded,
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

function parseDailyCron() {
  const at = process.env.SCHEDULE_DAILY_AT ?? "08:00";
  const m = at.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "0 8 * * *";
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return `${minute} ${hour} * * *`;
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
}
