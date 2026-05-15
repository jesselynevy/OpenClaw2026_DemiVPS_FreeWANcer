import dayjs from "dayjs";
import { createCalendarEvent } from "../services/googleCalendar.js";

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

export async function generateTimeBlocks(tasks) {
  let currentHour = WORK_START_HOUR;

  const today = dayjs().hour(0).minute(0).second(0);

  const blocks = [];

  for (const task of tasks) {
    const remainingHours = Math.max(
      1,
      Math.ceil(
        task.estimated_hours *
          (1 - task.progress / 100)
      )
    );

    for (let i = 0; i < remainingHours; i++) {
      if (currentHour >= WORK_END_HOUR) break;

      const start = today
        .hour(currentHour)
        .minute(0);

      const end = start.add(1, "hour");

      const event = await createCalendarEvent({
        title: `FreeWANcer — ${task.title}`,
        description:
          `Auto-generated focus block\n\n` +
          `Progress: ${task.progress}%\n` +
          `Due: ${task.due_date}`,
        start: start.toISOString(),
        end: end.toISOString(),
      });

      blocks.push({
        taskId: task.id,
        start: start.toISOString(),
        end: end.toISOString(),
        eventId: event.id,
      });

      currentHour++;
    }
  }

  return blocks;
}
