import { createTask } from "../services/projectService.js";

export async function handleCreateTask(
  message,
  args
) {
  const [
    projectId,
    title,
    dueDate,
    estimatedHours,
  ] = args;

  const task = createTask({
    projectId,
    title,
    description: "",
    estimatedHours:
      Number(estimatedHours),
    dueDate,
  });

  await message.reply(
    `✅ Task Created

` +
    `Title: ${task.title}
` +
    `Deadline: ${task.due_date}`
  );
}
