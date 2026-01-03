// src/utils/notifications.js - Notification Helper Functions
import { EmbedBuilder } from 'discord.js';

/**
 * Send a moderation action notification to the user via DM
 */
export async function sendModActionNotification(user, guild, action, reason, moderator, duration = null) {
  const actionEmojis = {
    'WARN': '⚠️',
    'TIMEOUT': '⏰',
    'KICK': '👢',
    'BAN': '🔨'
  };

  const actionColors = {
    'WARN': '#FFFF00',
    'TIMEOUT': '#FFA500',
    'KICK': '#FF6B00',
    'BAN': '#FF0000'
  };

  const actionTitles = {
    'WARN': 'Warning Issued',
    'TIMEOUT': 'You Have Been Timed Out',
    'KICK': 'You Have Been Kicked',
    'BAN': 'You Have Been Banned'
  };

  try {
    const embed = new EmbedBuilder()
      .setColor(actionColors[action] || '#7289DA')
      .setTitle(`${actionEmojis[action] || '📋'} ${actionTitles[action] || 'Moderation Action'}`)
      .setDescription(`You have received a moderation action in **${guild.name}**`)
      .addFields(
        { name: '📋 Reason', value: reason, inline: false },
        { name: '👤 Moderator', value: moderator.tag, inline: true }
      )
      .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
      .setTimestamp();

    if (duration) {
      embed.addFields({ name: '⏱️ Duration', value: duration, inline: true });
    }

    if (action === 'WARN') {
      embed.addFields({
        name: '⚠️ Important',
        value: 'Repeated violations may result in timeout, kick, or ban. Please review the server rules.',
        inline: false
      });
    }

    if (action === 'BAN' || action === 'KICK') {
      embed.addFields({
        name: '📞 Appeal',
        value: 'If you believe this was an error, you may contact the server administrators to appeal.',
        inline: false
      });
    }

    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.log(`Could not DM user ${user.tag} about ${action}`);
    return false;
  }
}

/**
 * Send notification to the mod log channel
 */
export async function notifyModLogChannel(guild, data) {
  const { action, user, moderator, reason, duration, categories } = data;

  const modChannel = await findModLogChannel(guild);
  if (!modChannel) return;

  const actionColors = {
    'WARN': '#FFFF00',
    'TIMEOUT': '#FFA500',
    'KICK': '#FF6B00',
    'BAN': '#FF0000',
    'UNBAN': '#00FF00'
  };

  const actionEmojis = {
    'WARN': '⚠️',
    'TIMEOUT': '⏰',
    'KICK': '👢',
    'BAN': '🔨',
    'UNBAN': '✅'
  };

  const embed = new EmbedBuilder()
    .setColor(actionColors[action] || '#7289DA')
    .setTitle(`${actionEmojis[action] || '📋'} ${action}`)
    .addFields(
      { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
      { name: '👮 Moderator', value: moderator.tag, inline: true },
      { name: '📋 Reason', value: reason || 'No reason provided', inline: false }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'Moderation System' })
    .setTimestamp();

  if (duration) {
    embed.addFields({ name: '⏱️ Duration', value: duration, inline: true });
  }

  if (categories && categories.length > 0) {
    embed.addFields({ name: '🚨 Categories', value: categories.join(', '), inline: false });
  }

  try {
    await modChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending to mod log channel:', error);
  }
}

/**
 * Find the mod log channel in the guild
 */
export async function findModLogChannel(guild) {
  const possibleNames = [
    'mod-log',
    'modlog',
    'mod-logs',
    'audit-log',
    'logs',
    'moderation-log',
    'moderation',
    'mod-logs'
  ];

  for (const name of possibleNames) {
    const channel = guild.channels.cache.find(
      ch => ch.name.toLowerCase() === name && ch.isTextBased()
    );
    if (channel) return channel;
  }

  return null;
}

/**
 * Send a security alert to the server owner
 */
export async function sendSecurityAlert(guild, alertData) {
  const { type, severity, details, attacker } = alertData;

  try {
    const owner = await guild.fetchOwner();

    const severityColors = {
      'LOW': '#3498DB',
      'MEDIUM': '#F1C40F',
      'HIGH': '#E67E22',
      'CRITICAL': '#E74C3C'
    };

    const embed = new EmbedBuilder()
      .setColor(severityColors[severity] || '#E74C3C')
      .setTitle(`🚨 Security Alert: ${type}`)
      .setDescription(`**${guild.name}** - Security Event Detected`)
      .addFields(
        { name: '⚠️ Severity', value: severity, inline: true },
        { name: '📊 Event Type', value: type, inline: true },
        { name: '⏰ Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: 'Premium Anti-Nuke Security System' })
      .setTimestamp();

    if (attacker) {
      embed.addFields({
        name: '👤 Attacker',
        value: `${attacker.tag} (${attacker.id})`,
        inline: false
      });
    }

    if (details) {
      embed.addFields({
        name: '📋 Details',
        value: typeof details === 'string' ? details : JSON.stringify(details, null, 2).substring(0, 1000),
        inline: false
      });
    }

    await owner.send({ embeds: [embed] });
  } catch (error) {
    console.error('Could not send security alert to owner:', error);
  }
}

/**
 * Send a welcome message to new members
 */
export async function sendWelcomeMessage(member, settings) {
  if (!settings?.welcome_enabled || !settings?.welcome_channel_id) return;

  const channel = member.guild.channels.cache.get(settings.welcome_channel_id);
  if (!channel || !channel.isTextBased()) return;

  try {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`🎉 Welcome to ${member.guild.name}!`)
      .setDescription(
        `Hey ${member}, welcome to our community!\n\n` +
        `You are member #${member.guild.memberCount}\n\n` +
        (settings.welcome_message || 'Please read the rules and enjoy your stay!')
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
      .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed] });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}

/**
 * Create a formatted embed for announcements
 */
export function createAnnouncementEmbed(title, message, color = '#3498DB') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`📢 ${title}`)
    .setDescription(message)
    .setFooter({ text: 'Server Announcement' })
    .setTimestamp();
}

/**
 * Send a lockdown notification
 */
export async function sendLockdownNotification(guild, locked, reason = null) {
  const channel = guild.channels.cache.find(
    ch => ch.name.includes('general') && ch.isTextBased()
  );

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(locked ? '#FF0000' : '#00FF00')
    .setTitle(locked ? '🔒 Server Locked Down' : '🔓 Server Unlocked')
    .setDescription(
      locked
        ? 'The server has been locked down due to security concerns.\n\n' +
          `**Reason:** ${reason || 'Security measure'}\n\n` +
          'Only administrators can send messages until the lockdown is lifted.'
        : 'The server lockdown has been lifted. Normal operations have resumed.'
    )
    .setFooter({ text: 'Server Security System' })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending lockdown notification:', error);
  }
}

/**
 * Format a detailed action log embed
 */
export function createDetailedActionLog(action) {
  const { type, user, moderator, reason, details, timestamp } = action;

  const embed = new EmbedBuilder()
    .setColor('#7289DA')
    .setTitle(`📋 ${type} - Detailed Log`)
    .addFields(
      { name: '👤 Target User', value: `${user.tag} (${user.id})`, inline: true },
      { name: '👮 Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
      { name: '⏰ Time', value: `<t:${Math.floor(timestamp / 1000)}:F>`, inline: false },
      { name: '📋 Reason', value: reason, inline: false }
    );

  if (details) {
    embed.addFields({
      name: '📊 Additional Details',
      value: typeof details === 'string' ? details : JSON.stringify(details, null, 2).substring(0, 1000),
      inline: false
    });
  }

  embed.setTimestamp(timestamp);

  return embed;
}

/**
 * Send periodic statistics to a stats channel
 */
export async function sendPeriodicStats(guild, stats) {
  const statsChannel = guild.channels.cache.find(
    ch => ch.name.includes('stats') && ch.isTextBased()
  );

  if (!statsChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('📊 Server Statistics Update')
    .addFields(
      { name: '👥 Total Members', value: stats.total_members?.toString() || '0', inline: true },
      { name: '💬 Messages', value: stats.total_messages?.toString() || '0', inline: true },
      { name: '🛡️ Mod Actions', value: stats.total_actions?.toString() || '0', inline: true },
      { name: '⚠️ Warnings', value: stats.total_warnings?.toString() || '0', inline: true },
      { name: '🤖 AI Detections', value: stats.ai_moderations?.toString() || '0', inline: true },
      { name: '🔒 Security Events', value: stats.security_events?.toString() || '0', inline: true }
    )
    .setFooter({ text: 'Automated Statistics Report' })
    .setTimestamp();

  try {
    await statsChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending periodic stats:', error);
  }
}
