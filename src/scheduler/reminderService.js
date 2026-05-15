import dayjs from "dayjs";

import {
  getPendingTasks,
  updateLastReminder,
} from "../services/projectService.js";

export async function processReminders(client) {
  const tasks = getPendingTasks();

  const channel = await client.channels.fetch(
    process.env.REMINDER_CHANNEL_ID
  );

  for (const task of tasks) {
    const due = dayjs(task.due_date);

    const daysLeft = due.diff(dayjs(), "day");

    let shouldSendReminder = false;

    // Daily reminder when close
    if (daysLeft <= 3) {
      shouldSendReminder = true;
    }

    // Weekly reminder for long deadlines
    else if (daysLeft % 7 === 0) {
      shouldSendReminder = true;
    }

    if (shouldSendReminder) {
      await channel.send(
        `⏰ Deadline Reminder

` +
        `Task: ${task.title}
` +
        `Progress: ${task.progress}%
` +
        `Deadline: ${task.due_date}
` +
        `Remaining: ${daysLeft} days`
      );

      updateLastReminder(task.id);
    }
  }
}
