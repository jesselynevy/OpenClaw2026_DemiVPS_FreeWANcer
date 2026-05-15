import { startScheduler } from "../../services/schedulerService.js";

/** Startup log + cron scheduler */
export function onReady(client) {
  return () => {
    console.log(`Logged in as ${client.user?.tag ?? "unknown"}`);
    startScheduler(client);
  };
}
