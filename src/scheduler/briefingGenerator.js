export function generateDailyBriefing(tasks) {
  if (!tasks.length) {
    return "Hari ini tidak ada task aktif 🎉";
  }

  const lines = tasks.map((task, index) => {
    return (
      `${index + 1}. ${task.title}\n` +
      `   Progress: ${task.progress}%\n` +
      `   Deadline: ${task.due_date}\n` +
      `   Priority Score: ${task.priority_score.toFixed(2)}`
    );
  });

  return (
    `📋 Daily Briefing FreeWANcer\n\n` +
    lines.join("\n\n")
  );
}
