import { completeTask } from "../services/projectService.js";

export async function handleCompleteTask(
  message,
  args
) {
  const [taskId] = args;

  completeTask(taskId);

  await message.reply(
    `✅ Task ${taskId} completed`
  );
}
