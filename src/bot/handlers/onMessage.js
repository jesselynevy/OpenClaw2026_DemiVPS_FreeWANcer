/** Route messages: intake vs. project channel */
export function onMessage(client) {
  return async (message) => {
    if (message.author.bot) return;

    const intakeId = process.env.INTAKE_CHANNEL_ID;
    if (intakeId && message.channelId === intakeId) {
      // TODO: intake flow (new client / triage)
      return;
    }

    // TODO: project-channel flow (existing client work)
    void client;
  };
}
