export function generateDailyBriefing(tasks) {
  if (!tasks.length) {
    return "Hari ini tidak ada proyek aktif 🎉";
  }

  const lines = tasks.map((task, index) => {
    return (
      `${index + 1}. ${task.title}
` +
      `Progress: ${task.progress}%
` +
      `Priority: ${task.priority_score.toFixed(2)}
` +
      `Deadline: ${task.due_date}`
    );
  });

  return (
    `# 📋 Daily Briefing

` +
    lines.join("

")
  );
}
