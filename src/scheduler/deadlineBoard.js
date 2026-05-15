import dayjs from "dayjs";

export async function updateDeadlineBoard(client, tasks) {
  const channel = await client.channels.fetch(
    process.env.DEADLINE_CHANNEL_ID
  );

  const sorted = tasks.sort(
    (a, b) =>
      new Date(a.due_date) -
      new Date(b.due_date)
  );

  const lines = sorted.map((task, index) => {
    const daysLeft = dayjs(task.due_date)
      .diff(dayjs(), "day");

    return (
      `${index + 1}. ${task.title}
` +
      `Progress: ${task.progress}%
` +
      `Deadline: ${task.due_date}
` +
      `Days Left: ${daysLeft}
`
    );
  });

  const content =
    `# 📌 FreeWANcer Deadline Board

` +
    lines.join("
");

  const messages = await channel.messages.fetch({
    limit: 10,
  });

  const existing = messages.find((m) =>
    m.author.id === client.user.id
  );

  if (existing) {
    await existing.edit(content);
  } else {
    await channel.send(content);
  }
}
