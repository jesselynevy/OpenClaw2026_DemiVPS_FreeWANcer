/** Transcript cache: projectId → {transcript, timestamp} */
const transcriptCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Fetch channel messages for PRD context (oldest → newest). */
export async function fetchChannelTranscript(channel, { limit = 80, skipCache = false } = {}) {
  const projectId = channel.id;
  const cached = transcriptCache.get(projectId);
  
  if (cached && !skipCache && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.transcript;
  }
  
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

  const transcript = all
    .filter((m) => m.content?.trim())
    .filter((m) => !m.author.bot || m.content.includes("Project Requirements Document"))
    .map((m) => {
      const name = m.member?.displayName ?? m.author.username;
      return `[${name}]: ${m.content}`;
    })
    .join("\n");
    
  transcriptCache.set(projectId, { transcript, timestamp: Date.now() });
  return transcript;
}

export function clearTranscriptCache(channelId) {
  transcriptCache.delete(channelId);
}
