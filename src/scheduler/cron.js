import cron from "node-cron";

import { getPendingTasks } from "../services/projectService.js";
import { rankTasks } from "./priorityEngine.js";
import { generateTimeBlocks } from "./timeBlocker.js";
import { generateDailyBriefing } from "./briefingGenerator.js";
import { processReminders } from "./reminderService.js";

export function startSchedulers(client) {
  // Daily briefing at 07:00 WIB
  cron.schedule("0 7 * * *", async () => {
    const tasks = getPendingTasks();

    const ranked = rankTasks(tasks);

    await generateTimeBlocks(ranked);

    const briefing = generateDailyBriefing(ranked);

    const user = await client.users.fetch(
      process.env.FREELANCER_DISCORD_ID
    );

    await user.send(briefing);
  });

  // Reminder check every hour
  cron.schedule("0 * * * *", async () => {
    await processReminders(client);
  });
}
