/** Startup log */
export function onReady(client) {
  return () => {
    console.log(`Logged in as ${client.user?.tag ?? "unknown"}`);
  };
}
