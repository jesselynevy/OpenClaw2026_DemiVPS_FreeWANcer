import { qwenpawChat } from "../agent/qwenpaw.js";
import { setProjectDeadline } from "../db/database.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDeadlineInput(input) {
  const s = input.trim();
  if (ISO_DATE.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

export async function tryExtractDeadlineFromPrd(projectId, prdContent) {
  try {
    const raw = await qwenpawChat({
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            'Ambil deadline proyek terakhir dari PRD/kontrak. Balas HANYA JSON: {"deadline":"YYYY-MM-DD"} atau {"deadline":null}',
        },
        { role: "user", content: prdContent.slice(0, 8000) },
      ],
    });
    const json = JSON.parse(raw.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, ""));
    if (json.deadline && ISO_DATE.test(json.deadline)) {
      setProjectDeadline(projectId, json.deadline);
      return json.deadline;
    }
  } catch (err) {
    console.error("Deadline extract failed:", err.message);
  }
  return null;
}
