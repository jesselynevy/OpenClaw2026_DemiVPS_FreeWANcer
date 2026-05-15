import dayjs from "dayjs";

export function calculatePriority(task) {
  const now = dayjs();
  const due = dayjs(task.due_date);

  const daysLeft = Math.max(due.diff(now, "day"), 1);

  const urgencyWeight = 100 / daysLeft;

  const remainingWork =
    task.estimated_hours * (1 - task.progress / 100);

  const progressPenalty = remainingWork * 5;

  return urgencyWeight + progressPenalty;
}

export function rankTasks(tasks) {
  return tasks
    .map((task) => ({
      ...task,
      priority_score: calculatePriority(task),
    }))
    .sort((a, b) => b.priority_score - a.priority_score);
}
