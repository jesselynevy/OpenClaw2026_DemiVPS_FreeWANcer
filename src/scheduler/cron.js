import cron from "node-cron";
import { getPendingTasks } from "../services/projectService.js";
import { rankTasks } from "./priorityEngine.js";
import { updateDeadlineBoard } from "./deadlineBoard.js";
import { processReminders } from "./reminderService.js";
import { generateDailyBriefing } from "./briefingGenerator.js";

export function startSchedulers(client) {
  // Update deadline board every hour
  cron.schedule("0 * * * *", async () => {
    const tasks = getPendingTasks();

    await updateDeadlineBoard(client, tasks);
  });

  // Daily briefing at 07:00
  cron.schedule("0 7 * * *", async () => {
    const tasks = getPendingTasks();

    const ranked = rankTasks(tasks);

    const briefing =
      generateDailyBriefing(ranked);

    const channel = await client.channels.fetch(
      process.env.BRIEFING_CHANNEL_ID
    );

    await channel.send(briefing);
  });

  // Check reminders every morning
  cron.schedule("0 8 * * *", async () => {
    await processReminders(client);
  });
}
