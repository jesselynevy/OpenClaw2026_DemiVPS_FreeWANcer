import dayjs from "dayjs";
import {
  getPendingTasks,
  markReminderSent,
} from "../services/projectService.js";

export async function processReminders(client) {
  const tasks = getPendingTasks();

  for (const task of tasks) {
    const due = dayjs(task.due_date);
    const hoursLeft = due.diff(dayjs(), "hour");

    if (hoursLeft <= 24 && !task.reminder_sent) {
      const user = await client.users.fetch(
        process.env.FREELANCER_DISCORD_ID
      );

      await user.send(
        `⏰ Deadline Reminder\n\n` +
        `Task: ${task.title}\n` +
        `Deadline: ${task.due_date}\n` +
        `Progress: ${task.progress}%`
      );

      markReminderSent(task.id);
    }
  }
}
