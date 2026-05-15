/** Calls QwenPaw API (OpenAI-compatible) */
export async function qwenpawChat({ messages, temperature = 0.7 } = {}) {
  const base = process.env.QWENPAW_BASE_URL?.replace(/\/$/, "");
  const key = process.env.QWENPAW_API_KEY;
  const model = process.env.QWENPAW_MODEL;
  if (!base || !key || !model) {
    throw new Error("Missing QWENPAW_BASE_URL, QWENPAW_API_KEY, or QWENPAW_MODEL");
  }

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QwenPaw error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
