// src/bot/discord-bot.js - Complete with Auto Role + Unverified Message Deletion
import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Events,
  REST,
  Routes,
  EmbedBuilder
} from 'discord.js';
import { AntiNukeSystem } from '../security/antinuke.js';
import { commands } from '../commands/slashCommands.js';
import * as handlers from '../commands/handlers.js';
import {
  getOrCreateUser,
  getOrCreateServerMember,
  logMessage,
  getRecentMessages,
  getUserWarnings,
  logModerationAction,
  addWarning,
  updateAverageRiskScore,
  verifyCaptcha,
  getServerSettings
} from '../database/supabase.js';
import { analyzeMessageWithGroq } from '../moderation/groq-engine.js';
import { executeAction } from './actions.js';
import { 
  calculateAccountAge, 
  calculateJoinAge, 
  detectLinks, 
  detectImages
} from '../utils/helpers.js';

export function createBot(token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildBans,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildIntegrations
    ],
    partials: [
      Partials.Message, 
      Partials.Channel, 
      Partials.GuildMember,
      Partials.User
    ]
  });

  // Initialize Anti-Nuke System
  let antiNuke;

  // Bot ready event - register slash commands globally
  client.once(Events.ClientReady, async () => {
    console.log(`┌────────────────────────────────────────────────────────┐`);
    console.log(`│  🤖 Bot: ${client.user.tag.padEnd(43)} │`);
    console.log(`│  🛡️  Monitoring ${String(client.guilds.cache.size).padEnd(2)} server(s)                            │`);
    console.log(`│  🧠 AI Engine: Groq API Active                       │`);
    console.log(`│  🔐 CAPTCHA System: Enabled                          │`);
    console.log(`│  ✅ Auto Role Assignment: ACTIVE                     │`);
    console.log(`│  🗑️  Unverified Message Deletion: ACTIVE             │`);
    console.log(`│  🚨 Anti-Nuke Protection: ACTIVE                     │`);
    console.log(`└────────────────────────────────────────────────────────┘`);
    
    client.user.setActivity('🛡️ Premium Protection Active', { type: 3 });

    // Initialize Anti-Nuke System after bot is ready
    antiNuke = new AntiNukeSystem(client);
    client.antiNuke = antiNuke;

    // Register all slash commands globally using REST API
    try {
      console.log('🔄 Registering slash commands globally...');
      
      const rest = new REST({ version: '10' }).setToken(token);
      
      // Convert command builders to JSON format
      const commandsData = commands.map(command => command.toJSON());
      
      // Put commands to Discord API
      const data = await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandsData },
      );

      console.log(`✅ Successfully registered ${data.length} slash commands globally`);
      console.log('📢 Commands will be available in all servers within 1 hour (usually instant)');
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  });

  // Slash Command Interaction Handler
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        case 'about':
          await handlers.handleAbout(interaction);
          break;
        case 'help':
          await handlers.handleHelp(interaction);
          break;
        case 'ping':
          await handlers.handlePing(interaction);
          break;
        case 'verify':
          await handlers.handleVerify(interaction);
          break;
        case 'setup-verify':
          await handlers.handleSetupVerify(interaction);
          break;
        case 'stats':
          await handlers.handleStats(interaction);
          break;
        case 'userinfo':
          await handlers.handleUserInfo(interaction);
          break;
        case 'serverinfo':
          await handlers.handleServerInfo(interaction);
          break;
        case 'warnings':
          await handlers.handleWarnings(interaction);
          break;
        case 'modlog':
          await handlers.handleModLog(interaction);
          break;
        case 'warn':
          await handlers.handleWarn(interaction);
          break;
        case 'timeout':
          await handlers.handleTimeout(interaction);
          break;
        case 'kick':
          await handlers.handleKick(interaction);
          break;
        case 'ban':
          await handlers.handleBan(interaction);
          break;
        case 'unban':
          await handlers.handleUnban(interaction);
          break;
        case 'clearwarnings':
          await handlers.handleClearWarnings(interaction);
          break;
        case 'slowmode':
          await handlers.handleSlowmode(interaction);
          break;
        case 'purge':
          await handlers.handlePurge(interaction);
          break;
        case 'settings':
          await handlers.handleSettings(interaction);
          break;
        case 'antinuke':
          await handlers.handleAntiNuke(interaction, antiNuke);
          break;
        case 'trusted':
          await handlers.handleTrusted(interaction);
          break;
        case 'lockdown':
          await handlers.handleLockdown(interaction);
          break;
        case 'announce':
          await handlers.handleAnnounce(interaction);
          break;
        case 'role':
          await handlers.handleRole(interaction);
          break;
        case 'embed':
          await handlers.handleEmbed(interaction);
          break;
        default:
          await interaction.reply({ 
            content: '❌ Unknown command.', 
            ephemeral: true 
          });
      }
    } catch (error) {
      console.error(`Error handling command ${commandName}:`, error);
      
      const errorMessage = { 
        content: '❌ An error occurred while executing that command.', 
        ephemeral: true 
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage).catch(console.error);
      } else {
        await interaction.reply(errorMessage).catch(console.error);
      }
    }
  });

  // Message Handler for AI Moderation + Unverified User Check
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    try {
      await handleMessage(message);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Direct Message Handler for CAPTCHA Verification with Auto Role
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.guild) return;

    try {
      await handleDirectMessage(message, client);
    } catch (error) {
      console.error('Error handling DM:', error);
    }
  });

  // Guild Member Join Handler
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await handleNewMember(member);
    } catch (error) {
      console.error('Error handling new member:', error);
    }
  });

  // Global error handler
  client.on(Events.Error, (error) => {
    console.error('Discord client error:', error);
  });

  return client;
}

// ============================================
// MESSAGE HANDLING (AI MODERATION + VERIFICATION CHECK)
// ============================================
async function handleMessage(message) {
  const discordUser = message.author;
  const member = message.member;
  const guild = message.guild;

  // Skip moderation for bot owner
  if (discordUser.id === process.env.DISCORD_OWNER_ID) {
    return;
  }

  // Get server settings
  const settings = await getServerSettings(guild.id);

  // ============================================
  // VERIFICATION CHECK - Delete Unverified Messages
  // ============================================
  if (settings?.verification_enabled) {
    const verifiedRoleId = settings.verified_role_id;
    const verificationChannelId = settings.verification_channel_id;

    // Allow messages in verification channel only
    if (message.channel.id !== verificationChannelId && verifiedRoleId) {
      const hasVerifiedRole = member.roles.cache.has(verifiedRoleId);

      if (!hasVerifiedRole) {
        // User is not verified - delete their message
        try {
          if (message.deletable) {
            await message.delete();
          }

          // Send warning (auto-delete after 10 seconds)
          const warningMsg = await message.channel.send(
            `❌ <@${discordUser.id}>, you must verify first to chat here!\n\n` +
            `📝 Go to <#${verificationChannelId}> and use \`/verify\` command to get access.`
          );

          setTimeout(() => {
            warningMsg.delete().catch(console.error);
          }, 10000);

          // Get or create user in database
          const dbUser = await getOrCreateUser(discordUser, discordUser.createdAt.toISOString());

          // Log the blocked message
          await logMessage({
            messageId: message.id,
            userId: dbUser.id,
            guildId: guild.id,
            channelId: message.channel.id,
            content: message.content,
            hasAttachments: message.attachments.size > 0,
            hasLinks: detectLinks(message.content),
            hasImages: detectImages(message)
          });

          await logModerationAction({
            messageId: null,
            userId: dbUser.id,
            guildId: guild.id,
            riskScore: 30,
            riskLevel: 'SUSPICIOUS',
            detectedCategories: ['UNVERIFIED_USER'],
            recommendedAction: 'DELETE',
            actionTaken: 'DELETE',
            reasoning: 'User not verified - message blocked by verification system'
          });

          console.log(`[VERIFICATION] ❌ Blocked message from unverified user: ${discordUser.tag}`);
        } catch (error) {
          console.error('Error handling unverified user message:', error);
        }
        return; // Stop further processing
      }
    }
  }

  // ============================================
  // CONTINUE WITH NORMAL AI MODERATION
  // ============================================
  
  const accountAgeDays = calculateAccountAge(discordUser.createdAt);
  const joinAgeMinutes = member ? calculateJoinAge(member.joinedAt) : 999;

  const dbUser = await getOrCreateUser(discordUser, discordUser.createdAt.toISOString());

  if (member) {
    await getOrCreateServerMember(dbUser.id, guild.id, member.joinedAt.toISOString());
  }

  const recentMessages = await getRecentMessages(dbUser.id, guild.id, 5);
  const warnings = await getUserWarnings(dbUser.id, guild.id);

  const hasAttachments = message.attachments.size > 0;
  const hasLinks = detectLinks(message.content);
  const hasImages = detectImages(message);

  const messageLog = await logMessage({
    messageId: message.id,
    userId: dbUser.id,
    guildId: guild.id,
    channelId: message.channel.id,
    content: message.content,
    hasAttachments,
    hasLinks,
    hasImages
  });

  const moderationInput = {
    message_content: message.content,
    message_history: recentMessages.map(m => `[${m.message_length} chars]`),
    user_account_age_days: accountAgeDays,
    server_join_age_minutes: joinAgeMinutes,
    attachments_present: hasAttachments,
    links_present: hasLinks,
    image_uploaded: hasImages,
    previous_warnings_count: warnings.length,
    captcha_verified: dbUser.captcha_verified,
    user_id: discordUser.id
  };

  const moderationResult = await analyzeMessageWithGroq(moderationInput);

  console.log(
    `[AI MODERATION] User: ${discordUser.tag} | ` +
    `Risk: ${moderationResult.risk_score} (${moderationResult.risk_level}) | ` +
    `Action: ${moderationResult.recommended_action}`
  );

  const actionTaken = await executeAction(message, member, moderationResult);

  await logModerationAction({
    messageId: messageLog.id,
    userId: dbUser.id,
    guildId: guild.id,
    riskScore: moderationResult.risk_score,
    riskLevel: moderationResult.risk_level,
    detectedCategories: moderationResult.detected_categories,
    recommendedAction: moderationResult.recommended_action,
    actionTaken,
    reasoning: moderationResult.reasoning
  });

  if (actionTaken !== 'ALLOW' && actionTaken !== 'CAPTCHA') {
    const severity = moderationResult.risk_level === 'DANGEROUS' ? 'HIGH' : 'MEDIUM';
    await addWarning(dbUser.id, guild.id, null, moderationResult.reasoning, severity);
  }

  await updateAverageRiskScore(dbUser.id);
}

// ============================================
// DIRECT MESSAGE HANDLER (CAPTCHA + AUTO ROLE)
// ============================================
async function handleDirectMessage(message, client) {
  const content = message.content.trim().toUpperCase();
  
  // Check if message is a valid CAPTCHA code (6 alphanumeric characters)
  if (content.length === 6 && /^[A-Z0-9]+$/.test(content)) {
    // Verify the CAPTCHA code
    const result = await verifyCaptcha(message.author.id, content);
    
    if (result.success && result.guildId) {
      // CAPTCHA verified successfully - now assign the verified role
      try {
        const guild = client.guilds.cache.get(result.guildId);
        
        if (!guild) {
          await message.reply('✅ CAPTCHA verified! However, I couldn\'t find the server. Please contact an administrator.');
          return;
        }

        const settings = await getServerSettings(result.guildId);
        
        if (!settings?.verified_role_id) {
          await message.reply('✅ CAPTCHA verified! However, the verified role is not configured. Please contact an administrator.');
          return;
        }

        const member = await guild.members.fetch(message.author.id).catch(() => null);
        
        if (!member) {
          await message.reply('✅ CAPTCHA verified! However, you are not in the server. Please rejoin and try again.');
          return;
        }

        const verifiedRole = guild.roles.cache.get(settings.verified_role_id);
        
        if (!verifiedRole) {
          await message.reply('✅ CAPTCHA verified! However, the verified role no longer exists. Please contact an administrator.');
          return;
        }

        // Assign the verified role
        await member.roles.add(verifiedRole, 'CAPTCHA verification completed');

        console.log(`[VERIFICATION] ✅ ${message.author.tag} verified and role assigned in ${guild.name}`);

        // Send success message
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Verification Complete!')
          .setDescription(
            `**Welcome to ${guild.name}!**\n\n` +
            `🎉 You have been successfully verified!\n` +
            `🔓 You can now access all channels and chat freely.\n\n` +
            `**Role Assigned:** ${verifiedRole.name}\n` +
            `**Status:** Verified Member ✅`
          )
          .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
          .setTimestamp();

        await message.reply({ embeds: [successEmbed] });

        // Log to verification channel
        if (settings.verification_channel_id) {
          const verifyChannel = guild.channels.cache.get(settings.verification_channel_id);
          if (verifyChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('✅ New Member Verified')
              .setDescription(`${message.author} has completed CAPTCHA verification!`)
              .addFields(
                { name: '👤 User', value: message.author.tag, inline: true },
                { name: '🎖️ Role', value: verifiedRole.name, inline: true },
                { name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
              )
              .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
              .setTimestamp();

            await verifyChannel.send({ embeds: [logEmbed] });
          }
        }

      } catch (error) {
        console.error('Error assigning verified role:', error);
        await message.reply('✅ CAPTCHA verified! However, there was an error assigning your role. Please contact an administrator.');
      }
    } else {
      await message.reply(result.message || '❌ Invalid CAPTCHA code. Please try `/verify` again in the server.');
    }
  }
}

// ============================================
// NEW MEMBER HANDLER
// ============================================
async function handleNewMember(member) {
  if (member.user.id === process.env.DISCORD_OWNER_ID) {
    return;
  }

  const dbUser = await getOrCreateUser(member.user, member.user.createdAt.toISOString());
  await getOrCreateServerMember(dbUser.id, member.guild.id, member.joinedAt.toISOString());

  const settings = await getServerSettings(member.guild.id);
  
  if (settings?.captcha_enabled && settings?.verification_enabled) {
    const accountAge = calculateAccountAge(member.user.createdAt);
    
    // Require CAPTCHA for new accounts
    if (accountAge < (settings.captcha_age_threshold_days || 7)) {
      try {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle(`🎉 Welcome to ${member.guild.name}!`)
          .setDescription(
            '**Verification Required**\n\n' +
            'Your account is new. For security, please complete CAPTCHA verification.\n\n' +
            '**How to verify:**\n' +
            `1. Go to <#${settings.verification_channel_id}>\n` +
            '2. Use `/verify` command\n' +
            '3. Check your DMs for CAPTCHA\n' +
            '4. Reply with the code\n' +
            '5. Get access to all channels!\n\n' +
            '⏱️ You have 10 minutes to complete verification.'
          )
          .setFooter({ text: 'Created by Arvind Nag (RageXvenom Gamers) with ❤️' })
          .setTimestamp();

        await member.send({ embeds: [embed] });
      } catch (error) {
        console.log('Could not DM new member');
      }
    }
  }
}
