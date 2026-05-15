import { qwenpawChat } from "../agent/qwenpaw.js";
import {
  getContractByProjectId,
  insertInvoice,
  getInvoiceByProjectAndType,
} from "../db/database.js";

const STATIC_VA = process.env.STATIC_VA_NUMBER ?? "7000108979916425";

async function extractTotalPrice(contractContentJson) {
  let data;
  try {
    data = JSON.parse(contractContentJson);
  } catch {
    return null;
  }

  const direct = Number(data.total_harga);
  if (!isNaN(direct) && direct > 0) return direct;

  const priceText = data.harga_dan_pembayaran ?? "";
  if (!priceText) return null;

  try {
    const result = await qwenpawChat({
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Ekstrak total harga proyek dalam Rupiah dari teks berikut. Jawab HANYA angka bulat tanpa simbol, titik, atau koma (contoh: 500000). Jika tidak ditemukan angka yang jelas, jawab 0.",
        },
        { role: "user", content: priceText },
      ],
    });
    const num = parseInt(result.replace(/\D/g, ""), 10);
    return isNaN(num) || num === 0 ? null : num;
  } catch {
    return null;
  }
}

function generateInvoiceNumber(projectId, type) {
  const d = new Date();
  const date =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  return `INV-${date}-${projectId}-${type.toUpperCase()}`;
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

/**
 * Creates DP (50%) or final (50%) invoice with static VA payment info.
 * Returns the invoice row from DB.
 */
export async function createAndSendInvoice(channel, project, clientRecord, type) {
  const existing = getInvoiceByProjectAndType(project.id, type);
  if (existing) return existing;

  const contract = getContractByProjectId(project.id);
  if (!contract) throw new Error("Kontrak belum tersedia untuk proyek ini.");

  const totalPrice = await extractTotalPrice(contract.content_json);
  if (!totalPrice) {
    throw new Error(
      "Tidak bisa mengekstrak harga dari kontrak. Pastikan kontrak mencantumkan total harga.",
    );
  }

  const amount = Math.round(totalPrice * 0.5);
  const invoiceNumber = generateInvoiceNumber(project.id, type);
  const dueDays = Number(process.env.PAYMENT_DUE_DAYS ?? 3);
  const dueDate = addDays(dueDays);

  return insertInvoice({
    projectId: project.id,
    type,
    invoiceNumber,
    amount,
    paymentUrl: `VA: ${STATIC_VA}`,
    dueDate,
  });
}

export function formatInvoiceMessage(invoice, clientDiscordId, type) {
  const label = type === "dp" ? "DP 50%" : "Pelunasan 50%";
  const rp = Number(invoice.amount).toLocaleString("id-ID");
  return [
    `💰 **Invoice ${label}**`,
    `**No. Invoice:** \`${invoice.invoice_number}\``,
    `**Jumlah:** Rp ${rp}`,
    `**Jatuh tempo:** ${invoice.due_date ?? "3 hari dari sekarang"}`,
    ``,
    `🏦 **Pembayaran via Virtual Account**`,
    `**No. Virtual Account:** \`${STATIC_VA}\``,
    `**Jumlah transfer tepat:** Rp ${rp}`,
    `_Transfer ke nomor VA di atas via mobile banking / ATM._`,
    ``,
    `<@${clientDiscordId}> mohon selesaikan pembayaran sebelum jatuh tempo.`,
    `Setelah transfer, freelancer akan memverifikasi dan mengkonfirmasi pembayaran.`,
  ].join("\n");
}
