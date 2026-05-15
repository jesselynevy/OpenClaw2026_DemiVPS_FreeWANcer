/** Fetch channel messages for PRD context (oldest → newest). */
export async function fetchChannelTranscript(channel, { limit = 200 } = {}) {
  const all = [];
  let lastId;

  while (all.length < limit) {
    const fetchOptions = { limit: Math.min(100, limit - all.length) };
    if (lastId) fetchOptions.before = lastId;

    const batch = await channel.messages.fetch(fetchOptions);
    if (batch.size === 0) break;

    all.push(...batch.values());
    lastId = batch.last()?.id;
    if (batch.size < fetchOptions.limit) break;
  }

  all.reverse();

  return all
    .filter((m) => m.content?.trim())
    .filter((m) => !m.author.bot || m.content.includes("Project Requirements Document"))
    .map((m) => {
      const name = m.member?.displayName ?? m.author.username;
      return `[${name}]: ${m.content}`;
    })
    .join("\n");
}
