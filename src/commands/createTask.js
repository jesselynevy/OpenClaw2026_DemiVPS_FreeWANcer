import { createTask } from "../services/projectService.js";

export async function handleCreateTask(message, args) {
  const [projectId, title, dueDate, estimatedHours] = args;

  const task = createTask({
    projectId,
    title,
    description: "",
    estimatedHours: Number(estimatedHours),
    dueDate,
  });

  await message.reply(
    `✅ Task created\n\n` +
    `Title: ${task.title}\n` +
    `Deadline: ${task.due_date}`
  );
}
