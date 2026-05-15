import { ChannelType, PermissionFlagsBits } from "discord.js";

/** Create/archive private client channels, assign Client role */
export async function ensureClientRole(guild, roleName = "Client") {
  let role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    role = await guild.roles.create({ name: roleName, mentionable: false });
  }
  return role;
}

export async function assignClientRoleToMember(member, roleName = "Client") {
  const role = await ensureClientRole(member.guild, roleName);
  await member.roles.add(role);
  return role;
}

export async function createPrivateClientChannel(guild, clientMember, channelName) {
  const categoryId = process.env.CLIENT_CHANNELS_CATEGORY_ID;
  const parent = categoryId ? { parent: categoryId } : {};

  const staffRoleId = process.env.STAFF_ROLE_ID;
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: clientMember.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  return guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    ...parent,
    permissionOverwrites: overwrites,
  });
}
