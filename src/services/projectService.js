import { getDb } from "../db/database.js";

export function createTask({
  projectId,
  title,
  description,
  estimatedHours,
  dueDate,
}) {
  return getDb()
    .prepare(
      `INSERT INTO project_tasks
      (project_id, title, description, estimated_hours, due_date)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *`
    )
    .get(
      projectId,
      title,
      description,
      estimatedHours,
      dueDate
    );
}

export function getPendingTasks() {
  return getDb()
    .prepare(
      `SELECT * FROM project_tasks
       WHERE status != 'completed'
       ORDER BY due_date ASC`
    )
    .all();
}

export function updateTaskProgress(taskId, progress) {
  return getDb()
    .prepare(
      `UPDATE project_tasks
       SET progress = ?
       WHERE id = ?`
    )
    .run(progress, taskId);
}

export function markReminderSent(taskId) {
  return getDb()
    .prepare(
      `UPDATE project_tasks
       SET reminder_sent = 1
       WHERE id = ?`
    )
    .run(taskId);
}
