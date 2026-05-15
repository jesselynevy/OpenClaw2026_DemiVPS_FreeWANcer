import { qwenpawChat } from "../agent/qwenpaw.js";
import { PRD_GENERATION_PROMPT, PRD_REVISION_PROMPT } from "../agent/prompts.js";
import { insertPrd, getLatestPrd, getPrdRevisionNotes } from "../db/database.js";

const SKIP_COMMANDS = new Set(["buat-prd", "setuju-prd", "/handoff"]);

async function fetchConversationHistory(channel, limit = 100) {
  const fetched = await channel.messages.fetch({ limit });
  return [...fetched.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .filter((m) => {
      if (!m.content) return false;
      const lower = m.content.trim().toLowerCase();
      return !SKIP_COMMANDS.has(lower);
    })
    .map((m) => ({
      role: m.author.bot ? "assistant" : "user",
      content: m.author.bot
        ? m.content.slice(0, 600)
        : `[${m.author.username}]: ${m.content}`,
    }));
}

export async function generatePrdFromChannel(channel, project, { clientName } = {}) {
  const history = await fetchConversationHistory(channel);
  const latest = getLatestPrd(project.id);
  const version = latest ? latest.version + 1 : 1;

  const content = await qwenpawChat({
    messages: [
      { role: "system", content: PRD_GENERATION_PROMPT },
      ...history.slice(-40),
      {
        role: "user",
        content: `Buat PRD v${version} berdasarkan seluruh percakapan di atas. Klien: ${clientName ?? "unknown"}.`,
      },
    ],
    temperature: 0.3,
  });

  const prd = insertPrd(project.id, version, content);
  return { prd, content, version };
}

export async function revisePrd(channel, project, clientDiscordId, prdId) {
  const notes = getPrdRevisionNotes(prdId);
  const history = await fetchConversationHistory(channel);
  const latest = getLatestPrd(project.id);
  const version = (latest?.version ?? 0) + 1;

  const notesSummary = notes.map((n) => `- ${n.note}`).join("\n");

  const content = await qwenpawChat({
    messages: [
      { role: "system", content: PRD_GENERATION_PROMPT },
      ...history.slice(-40),
      {
        role: "user",
        content: `Revisi PRD berdasarkan catatan berikut:\n${notesSummary}\n\nBuat PRD v${version} yang sudah diperbaiki.`,
      },
    ],
    temperature: 0.3,
  });

  const prd = insertPrd(project.id, version, content);
  return { prd, content, version };
}

export function formatPrdPost(content, version) {
  return (
    `📄 **PRD v${version}**\n\n${content}\n\n` +
    `---\n` +
    `✅ \`setuju-prd\` — setujui dokumen ini\n` +
    `✏️ \`revisi-prd <catatan>\` — minta perubahan spesifik\n` +
    `🔄 \`buat-prd\` — generate ulang (freelancer)`
  );
}

export async function askClarification(channel, project, prd, revisionNote) {
  const history = await fetchConversationHistory(channel, 50);

  return qwenpawChat({
    messages: [
      { role: "system", content: PRD_REVISION_PROMPT },
      ...history.slice(-20),
      {
        role: "user",
        content: `Catatan revisi yang diajukan: "${revisionNote}"\n\nBuat pertanyaan klarifikasi untuk menyelesaikan ketidaksepakatan ini.`,
      },
    ],
    temperature: 0.5,
  });
}
