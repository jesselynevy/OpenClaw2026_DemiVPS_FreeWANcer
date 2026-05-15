import { qwenpawChat } from "../agent/qwenpaw.js";
import { PRD_GENERATION_PROMPT, PRD_REVISION_PROMPT } from "../agent/prompts.js";
import { getLatestPrd, insertPrd, getPrdRevisionNotes, setProjectPhase } from "../db/database.js";
import { fetchChannelTranscript } from "./chatHistory.js";

const PRD_HEADER = "📋 **Project Requirements Document**";

export function formatPrdPost(content, version) {
  return (
    `${PRD_HEADER} *(v${version})*\n\n` +
    `${content}\n\n` +
    `---\n` +
    `**Review PRD:**\n` +
    `• Freelancer & klien: ketik \`setuju-prd\` jika sudah oke\n` +
    `• Ada perubahan: \`revisi-prd <catatan>\`\n` +
    `• Setelah keduanya setuju → kontrak PDF otomatis dibuat`
  );
}

export async function generatePrdFromChannel(channel, project, { clientName, revisionNotes = [] } = {}) {
  const transcript = await fetchChannelTranscript(channel);
  if (!transcript.trim()) {
    throw new Error("Tidak ada riwayat chat untuk dibuat PRD.");
  }

  // include the latest revision note to reduce token usage
  const latestNote = revisionNotes.length > 0 ? revisionNotes[revisionNotes.length - 1] : "";
  const notesBlock = latestNote ? `\n\nCatatan revisi terbaru: ${latestNote}` : "";

  const content = await qwenpawChat({
    temperature: 0.4,
    messages: [
      { role: "system", content: PRD_GENERATION_PROMPT },
      {
        role: "user",
        content:
          `Buat PRD dari percakapan berikut.\n\n` +
          `Nama proyek: ${project.name}\n` +
          `Klien: ${clientName}\n` +
          `Revisi default: ${project.allowed_revisions ?? 2}\n` +
          notesBlock +
          `\n\n--- RIWAYAT CHAT ---\n${transcript}`,
      },
    ],
  });

  const latest = getLatestPrd(project.id);
  const version = latest ? latest.version + 1 : 1;
  const prd = insertPrd(project.id, version, content);
  setProjectPhase(project.id, "prd_review");

  return { prd, content, version };
}

export async function revisePrd(channel, project, clientName, prdId) {
  const notes = getPrdRevisionNotes(prdId).map((r) => r.note);
  return generatePrdFromChannel(channel, project, { clientName, revisionNotes: notes });
}

export async function askClarification(channel, project, prd, pendingFeedback) {
  const transcript = await fetchChannelTranscript(channel, { limit: 80 });
  return qwenpawChat({
    temperature: 0.5,
    messages: [
      { role: "system", content: PRD_REVISION_PROMPT },
      {
        role: "user",
        content:
          `PRD v${prd.version}:\n${prd.content}\n\n` +
          `Feedback: ${pendingFeedback}\n\n` +
          `Buat pertanyaan klarifikasi untuk freelancer dan klien.\n\n` +
          `Chat:\n${transcript.slice(-6000)}`,
      },
    ],
  });
}
