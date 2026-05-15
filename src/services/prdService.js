import { qwenpawChat } from "../agent/qwenpaw.js";
import { PRD_GENERATION_PROMPT, PRD_REVISION_PROMPT } from "../agent/prompts.js";
import {
  getLatestPrd,
  insertPrd,
  getPrdRevisionNotes,
  setProjectPhase,
} from "../db/database.js";
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
    `• Setelah keduanya setuju → masuk **Fase 3** (eksekusi proyek)`
  );
}

export async function generatePrdFromChannel(channel, project, { clientName, revisionNotes = [] } = {}) {
  const transcript = await fetchChannelTranscript(channel);
  if (!transcript.trim()) {
    throw new Error("Tidak ada riwayat chat untuk dibuat PRD.");
  }

  const notesBlock =
    revisionNotes.length > 0
      ? `\n\nCatatan revisi dari pihak terkait:\n${revisionNotes.map((n) => `- ${n}`).join("\n")}`
      : "";

  const content = await qwenpawChat({
    temperature: 0.4,
    messages: [
      { role: "system", content: PRD_GENERATION_PROMPT },
      {
        role: "user",
        content:
          `Buat PRD dari percakapan berikut.\n\n` +
          `Nama proyek (database): ${project.name}\n` +
          `Klien: ${clientName}\n` +
          `Jumlah revisi default yang diizinkan: ${project.allowed_revisions ?? 2}\n` +
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
  const reply = await qwenpawChat({
    temperature: 0.5,
    messages: [
      { role: "system", content: PRD_REVISION_PROMPT },
      {
        role: "user",
        content:
          `PRD saat ini (v${prd.version}):\n${prd.content}\n\n` +
          `Feedback belum selesai:\n${pendingFeedback}\n\n` +
          `Ringkas pertanyaan klarifikasi untuk freelancer dan klien agar PRD bisa disepakati.\n\n` +
          `Cuplikan chat:\n${transcript.slice(-6000)}`,
      },
    ],
  });
  return reply;
}
