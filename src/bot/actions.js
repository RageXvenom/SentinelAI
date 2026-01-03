// src/bot/actions.js - Enhanced with comprehensive notifications
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export async function executeAction(message, member, moderationResult) {
  const { recommended_action, risk_level, reasoning, detected_categories } = moderationResult;

  try {
    switch (recommended_action) {
      case 'ALLOW':
        return 'ALLOW';

      case 'CAPTCHA':
        await handleCaptchaRequired(message, member, reasoning);
        return 'CAPTCHA';

      case 'WARN':
        await handleWarn(message, reasoning, detected_categories);
        return 'WARN';

      case 'DELETE':
        await handleDelete(message, reasoning, detected_categories);
        return 'DELETE';

      case 'MUTE':
        await handleMute(message, member, reasoning, detected_categories);
        return 'MUTE';

      case 'KICK':
        await handleKick(message, member, reasoning, detected_categories);
        return 'KICK';

      default:
        console.warn(`Unknown action: ${recommended_action}`);
        return 'ALLOW';
    }
  } catch (error) {
    console.error(`Error executing action ${recommended_action}:`, error);
    return 'ERROR';
  }
}

async function handleCaptchaRequired(message, member, reasoning) {
  try {
    if (message.deletable) {
      await message.delete();
    }

    // Send DM notification about CAPTCHA requirement
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔐 CAPTCHA Verification Required')
        .setDescription(
          `Your message in **${message.guild.name}** was flagged for verification.\n\n` +
          `**Reason:** ${reasoning}\n\n` +
          `To continue chatting, please complete CAPTCHA verification using the \`!verify\` command.`
        )
        .addFields(
          { name: '📝 How to Verify', value: '1. Type `!verify` in any channel\n2. Complete the CAPTCHA sent to your DMs\n3. Start chatting!', inline: false }
        )
        .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
        .setTimestamp();

      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('Could not DM user about CAPTCHA');
    }

    // Public channel notification
    const captchaMessage = await message.channel.send(
      `⚠️ <@${message.author.id}>, your account requires CAPTCHA verification before posting.\n\n` +
      `**Reason:** ${reasoning}\n` +
      `Use the command: \`!verify\` (Check your DMs)\n\n` +
      `This is a security measure to protect our community.`
    );

    setTimeout(() => {
      captchaMessage.delete().catch(console.error);
    }, 30000);

    if (member && member.moderatable) {
      await member.timeout(5 * 60 * 1000, 'CAPTCHA verification required');
    }

    // Notify mod log
    await notifyModLog(message.guild, {
      action: 'CAPTCHA_REQUIRED',
      user: message.author,
      reason: reasoning,
      channel: message.channel
    });
  } catch (error) {
    console.error('Error handling CAPTCHA requirement:', error);
  }
}

async function handleWarn(message, reasoning, categories) {
  try {
    // Send DM notification
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('⚠️ Warning Issued')
        .setDescription(`You received a warning in **${message.guild.name}**`)
        .addFields(
          { name: '📋 Reason', value: reasoning, inline: false },
          { name: '🚨 Detected Issues', value: categories.join(', ') || 'Rule violation', inline: false },
          { name: '📌 Important', value: 'Repeated violations may result in timeout, kick, or ban. Please review the server rules.', inline: false }
        )
        .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
        .setTimestamp();

      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('Could not DM user about warning');
    }

    // Public channel notification
    const warningMessage = await message.channel.send(
      `⚠️ Warning <@${message.author.id}>: Your message has been flagged by our AI moderation system.\n\n` +
      `**Reason:** ${reasoning}\n` +
      `**Detected:** ${categories.slice(0, 3).join(', ') || 'Rule violation'}\n\n` +
      `Please review our community guidelines. Repeated violations will result in further action.`
    );

    setTimeout(() => {
      warningMessage.delete().catch(console.error);
    }, 20000);

    // Notify mod log
    await notifyModLog(message.guild, {
      action: 'WARNING',
      user: message.author,
      reason: reasoning,
      categories: categories,
      channel: message.channel,
      messageContent: message.content.substring(0, 100)
    });
  } catch (error) {
    console.error('Error sending warning:', error);
  }
}

async function handleDelete(message, reasoning, categories) {
  try {
    // Send DM notification BEFORE deletion
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#FF6B00')
        .setTitle('🗑️ Message Removed')
        .setDescription(`Your message in **${message.guild.name}** was automatically removed.`)
        .addFields(
          { name: '📋 Reason', value: reasoning, inline: false },
          { name: '🚨 Detected Issues', value: categories.join(', ') || 'Policy violation', inline: false },
          { name: '💬 Your Message (First 100 chars)', value: message.content.substring(0, 100) || '[No text content]', inline: false },
          { name: '⚠️ Warning', value: 'Continued violations may result in timeout or removal from the server.', inline: false },
          { name: '📞 Appeal', value: 'If you believe this was an error, please contact a moderator.', inline: false }
        )
        .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
        .setTimestamp();

      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('Could not DM user about deletion');
    }

    // Delete the message
    if (message.deletable) {
      await message.delete();
    }

    // Public notification
    const notificationMessage = await message.channel.send(
      `🗑️ A message from <@${message.author.id}> was removed by our AI moderation system.\n\n` +
      `**Reason:** ${categories.slice(0, 2).join(', ') || 'Policy violation'}\n\n` +
      `This action has been logged. Continued violations may result in timeout or removal.`
    );

    setTimeout(() => {
      notificationMessage.delete().catch(console.error);
    }, 15000);

    // Notify mod log with more details
    await notifyModLog(message.guild, {
      action: 'MESSAGE_DELETED',
      user: message.author,
      reason: reasoning,
      categories: categories,
      channel: message.channel,
      messageContent: message.content.substring(0, 200),
      hasAttachments: message.attachments.size > 0
    });
  } catch (error) {
    console.error('Error deleting message:', error);
  }
}

async function handleMute(message, member, reasoning, categories) {
  try {
    // Send DM notification BEFORE muting
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔇 You Have Been Muted')
        .setDescription(`You have been temporarily muted in **${message.guild.name}** for 10 minutes.`)
        .addFields(
          { name: '📋 Reason', value: reasoning, inline: false },
          { name: '🚨 Violations Detected', value: categories.join(', ') || 'Multiple policy violations', inline: false },
          { name: '⏱️ Duration', value: '10 minutes', inline: true },
          { name: '⚠️ Serious Warning', value: 'This is a serious moderation action. Repeated violations will result in permanent removal from the server.', inline: false },
          { name: '📖 Next Steps', value: 'Please review the server rules while muted. Use this time to understand what went wrong.', inline: false }
        )
        .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
        .setTimestamp();

      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('Could not DM user about mute');
    }

    // Delete the message
    if (message.deletable) {
      await message.delete();
    }

    // Check if we can mute
    if (!member || !member.moderatable) {
      console.warn('Cannot mute user: insufficient permissions or user is moderator');
      await handleDelete(message, reasoning, categories);
      return;
    }

    const muteDuration = 10 * 60 * 1000;

    // Apply timeout
    await member.timeout(muteDuration, `AI Moderation: ${reasoning}`);

    // Public notification
    const muteMessage = await message.channel.send(
      `🔇 <@${message.author.id}> has been temporarily muted for 10 minutes.\n\n` +
      `**Reason:** ${reasoning}\n` +
      `**Violations:** ${categories.slice(0, 3).join(', ') || 'Multiple violations'}\n\n` +
      `This action has been logged. Repeated violations will result in longer timeouts or removal.`
    );

    setTimeout(() => {
      muteMessage.delete().catch(console.error);
    }, 15000);

    // Detailed mod log notification
    await notifyModLog(message.guild, {
      action: 'USER_MUTED',
      user: message.author,
      reason: reasoning,
      categories: categories,
      channel: message.channel,
      duration: '10 minutes',
      messageContent: message.content.substring(0, 200)
    });
  } catch (error) {
    console.error('Error muting user:', error);
    await handleDelete(message, reasoning, categories);
  }
}

async function handleKick(message, member, reasoning, categories) {
  try {
    // Send DM notification BEFORE kicking (very important!)
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('🚫 You Have Been Removed From The Server')
        .setDescription(`You have been removed from **${message.guild.name}**.`)
        .addFields(
          { name: '📋 Reason', value: reasoning, inline: false },
          { name: '🚨 Severe Violations Detected', value: categories.join(', ') || 'Severe policy violations', inline: false },
          { name: '⚠️ Critical Notice', value: 'Our AI moderation system detected severe violations of community guidelines.', inline: false },
          { name: '📞 Appeal Process', value: 'If you believe this was an error, you may contact the server administrators to appeal this decision.', inline: false },
          { name: '🔄 Rejoining', value: 'You may be able to rejoin if you have an invite link and your behavior improves.', inline: false }
        )
        .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
        .setTimestamp();

      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('Could not DM user about kick');
    }

    // Delete the message
    if (message.deletable) {
      await message.delete();
    }

    // Check if we can kick
    if (!member || !member.kickable) {
      console.warn('Cannot kick user: insufficient permissions or user is moderator');
      await handleMute(message, member, reasoning, categories);
      return;
    }

    // Kick the user
    await member.kick(`AI Moderation: ${reasoning}`);

    // Public notification
    const kickMessage = await message.channel.send(
      `🚫 A user has been removed from the server by our AI moderation system.\n\n` +
      `**Reason:** Severe violations detected\n` +
      `**Categories:** ${categories.slice(0, 3).join(', ') || 'Multiple severe violations'}\n\n` +
      `This action has been logged and will be reviewed by moderators.`
    );

    setTimeout(() => {
      kickMessage.delete().catch(console.error);
    }, 20000);

    // Comprehensive mod log notification
    await notifyModLog(message.guild, {
      action: 'USER_KICKED',
      user: message.author,
      reason: reasoning,
      categories: categories,
      channel: message.channel,
      messageContent: message.content.substring(0, 200),
      severity: 'CRITICAL'
    });
  } catch (error) {
    console.error('Error kicking user:', error);
    await handleMute(message, member, reasoning, categories);
  }
}

async function notifyModLog(guild, data) {
  const { action, user, reason, categories, channel, messageContent, duration, hasAttachments, severity } = data;

  const modChannel = await findModLogChannel(guild);
  if (!modChannel) return;

  const actionColors = {
    'CAPTCHA_REQUIRED': '#FFA500',
    'WARNING': '#FFFF00',
    'MESSAGE_DELETED': '#FF6B00',
    'USER_MUTED': '#FF0000',
    'USER_KICKED': '#8B0000'
  };

  const actionEmojis = {
    'CAPTCHA_REQUIRED': '🔐',
    'WARNING': '⚠️',
    'MESSAGE_DELETED': '🗑️',
    'USER_MUTED': '🔇',
    'USER_KICKED': '🚫'
  };

  const embed = new EmbedBuilder()
    .setColor(actionColors[action] || '#7289DA')
    .setTitle(`${actionEmojis[action] || '📋'} ${action.replace(/_/g, ' ')}`)
    .addFields(
      { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
      { name: '📍 Channel', value: `<#${channel.id}>`, inline: true },
      { name: '📋 Reason', value: reason || 'No reason provided', inline: false }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'AI Moderation System' })
    .setTimestamp();

  if (categories && categories.length > 0) {
    embed.addFields({ name: '🚨 Detected Categories', value: categories.join(', '), inline: false });
  }

  if (messageContent) {
    embed.addFields({ 
      name: '💬 Message Content', 
      value: `\`\`\`${messageContent}...\`\`\``, 
      inline: false 
    });
  }

  if (duration) {
    embed.addFields({ name: '⏱️ Duration', value: duration, inline: true });
  }

  if (hasAttachments) {
    embed.addFields({ name: '📎 Attachments', value: 'Yes', inline: true });
  }

  if (severity) {
    embed.addFields({ name: '⚡ Severity', value: severity, inline: true });
  }

  try {
    await modChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending to mod log channel:', error);
  }
}

async function findModLogChannel(guild) {
  const possibleNames = ['mod-log', 'modlog', 'mod-logs', 'audit-log', 'logs', 'moderation-log'];

  for (const name of possibleNames) {
    const channel = guild.channels.cache.find(
      ch => ch.name === name && ch.isTextBased()
    );
    if (channel) return channel;
  }

  return null;
}
