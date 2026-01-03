// src/commands/handlers.js - Complete Handler Functions
import { EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import {
  getOrCreateUser,
  getUserWarnings,
  clearUserWarnings as dbClearWarnings,
  updateServerSettings,
  getServerSettings,
  logModerationAction,
  addWarning,
  addTrustedUser as dbAddTrustedUser,
  removeTrustedUser as dbRemoveTrustedUser,
  getTrustedUsers,
  updateAntiNukeSettings,
  getAntiNukeSettings,
  getSecurityLogs,
  getServerStats,
  getRecentModerationActions,
  createCaptchaSession
} from '../database/supabase.js';
import { sendModActionNotification, notifyModLogChannel } from '../utils/notifications.js';
import { parseDuration, formatDuration, generateCaptchaImage } from '../utils/helpers.js';

// ============================================
// GENERAL COMMAND HANDLERS
// ============================================

export async function handleAbout(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#7289DA')
    .setTitle('🤖 AI Moderation Bot')
    .setDescription(
      '**Advanced AI-Powered Discord Moderation System**\n\n' +
      'This bot uses cutting-edge AI technology to automatically moderate your server.'
    )
    .addFields(
      { name: '🧠 AI Engine', value: 'Groq AI (Llama 3.3 70B)', inline: true },
      { name: '🛡️ Features', value: 'Auto-Mod, Anti-Nuke, CAPTCHA', inline: true },
      { name: '📊 Version', value: '2.0.0', inline: true }
    )
    .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('📚 Command Help')
    .setDescription('Here are all available commands:')
    .addFields(
      { 
        name: '📋 General Commands', 
        value: '`/about` - Bot info\n`/help` - This menu\n`/ping` - Bot latency\n`/verify` - CAPTCHA verification',
        inline: false 
      },
      { 
        name: '✅ Verification', 
        value: '`/setup-verify <channel> <role>` - Setup verification\n`/verify` - Complete CAPTCHA',
        inline: false 
      },
      { 
        name: '🛡️ Moderation', 
        value: '`/warn <user> <reason>` - Warn\n`/timeout <user> <duration>` - Timeout\n`/kick <user>` - Kick\n`/ban <user>` - Ban',
        inline: false 
      }
    )
    .setFooter({ text: 'Use commands responsibly' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function handlePing(interaction) {
  const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
  
  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('🏓 Pong!')
    .addFields(
      { name: '⏱️ Bot Latency', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
      { name: '⚡ API Latency', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ content: null, embeds: [embed] });
}

// ============================================
// VERIFICATION COMMANDS
// ============================================

export async function handleSetupVerify(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need Administrator permissions.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const verifyChannel = interaction.options.getChannel('channel');
    const verifyRole = interaction.options.getRole('role');

    await updateServerSettings(interaction.guild.id, {
      verification_enabled: true,
      verification_channel_id: verifyChannel.id,
      verified_role_id: verifyRole.id,
      captcha_enabled: true
    });

    const infoEmbed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🔐 Server Verification Required')
      .setDescription(
        'Welcome! To prevent spam and raids, complete CAPTCHA verification.\n\n' +
        '**How to verify:**\n' +
        '1. Use `/verify` command\n' +
        '2. Check DMs for CAPTCHA\n' +
        '3. Reply with the code\n' +
        '4. Get Verified role\n\n' +
        '⏱️ You have 10 minutes'
      )
      .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
      .setTimestamp();

    await verifyChannel.send({ embeds: [infoEmbed] });

    const successEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Verification Configured')
      .addFields(
        { name: '📢 Channel', value: `${verifyChannel}`, inline: true },
        { name: '🎖️ Role', value: `${verifyRole}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Error setting up verification:', error);
    await interaction.editReply({ content: '❌ Failed to setup verification.' });
  }
}

export async function handleVerify(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await getServerSettings(interaction.guildId);

    if (!settings?.verification_enabled) {
      return interaction.editReply({
        content: '❌ Verification not enabled. Contact admin.'
      });
    }

    const verifiedRole = interaction.guild.roles.cache.get(settings.verified_role_id);
    
    if (!verifiedRole) {
      return interaction.editReply({
        content: '❌ Verified role not configured. Contact admin.'
      });
    }

    if (interaction.member.roles.cache.has(verifiedRole.id)) {
      return interaction.editReply({
        content: '✅ You are already verified!'
      });
    }

    const captchaCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const dbUser = await getOrCreateUser(
      interaction.user, 
      interaction.user.createdAt.toISOString()
    );

    await createCaptchaSession(
      dbUser.id,
      interaction.user.id,
      interaction.guildId,
      captchaCode
    );

    const captchaImage = generateCaptchaImage(captchaCode);
    const attachment = new AttachmentBuilder(captchaImage, { name: 'captcha.png' });

    const dmEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🔐 CAPTCHA Verification')
      .setDescription(
        `**Verification for ${interaction.guild.name}**\n\n` +
        '1. Look at the image\n' +
        '2. Type the code (case-insensitive)\n' +
        '3. Send in this DM\n\n' +
        '⏱️ 10 minutes\n' +
        '❌ 3 attempts'
      )
      .setImage('attachment://captcha.png')
      .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
      .setTimestamp();

    try {
      await interaction.user.send({ 
        embeds: [dmEmbed], 
        files: [attachment] 
      });

      await interaction.editReply({
        content: '✅ CAPTCHA sent to DMs! Check your messages.'
      });

    } catch (dmError) {
      const failEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Cannot Send DM')
        .setDescription(
          'Bot can\'t send DM. Enable DMs from server members:\n\n' +
          '• Discord Settings → Privacy & Safety\n' +
          '• Enable "Allow direct messages from server members"'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [failEmbed] });
    }

  } catch (error) {
    console.error('Error in verify:', error);
    await interaction.editReply({ content: '❌ Verification error.' });
  }
}

// ============================================
// INFORMATION HANDLERS
// ============================================

export async function handleStats(interaction) {
  await interaction.deferReply();

  try {
    const stats = await getServerStats(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('📊 Server Statistics')
      .addFields(
        { name: '👥 Members', value: stats.total_members?.toString() || '0', inline: true },
        { name: '💬 Messages', value: stats.total_messages?.toString() || '0', inline: true },
        { name: '🛡️ Actions', value: stats.total_actions?.toString() || '0', inline: true },
        { name: '⚠️ Warnings', value: stats.total_warnings?.toString() || '0', inline: true },
        { name: '🤖 AI Mods', value: stats.ai_moderations?.toString() || '0', inline: true },
        { name: '🔒 Events', value: stats.security_events?.toString() || '0', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching stats:', error);
    await interaction.editReply({ content: '❌ Failed to fetch statistics.' });
  }
}

export async function handleUserInfo(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild.members.cache.get(targetUser.id);

  await interaction.deferReply();

  try {
    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    const warnings = await getUserWarnings(dbUser.id, interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`👤 ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🔑 ID', value: targetUser.id, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '⚠️ Warnings', value: warnings.length.toString(), inline: true },
        { name: '🔐 CAPTCHA', value: dbUser.captcha_verified ? '✅ Yes' : '❌ No', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching user info:', error);
    await interaction.editReply({ content: '❌ Failed to fetch user info.' });
  }
}

export async function handleServerInfo(interaction) {
  const guild = interaction.guild;

  const embed = new EmbedBuilder()
    .setColor('#7289DA')
    .setTitle(`🏰 ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '🔑 ID', value: guild.id, inline: true },
      { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
      { name: '🎯 Channels', value: guild.channels.cache.size.toString(), inline: true },
      { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
      { name: '🚀 Boost', value: `Level ${guild.premiumTier}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function handleWarnings(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  await interaction.deferReply({ ephemeral: targetUser.id === interaction.user.id });

  try {
    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    const warnings = await getUserWarnings(dbUser.id, interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor(warnings.length > 0 ? '#E67E22' : '#2ECC71')
      .setTitle(`⚠️ ${targetUser.tag}`)
      .setDescription(
        warnings.length === 0
          ? '✅ No warnings!'
          : `**Total: ${warnings.length}**`
      );

    if (warnings.length > 0) {
      const list = warnings.slice(0, 10).map((w, i) => {
        const date = Math.floor(new Date(w.created_at).getTime() / 1000);
        return `**${i + 1}.** ${w.warning_reason} | <t:${date}:R>`;
      }).join('\n');

      embed.addFields({ name: 'Warnings', value: list, inline: false });
    }

    embed.setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching warnings:', error);
    await interaction.editReply({ content: '❌ Failed to fetch warnings.' });
  }
}

export async function handleModLog(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const actions = await getRecentModerationActions(interaction.guildId, 10);

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('📋 Recent Actions');

    if (actions.length === 0) {
      embed.setDescription('No recent moderation actions.');
    } else {
      const list = actions.map((a, i) => {
        const date = Math.floor(new Date(a.created_at).getTime() / 1000);
        return `**${i + 1}.** ${a.action_taken} - Risk: ${a.risk_score} | <t:${date}:R>`;
      }).join('\n');
      embed.addFields({ name: 'Actions', value: list, inline: false });
    }

    embed.setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching mod log:', error);
    await interaction.editReply({ content: '❌ Failed to fetch mod log.' });
  }
}

// ============================================
// MODERATION HANDLERS
// ============================================

export async function handleWarn(interaction) {
  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  await interaction.deferReply({ ephemeral: true });

  try {
    await sendModActionNotification(targetUser, interaction.guild, 'WARN', reason, interaction.user);

    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    await addWarning(dbUser.id, interaction.guild.id, null, reason, 'MEDIUM');

    await notifyModLogChannel(interaction.guild, {
      action: 'WARN',
      user: targetUser,
      moderator: interaction.user,
      reason: reason
    });

    const embed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle('⚠️ User Warned')
      .setDescription(`**${targetUser.tag}** has been warned.`)
      .addFields(
        { name: 'Reason', value: reason, inline: false },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error warning user:', error);
    await interaction.editReply({ content: '❌ Failed to warn user.' });
  }
}

export async function handleTimeout(interaction) {
  const targetUser = interaction.options.getUser('user');
  const durationStr = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  const member = interaction.guild.members.cache.get(targetUser.id);
  if (!member) {
    return interaction.reply({ content: '❌ User not found.', ephemeral: true });
  }

  if (!member.moderatable) {
    return interaction.reply({ 
      content: '❌ Cannot timeout this user.', 
      ephemeral: true 
    });
  }

  const duration = parseDuration(durationStr);
  if (!duration) {
    return interaction.reply({ 
      content: '❌ Invalid duration (use: 10m, 1h, 2d)', 
      ephemeral: true 
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await sendModActionNotification(
      targetUser, 
      interaction.guild, 
      'TIMEOUT', 
      reason, 
      interaction.user,
      formatDuration(duration)
    );

    await member.timeout(duration, `${interaction.user.tag}: ${reason}`);

    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    await logModerationAction({
      messageId: null,
      userId: dbUser.id,
      guildId: interaction.guild.id,
      riskScore: 65,
      riskLevel: 'SUSPICIOUS',
      detectedCategories: ['MANUAL_TIMEOUT'],
      recommendedAction: 'MUTE',
      actionTaken: 'MUTE',
      reasoning: reason
    });

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏰ User Timed Out')
      .setDescription(`**${targetUser.tag}** timed out for ${formatDuration(duration)}.`)
      .addFields(
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error timing out user:', error);
    await interaction.editReply({ content: '❌ Failed to timeout user.' });
  }
}

export async function handleKick(interaction) {
  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  const member = interaction.guild.members.cache.get(targetUser.id);
  if (!member) {
    return interaction.reply({ content: '❌ User not found.', ephemeral: true });
  }

  if (!member.kickable) {
    return interaction.reply({ 
      content: '❌ Cannot kick this user.', 
      ephemeral: true 
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await sendModActionNotification(targetUser, interaction.guild, 'KICK', reason, interaction.user);
    await member.kick(`${interaction.user.tag}: ${reason}`);

    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    await logModerationAction({
      messageId: null,
      userId: dbUser.id,
      guildId: interaction.guild.id,
      riskScore: 85,
      riskLevel: 'DANGEROUS',
      detectedCategories: ['MANUAL_KICK'],
      recommendedAction: 'KICK',
      actionTaken: 'KICK',
      reasoning: reason
    });

    const embed = new EmbedBuilder()
      .setColor('#FF6B00')
      .setTitle('👢 User Kicked')
      .setDescription(`**${targetUser.tag}** has been kicked.`)
      .addFields(
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error kicking user:', error);
    await interaction.editReply({ content: '❌ Failed to kick user.' });
  }
}

export async function handleBan(interaction) {
  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const deleteDays = interaction.options.getInteger('delete_days') || 0;

  const member = interaction.guild.members.cache.get(targetUser.id);
  if (member && !member.bannable) {
    return interaction.reply({ 
      content: '❌ Cannot ban this user.', 
      ephemeral: true 
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await sendModActionNotification(targetUser, interaction.guild, 'BAN', reason, interaction.user);
    
    await interaction.guild.members.ban(targetUser.id, { 
      reason: `${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60
    });

    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    await logModerationAction({
      messageId: null,
      userId: dbUser.id,
      guildId: interaction.guild.id,
      riskScore: 100,
      riskLevel: 'DANGEROUS',
      detectedCategories: ['MANUAL_BAN'],
      recommendedAction: 'BAN',
      actionTaken: 'BAN',
      reasoning: reason
    });

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔨 User Banned')
      .setDescription(`**${targetUser.tag}** has been permanently banned.`)
      .addFields(
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error banning user:', error);
    await interaction.editReply({ content: '❌ Failed to ban user.' });
  }
}

export async function handleUnban(interaction) {
  const userId = interaction.options.getString('user_id');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await interaction.client.users.fetch(userId);
    await interaction.guild.members.unban(userId, `${interaction.user.tag}: ${reason}`);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ User Unbanned')
      .setDescription(`**${user.tag}** has been unbanned.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error unbanning user:', error);
    await interaction.editReply({ content: '❌ Failed to unban user.' });
  }
}

export async function handleClearWarnings(interaction) {
  const targetUser = interaction.options.getUser('user');

  await interaction.deferReply({ ephemeral: true });

  try {
    const dbUser = await getOrCreateUser(targetUser, targetUser.createdAt.toISOString());
    await dbClearWarnings(dbUser.id, interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Warnings Cleared')
      .setDescription(`All warnings cleared for **${targetUser.tag}**.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error clearing warnings:', error);
    await interaction.editReply({ content: '❌ Failed to clear warnings.' });
  }
}

export async function handleSlowmode(interaction) {
  const seconds = interaction.options.getInteger('seconds');

  try {
    await interaction.channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('⏱️ Slowmode Updated')
      .setDescription(
        seconds === 0 
          ? 'Slowmode disabled.' 
          : `Slowmode set to **${seconds}** seconds.`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error setting slowmode:', error);
    await interaction.reply({ content: '❌ Failed to set slowmode.', ephemeral: true });
  }
}

export async function handlePurge(interaction) {
  const amount = interaction.options.getInteger('amount');
  const targetUser = interaction.options.getUser('user');

  await interaction.deferReply({ ephemeral: true });

  try {
    const messages = await interaction.channel.messages.fetch({ limit: amount + 1 });
    
    let toDelete = Array.from(messages.values()).slice(1);
    
    if (targetUser) {
      toDelete = toDelete.filter(m => m.author.id === targetUser.id);
    }

    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    toDelete = toDelete.filter(m => m.createdTimestamp > twoWeeksAgo);

    if (toDelete.length === 0) {
      return interaction.editReply({ content: '❌ No messages to delete.' });
    }

    await interaction.channel.bulkDelete(toDelete, true);

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🗑️ Messages Purged')
      .setDescription(`Deleted **${toDelete.length}** messages.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error purging messages:', error);
    await interaction.editReply({ content: '❌ Failed to purge messages.' });
  }
}

// ============================================
// SETTINGS HANDLERS
// ============================================

export async function handleSettings(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await getServerSettings(interaction.guild.id);

    if (subcommand === 'view') {
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('⚙️ Server Settings')
        .addFields(
          { 
            name: 'Auto Mod', 
            value: settings?.auto_moderation_enabled ? '✅ On' : '❌ Off',
            inline: true 
          },
          { 
            name: 'CAPTCHA', 
            value: settings?.captcha_enabled ? '✅ On' : '❌ Off',
            inline: true 
          },
          { 
            name: 'Spam Detection', 
            value: settings?.spam_detection_enabled ? '✅ On' : '❌ Off',
            inline: true 
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const enabled = interaction.options.getBoolean('enabled');
      const updateData = {};

      switch (subcommand) {
        case 'automod':
          updateData.auto_moderation_enabled = enabled;
          break;
        case 'captcha':
          updateData.captcha_enabled = enabled;
          break;
        case 'spam':
          updateData.spam_detection_enabled = enabled;
          break;
      }

      await updateServerSettings(interaction.guild.id, updateData);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Settings Updated')
        .setDescription(`**${subcommand}** is now ${enabled ? 'enabled' : 'disabled'}.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error handling settings:', error);
    await interaction.editReply({ content: '❌ Failed to update settings.' });
  }
}

// ============================================
// ANTI-NUKE HANDLERS
// ============================================

export async function handleAntiNuke(interaction, antiNuke) {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await getAntiNukeSettings(interaction.guild.id);

    if (subcommand === 'status') {
      const embed = new EmbedBuilder()
        .setColor(settings?.enabled ? '#00FF00' : '#FF0000')
        .setTitle('🛡️ Anti-Nuke Status')
        .setDescription(settings?.enabled ? '✅ Protection ACTIVE' : '❌ Protection INACTIVE')
        .addFields(
          { name: 'Channel Delete Limit', value: `${settings?.channel_delete_limit || '3'}`, inline: true },
          { name: 'Role Delete Limit', value: `${settings?.role_delete_limit || '3'}`, inline: true },
          { name: 'Ban Limit', value: `${settings?.ban_limit || '3'}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'enable') {
      await updateAntiNukeSettings(interaction.guild.id, { enabled: true });
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Anti-Nuke Enabled')
        .setDescription('Server protection is now active.')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'disable') {
      await updateAntiNukeSettings(interaction.guild.id, { enabled: false });
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Anti-Nuke Disabled')
        .setDescription('Warning: Protection is now inactive.')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'config') {
      const updates = {};
      const channelLimit = interaction.options.getInteger('channel_delete_limit');
      const roleLimit = interaction.options.getInteger('role_delete_limit');
      const banLimit = interaction.options.getInteger('ban_limit');
      const punishment = interaction.options.getString('punishment');

      if (channelLimit) updates.channel_delete_limit = channelLimit;
      if (roleLimit) updates.role_delete_limit = roleLimit;
      if (banLimit) updates.ban_limit = banLimit;
      if (punishment) updates.punishment_type = punishment;

      await updateAntiNukeSettings(interaction.guild.id, updates);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Anti-Nuke Configured')
        .setDescription('Settings updated successfully.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'whitelist') {
      const user = interaction.options.getUser('user');
      const dbUser = await getOrCreateUser(user, user.createdAt.toISOString());
      await dbAddTrustedUser(interaction.guild.id, dbUser.id, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ User Whitelisted')
        .setDescription(`**${user.tag}** added to whitelist.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'unwhitelist') {
      const user = interaction.options.getUser('user');
      const dbUser = await getOrCreateUser(user, user.createdAt.toISOString());
      await dbRemoveTrustedUser(interaction.guild.id, dbUser.id);

      const embed = new EmbedBuilder()
        .setColor('#FF6B00')
        .setTitle('✅ User Removed from Whitelist')
        .setDescription(`**${user.tag}** removed.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'unlock') {
      const success = await antiNuke.unlockServer(interaction.guild);

      const embed = new EmbedBuilder()
        .setColor(success ? '#00FF00' : '#FF0000')
        .setTitle(success ? '🔓 Server Unlocked' : '❌ Unlock Failed')
        .setDescription(
          success
            ? 'All channels are now accessible.'
            : 'Failed to unlock server.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'logs') {
      const limit = interaction.options.getInteger('limit') || 10;
      const logs = await getSecurityLogs(interaction.guild.id, limit);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔒 Security Logs');

      if (logs.length === 0) {
        embed.setDescription('No security events.');
      } else {
        const list = logs.map((log, i) => {
          const date = Math.floor(new Date(log.created_at).getTime() / 1000);
          return `**${i + 1}.** ${log.event_type} | <t:${date}:R>`;
        }).join('\n');
        embed.addFields({ name: 'Events', value: list, inline: false });
      }

      embed.setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error handling antinuke:', error);
    await interaction.editReply({ content: '❌ Anti-Nuke error.' });
  }
}

// ============================================
// TRUSTED USERS HANDLERS
// ============================================

export async function handleTrusted(interaction) {
  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply({ ephemeral: true });

  try {
    if (subcommand === 'add') {
      const user = interaction.options.getUser('user');
      const dbUser = await getOrCreateUser(user, user.createdAt.toISOString());
      
      await dbAddTrustedUser(interaction.guild.id, dbUser.id, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Trusted User Added')
        .setDescription(`**${user.tag}** is now trusted.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'remove') {
      const user = interaction.options.getUser('user');
      const dbUser = await getOrCreateUser(user, user.createdAt.toISOString());
      
      await dbRemoveTrustedUser(interaction.guild.id, dbUser.id);

      const embed = new EmbedBuilder()
        .setColor('#FF6B00')
        .setTitle('✅ Trusted User Removed')
        .setDescription(`**${user.tag}** removed.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'list') {
      const trustedUsers = await getTrustedUsers(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('👥 Trusted Users')
        .setDescription(
          trustedUsers.length === 0
            ? 'No trusted users.'
            : `Total: ${trustedUsers.length}`
        );

      if (trustedUsers.length > 0) {
        const list = trustedUsers.slice(0, 25).map((u, i) => {
          const username = u.discord_users?.username || 'Unknown';
          const date = Math.floor(new Date(u.added_at).getTime() / 1000);
          return `**${i + 1}.** ${username} | <t:${date}:R>`;
        }).join('\n');

        embed.addFields({ name: 'Users', value: list, inline: false });
      }

      embed.setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error handling trusted:', error);
    await interaction.editReply({ content: '❌ Failed to manage trusted users.' });
  }
}

// ============================================
// UTILITY HANDLERS
// ============================================

export async function handleLockdown(interaction) {
  const action = interaction.options.getString('action');
  const reason = interaction.options.getString('reason') || 'Server lockdown initiated';

  await interaction.deferReply({ ephemeral: true });

  try {
    const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
    
    for (const channel of channels.values()) {
      if (action === 'lock') {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: false
        }, { reason: `Lockdown by ${interaction.user.tag}: ${reason}` });
      } else {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: null
        }, { reason: `Unlocked by ${interaction.user.tag}` });
      }
    }

    const embed = new EmbedBuilder()
      .setColor(action === 'lock' ? '#FF0000' : '#00FF00')
      .setTitle(action === 'lock' ? '🔒 Server Locked Down' : '🔓 Server Unlocked')
      .setDescription(
        action === 'lock'
          ? `**Reason:** ${reason}`
          : 'Normal operations resumed.'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error with lockdown:', error);
    await interaction.editReply({ content: '❌ Failed to execute lockdown.' });
  }
}

export async function handleAnnounce(interaction) {
  const title = interaction.options.getString('title');
  const message = interaction.options.getString('message');
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const color = interaction.options.getString('color') || '#3498DB';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📢 ${title}`)
    .setDescription(message)
    .setFooter({ text: `By ${interaction.user.tag}` })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Announcement sent to ${channel}`, ephemeral: true });
  } catch (error) {
    console.error('Error sending announcement:', error);
    await interaction.reply({ content: '❌ Failed to send announcement.', ephemeral: true });
  }
}

export async function handleRole(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'add') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) {
        return interaction.reply({ content: '❌ User not found.', ephemeral: true });
      }

      await member.roles.add(role, `Role added by ${interaction.user.tag}`);
      await interaction.reply({ content: `✅ Added ${role} to ${user.tag}`, ephemeral: true });

    } else if (subcommand === 'remove') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) {
        return interaction.reply({ content: '❌ User not found.', ephemeral: true });
      }

      await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);
      await interaction.reply({ content: `✅ Removed ${role} from ${user.tag}`, ephemeral: true });

    } else if (subcommand === 'info') {
      const role = interaction.options.getRole('role');

      const embed = new EmbedBuilder()
        .setColor(role.color || '#7289DA')
        .setTitle(`🎭 Role: ${role.name}`)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Members', value: role.members.size.toString(), inline: true },
          { name: 'Position', value: role.position.toString(), inline: true },
          { name: 'Color', value: role.hexColor, inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error with role command:', error);
    await interaction.reply({ content: '❌ Failed to execute role command.', ephemeral: true });
  }
}

export async function handleEmbed(interaction) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const color = interaction.options.getString('color') || '#7289DA';
  const footer = interaction.options.getString('footer');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (footer) {
    embed.setFooter({ text: footer });
  }

  try {
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error creating embed:', error);
    await interaction.reply({ content: '❌ Failed to create embed.', ephemeral: true });
  }
}
