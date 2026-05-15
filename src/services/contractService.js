import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AttachmentBuilder } from "discord.js";
import { qwenpawChat } from "../agent/qwenpaw.js";
import { CONTRACT_GENERATION_PROMPT } from "../agent/prompts.js";
import {
  getContractByProjectId,
  insertContract,
  setContractSignature,
  setContractSignedPdf,
  setProjectPhase,
} from "../db/database.js";

const CONTRACTS_DIR = "./data/contracts";

function contractsDir(projectId) {
  const dir = path.join(CONTRACTS_DIR, String(projectId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseContractJson(raw) {
  const trimmed = raw.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    return {
      nama_proyek: "Proyek FreeWANcer",
      nama_klien: "Klien",
      nama_freelancer: "Freelancer FreeWANcer",
      scope_of_work: trimmed.slice(0, 2000),
      harga_dan_pembayaran: "Menyesuaikan kesepakatan di PRD.",
      batas_revisi: "Menyesuaikan PRD.",
      deadline_dan_penalti: "Menyesuaikan PRD.",
      hak_cipta: "Hak cipta mengikuti kesepakatan standar FreeWANcer setelah pelunasan penuh.",
    };
  }
}

async function generateContractContent(prd, { clientTag, freelancerName }) {
  const raw = await qwenpawChat({
    temperature: 0.3,
    timeoutMs: 90000,
    messages: [
      { role: "system", content: CONTRACT_GENERATION_PROMPT },
      {
        role: "user",
        content:
          `PRD yang disepakati:\n\n${prd.content}\n\n` +
          `Klien (Discord): ${clientTag}\n` +
          `Freelancer: ${freelancerName ?? "FreeWANcer"}`,
      },
    ],
  });
  return parseContractJson(raw);
}

function wrapText(text, maxChars = 88) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > maxChars) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = line ? `${line} ${w}` : w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function buildContractPdf(data) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const maxWidth = 495;
  let y = 800;

  const drawLine = (text, opts = {}) => {
    const size = opts.size ?? 11;
    const f = opts.bold ? bold : font;
    const lines = wrapText(text, 85);
    for (const line of lines) {
      if (y < 80) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 6;
    }
  };

  drawLine("KONTRAK KERJA FREELANCE", { size: 16, bold: true });
  y -= 8;
  drawLine(`Proyek: ${data.nama_proyek}`);
  drawLine(`Klien: ${data.nama_klien}`);
  drawLine(`Freelancer: ${data.nama_freelancer}`);
  drawLine(`Tanggal: ${new Date().toLocaleDateString("id-ID")}`);
  y -= 12;

  const sections = [
    ["1. RUANG LINGKUP PEKERJAAN (SCOPE OF WORK)", data.scope_of_work],
    ["2. HARGA & METODE PEMBAYARAN", data.harga_dan_pembayaran],
    ["3. BATAS REVISI", data.batas_revisi],
    ["4. DEADLINE & PENALTI", data.deadline_dan_penalti],
    ["5. HAK CIPTA", data.hak_cipta],
  ];

  for (const [title, body] of sections) {
    drawLine(title, { bold: true, size: 12 });
    drawLine(body);
    y -= 10;
  }

  y -= 20;
  drawLine("TANDA TANGAN", { bold: true, size: 12 });
  drawLine("Klien: _________________________    Freelancer: _________________________");
  drawLine("(Tanda tangan digital dilampirkan pada versi final setelah upload di Discord)");

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function embedSignaturesOnPdf(draftPath, freelancerSigPath, clientSigPath, outPath) {
  const existing = fs.readFileSync(draftPath);
  const pdf = await PDFDocument.load(existing);
  const pages = pdf.getPages();
  const lastPage = pages[pages.length - 1];
  const { height } = lastPage.getSize();

  const embedSig = async (filePath, x) => {
    const bytes = fs.readFileSync(filePath);
    let img;
    try {
      img = await pdf.embedPng(bytes);
    } catch {
      img = await pdf.embedJpg(bytes);
    }
    const maxW = 140;
    const scale = maxW / img.width;
    const w = img.width * scale;
    const h = img.height * scale;
    lastPage.drawImage(img, { x, y: 60, width: w, height: h });
    lastPage.drawText("Tanda tangan", { x, y: 48, size: 8 });
  };

  await embedSig(clientSigPath, 55);
  await embedSig(freelancerSigPath, 310);

  const signed = await pdf.save();
  fs.writeFileSync(outPath, signed);
  return outPath;
}

export async function createAndSendContract(channel, project, prd, clientRecord) {
  const existing = getContractByProjectId(project.id);
  if (existing) {
    return { contract: existing, skipped: true };
  }

  const clientUser = await channel.client.users.fetch(clientRecord.discord_user_id).catch(() => null);
  const clientTag = clientUser?.username ?? clientRecord.discord_user_id;

  const content = await generateContractContent(prd, {
    clientTag,
    freelancerName: "Freelancer FreeWANcer",
  });

  const pdfBuffer = await buildContractPdf(content);
  const dir = contractsDir(project.id);
  const draftPath = path.join(dir, "contract-draft.pdf");
  fs.writeFileSync(draftPath, pdfBuffer);

  const contract = insertContract(project.id, prd.id, JSON.stringify(content), draftPath);
  setProjectPhase(project.id, "contract_signing");

  const attachment = new AttachmentBuilder(pdfBuffer, { name: `kontrak-${project.name}.pdf` });

  await channel.send({
    content:
      `📑 **Kontrak kerja** telah dibuat berdasarkan PRD v${prd.version}.\n\n` +
      `**Tanda tangan digital:**\n` +
      `• **Klien** (<@${clientRecord.discord_user_id}>): upload **foto tanda tangan** di channel ini\n` +
      `• **Freelancer** (role staff): upload **foto tanda tangan** di channel ini\n\n` +
      `Setelah keduanya upload, bot akan melampirkan tanda tangan ke PDF dan pekerjaan resmi dimulai.`,
    files: [attachment],
  });

  return { contract, skipped: false };
}

export async function downloadSignatureImage(attachment, projectId, role) {
  const dir = path.join(contractsDir(projectId), "signatures");
  fs.mkdirSync(dir, { recursive: true });
  const ext = attachment.name?.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? "png";
  const dest = path.join(dir, `${role}.${ext}`);

  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error(`Gagal unduh gambar: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

export async function processSignatureUpload(channel, project, contract, role, signaturePath) {
  const updated = setContractSignature(contract.id, role, signaturePath);

  const labels = [];
  if (updated.client_signed) labels.push("klien");
  if (updated.freelancer_signed) labels.push("freelancer");

  if (!updated.client_signed || !updated.freelancer_signed) {
    const waiting = [];
    if (!updated.client_signed) waiting.push("klien (upload foto tanda tangan)");
    if (!updated.freelancer_signed) waiting.push("freelancer (upload foto tanda tangan)");
    return {
      done: false,
      message: `✅ Tanda tangan **${role === "client" ? "klien" : "freelancer"}** diterima.\nMenunggu: **${waiting.join("** dan **")}**.`,
    };
  }

  const signedPath = path.join(contractsDir(project.id), "contract-signed.pdf");
  await embedSignaturesOnPdf(
    updated.draft_pdf_path,
    updated.freelancer_signature_path,
    updated.client_signature_path,
    signedPath,
  );
  setContractSignedPdf(contract.id, signedPath);
  setProjectPhase(project.id, "execution");

  const signedBuf = fs.readFileSync(signedPath);
  const attachment = new AttachmentBuilder(signedBuf, { name: `kontrak-ditandatangani-${project.name}.pdf` });

  await channel.send({
    content:
      `🎉 **Kontrak lengkap ditandatangani kedua pihak!**\n\n` +
      `Pekerjaan freelance resmi **dimulai** (fase eksekusi). PRD & kontrak ini menjadi acuan kerja.`,
    files: [attachment],
  });

  return { done: true, message: null };
}

export function isImageAttachment(message) {
  const att = message.attachments.first();
  if (!att) return false;
  return att.contentType?.startsWith("image/") ?? /\.(png|jpe?g|webp|gif)$/i.test(att.name ?? "");
}
