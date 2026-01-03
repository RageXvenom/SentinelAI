// src/security/antinuke.js - Premium Anti-Nuke Protection System
import { PermissionFlagsBits, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { 
  logSecurityEvent, 
  checkRateLimit, 
  addTrustedUser, 
  removeTrustedUser,
  getTrustedUsers,
  updateAntiNukeSettings,
  getAntiNukeSettings
} from '../database/supabase.js';

// Action tracking for rate limiting
const actionTracker = new Map();

// Default anti-nuke settings
const DEFAULT_SETTINGS = {
  enabled: true,
  channelDeleteLimit: 3,
  channelCreateLimit: 5,
  roleDeleteLimit: 3,
  roleCreateLimit: 5,
  banLimit: 3,
  kickLimit: 5,
  webhookCreateLimit: 3,
  memberPruneLimit: 10,
  timeWindow: 10000, // 10 seconds
  punishmentType: 'BAN', // BAN, KICK, STRIP_ROLES
  notifyOwner: true,
  lockdownOnTrigger: true,
  whitelist: [],
  nightmodeEnabled: false,
  nightmodeStartHour: 23, // 11 PM
  nightmodeEndHour: 7, // 7 AM
  nightmodeTimezone: 'UTC',
  nightmodeStricterLimits: true,
  nightmodeAutoLock: true,
  nightmodeChannelDeleteLimit: 1,
  nightmodeChannelCreateLimit: 2,
  nightmodeRoleDeleteLimit: 1,
  nightmodeRoleCreateLimit: 2,
  nightmodeBanLimit: 1,
  nightmodeKickLimit: 2,
  nightmodeWebhookCreateLimit: 1
};

export class AntiNukeSystem {
  constructor(client) {
    this.client = client;
    this.settings = new Map();
    this.setupListeners();
  }

  setupListeners() {
    // Channel Delete Protection
    this.client.on('channelDelete', async (channel) => {
      await this.handleChannelDelete(channel);
    });

    // Channel Create Protection
    this.client.on('channelCreate', async (channel) => {
      await this.handleChannelCreate(channel);
    });

    // Role Delete Protection
    this.client.on('roleDelete', async (role) => {
      await this.handleRoleDelete(role);
    });

    // Role Create Protection
    this.client.on('roleCreate', async (role) => {
      await this.handleRoleCreate(role);
    });

    // Ban Protection
    this.client.on('guildBanAdd', async (ban) => {
      await this.handleBan(ban);
    });

    // Kick Protection
    this.client.on('guildMemberRemove', async (member) => {
      await this.handleMemberRemove(member);
    });

    // Webhook Create Protection
    this.client.on('webhookUpdate', async (channel) => {
      await this.handleWebhookUpdate(channel);
    });

    // Role Update Protection (permissions escalation)
    this.client.on('roleUpdate', async (oldRole, newRole) => {
      await this.handleRoleUpdate(oldRole, newRole);
    });

    // Guild Update Protection (vanity URL, name changes)
    this.client.on('guildUpdate', async (oldGuild, newGuild) => {
      await this.handleGuildUpdate(oldGuild, newGuild);
    });

    // Bot Add Protection
    this.client.on('guildMemberAdd', async (member) => {
      if (member.user.bot) {
        await this.handleBotAdd(member);
      }
    });
  }

  async getSettings(guildId) {
    if (this.settings.has(guildId)) {
      return this.settings.get(guildId);
    }

    const dbSettings = await getAntiNukeSettings(guildId);
    const settings = dbSettings || DEFAULT_SETTINGS;
    this.settings.set(guildId, settings);
    return settings;
  }

  isNightMode(settings) {
    if (!settings.nightmodeEnabled) return false;

    try {
      // Get current time in the specified timezone
      const now = new Date();
      const timezone = settings.nightmodeTimezone || 'UTC';
      
      // Create date formatter for the timezone
      const timeString = now.toLocaleString('en-US', { 
        timeZone: timezone, 
        hour12: false, 
        hour: '2-digit' 
      });
      
      const currentHour = parseInt(timeString.split(':')[0] || timeString);
      const startHour = settings.nightmodeStartHour || 23;
      const endHour = settings.nightmodeEndHour || 7;

      // Handle overnight periods (e.g., 23:00 to 07:00)
      if (startHour > endHour) {
        return currentHour >= startHour || currentHour < endHour;
      } else {
        // Handle same-day periods (e.g., 01:00 to 05:00)
        return currentHour >= startHour && currentHour < endHour;
      }
    } catch (error) {
      console.error('[ANTI-NUKE] Error checking night mode:', error);
      return false;
    }
  }

  getEffectiveLimit(settings, limitType) {
    const isNight = this.isNightMode(settings);
    
    if (!isNight || !settings.nightmodeStricterLimits) {
      return settings[limitType];
    }

    // During night mode, use stricter limits
    const nightModeLimitKey = `nightmode${limitType.charAt(0).toUpperCase() + limitType.slice(1)}`;
    return settings[nightModeLimitKey] || settings[limitType];
  }

  async isWhitelisted(guildId, userId) {
    const settings = await this.getSettings(guildId);
    const trustedUsers = await getTrustedUsers(guildId);
    
    return settings.whitelist.includes(userId) || 
           trustedUsers.some(u => u.discord_user_id === userId);
  }

  async trackAction(guildId, userId, actionType) {
    const key = `${guildId}-${userId}-${actionType}`;
    const now = Date.now();
    
    if (!actionTracker.has(key)) {
      actionTracker.set(key, []);
    }

    const actions = actionTracker.get(key);
    const settings = await this.getSettings(guildId);
    
    // Remove old actions outside time window
    const validActions = actions.filter(time => now - time < settings.timeWindow);
    validActions.push(now);
    
    actionTracker.set(key, validActions);
    
    return validActions.length;
  }

  async handleChannelDelete(channel) {
    if (!channel.guild) return;
    
    const settings = await this.getSettings(channel.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'channelDeleteLimit');

    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 1
      });

      const deleteLog = auditLogs.entries.first();
      if (!deleteLog) return;

      const { executor } = deleteLog;
      if (!executor) return;

      // Check if user is whitelisted
      if (await this.isWhitelisted(channel.guild.id, executor.id)) {
        console.log(`[ANTI-NUKE] ${executor.tag} is whitelisted - allowing channel delete`);
        return;
      }

      // Track action
      const count = await this.trackAction(channel.guild.id, executor.id, 'CHANNEL_DELETE');

      console.log(`[ANTI-NUKE] ${isNight ? '🌙 NIGHT MODE' : ''} ${executor.tag} deleted channel: ${count}/${limit}`);

      if (count >= limit) {
        await this.punishUser(channel.guild, executor, 'CHANNEL_DELETE', count, isNight);
        
        // Attempt to restore channel
        await this.restoreChannel(channel);
      }

      await logSecurityEvent({
        guildId: channel.guild.id,
        userId: executor.id,
        eventType: 'CHANNEL_DELETE',
        severity: count >= limit ? 'CRITICAL' : 'HIGH',
        details: {
          channelName: channel.name,
          channelId: channel.id,
          actionCount: count,
          nightMode: isNight,
          limit: limit
        }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling channel delete:', error);
    }
  }

  async handleChannelCreate(channel) {
    if (!channel.guild) return;
    
    const settings = await this.getSettings(channel.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'channelCreateLimit');

    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelCreate,
        limit: 1
      });

      const createLog = auditLogs.entries.first();
      if (!createLog) return;

      const { executor } = createLog;
      if (!executor || await this.isWhitelisted(channel.guild.id, executor.id)) return;

      const count = await this.trackAction(channel.guild.id, executor.id, 'CHANNEL_CREATE');

      if (count >= limit) {
        await this.punishUser(channel.guild, executor, 'CHANNEL_CREATE', count, isNight);
        await channel.delete('Anti-Nuke: Excessive channel creation');
      }

      await logSecurityEvent({
        guildId: channel.guild.id,
        userId: executor.id,
        eventType: 'CHANNEL_CREATE',
        severity: count >= limit ? 'CRITICAL' : 'MEDIUM',
        details: { channelName: channel.name, actionCount: count, nightMode: isNight, limit: limit }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling channel create:', error);
    }
  }

  async handleRoleDelete(role) {
    const settings = await this.getSettings(role.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'roleDeleteLimit');

    try {
      const auditLogs = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleDelete,
        limit: 1
      });

      const deleteLog = auditLogs.entries.first();
      if (!deleteLog) return;

      const { executor } = deleteLog;
      if (!executor || await this.isWhitelisted(role.guild.id, executor.id)) return;

      const count = await this.trackAction(role.guild.id, executor.id, 'ROLE_DELETE');

      if (count >= limit) {
        await this.punishUser(role.guild, executor, 'ROLE_DELETE', count, isNight);
        await this.restoreRole(role);
      }

      await logSecurityEvent({
        guildId: role.guild.id,
        userId: executor.id,
        eventType: 'ROLE_DELETE',
        severity: 'CRITICAL',
        details: { roleName: role.name, actionCount: count, nightMode: isNight, limit: limit }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling role delete:', error);
    }
  }

  async handleRoleCreate(role) {
    const settings = await this.getSettings(role.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'roleCreateLimit');

    try {
      const auditLogs = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleCreate,
        limit: 1
      });

      const createLog = auditLogs.entries.first();
      if (!createLog) return;

      const { executor } = createLog;
      if (!executor || await this.isWhitelisted(role.guild.id, executor.id)) return;

      const count = await this.trackAction(role.guild.id, executor.id, 'ROLE_CREATE');

      if (count >= limit) {
        await this.punishUser(role.guild, executor, 'ROLE_CREATE', count, isNight);
        await role.delete('Anti-Nuke: Excessive role creation');
      }

      await logSecurityEvent({
        guildId: role.guild.id,
        userId: executor.id,
        eventType: 'ROLE_CREATE',
        severity: count >= limit ? 'HIGH' : 'MEDIUM',
        details: { roleName: role.name, actionCount: count, nightMode: isNight, limit: limit }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling role create:', error);
    }
  }

  async handleBan(ban) {
    const settings = await this.getSettings(ban.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'banLimit');

    try {
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 1
      });

      const banLog = auditLogs.entries.first();
      if (!banLog) return;

      const { executor } = banLog;
      if (!executor || await this.isWhitelisted(ban.guild.id, executor.id)) return;

      const count = await this.trackAction(ban.guild.id, executor.id, 'BAN');

      if (count >= limit) {
        await this.punishUser(ban.guild, executor, 'MASS_BAN', count, isNight);
        
        // Unban the victim
        await ban.guild.members.unban(ban.user.id, 'Anti-Nuke: Undoing malicious ban');
      }

      await logSecurityEvent({
        guildId: ban.guild.id,
        userId: executor.id,
        eventType: 'MASS_BAN',
        severity: 'CRITICAL',
        details: { 
          bannedUser: ban.user.tag,
          actionCount: count,
          nightMode: isNight,
          limit: limit
        }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling ban:', error);
    }
  }

  async handleMemberRemove(member) {
    const settings = await this.getSettings(member.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'kickLimit');

    try {
      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 1
      });

      const kickLog = auditLogs.entries.first();
      if (!kickLog || kickLog.target.id !== member.id) return;

      const { executor } = kickLog;
      if (!executor || await this.isWhitelisted(member.guild.id, executor.id)) return;

      const count = await this.trackAction(member.guild.id, executor.id, 'KICK');

      if (count >= limit) {
        await this.punishUser(member.guild, executor, 'MASS_KICK', count, isNight);
      }

      await logSecurityEvent({
        guildId: member.guild.id,
        userId: executor.id,
        eventType: 'MASS_KICK',
        severity: 'HIGH',
        details: { 
          kickedUser: member.user.tag,
          actionCount: count,
          nightMode: isNight,
          limit: limit
        }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling member remove:', error);
    }
  }

  async handleWebhookUpdate(channel) {
    if (!channel.guild) return;
    
    const settings = await this.getSettings(channel.guild.id);
    if (!settings.enabled) return;

    const isNight = this.isNightMode(settings);
    const limit = this.getEffectiveLimit(settings, 'webhookCreateLimit');

    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.WebhookCreate,
        limit: 1
      });

      const webhookLog = auditLogs.entries.first();
      if (!webhookLog) return;

      const { executor } = webhookLog;
      if (!executor || await this.isWhitelisted(channel.guild.id, executor.id)) return;

      const count = await this.trackAction(channel.guild.id, executor.id, 'WEBHOOK_CREATE');

      if (count >= limit) {
        await this.punishUser(channel.guild, executor, 'WEBHOOK_SPAM', count, isNight);
        
        // Delete all webhooks in channel
        const webhooks = await channel.fetchWebhooks();
        for (const webhook of webhooks.values()) {
          await webhook.delete('Anti-Nuke: Malicious webhook');
        }
      }

      await logSecurityEvent({
        guildId: channel.guild.id,
        userId: executor.id,
        eventType: 'WEBHOOK_SPAM',
        severity: 'HIGH',
        details: { channelName: channel.name, actionCount: count, nightMode: isNight, limit: limit }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling webhook update:', error);
    }
  }

  async handleRoleUpdate(oldRole, newRole) {
    const settings = await this.getSettings(newRole.guild.id);
    if (!settings.enabled) return;

    // Check for dangerous permission additions
    const dangerousPerms = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers
    ];

    const oldPerms = oldRole.permissions.toArray();
    const newPerms = newRole.permissions.toArray();
    const addedPerms = newPerms.filter(p => !oldPerms.includes(p));

    const hasDangerousPerms = addedPerms.some(p => 
      dangerousPerms.includes(PermissionFlagsBits[p])
    );

    if (!hasDangerousPerms) return;

    try {
      const auditLogs = await newRole.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleUpdate,
        limit: 1
      });

      const updateLog = auditLogs.entries.first();
      if (!updateLog) return;

      const { executor } = updateLog;
      if (!executor || await this.isWhitelisted(newRole.guild.id, executor.id)) return;

      await this.punishUser(newRole.guild, executor, 'PERMISSION_ESCALATION', 1);
      
      // Revert role permissions
      await newRole.setPermissions(oldRole.permissions, 'Anti-Nuke: Reverting unauthorized permission changes');

      await logSecurityEvent({
        guildId: newRole.guild.id,
        userId: executor.id,
        eventType: 'PERMISSION_ESCALATION',
        severity: 'CRITICAL',
        details: {
          roleName: newRole.name,
          addedPermissions: addedPerms
        }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling role update:', error);
    }
  }

  async handleGuildUpdate(oldGuild, newGuild) {
    const settings = await this.getSettings(newGuild.id);
    if (!settings.enabled) return;

    const changes = [];
    
    if (oldGuild.name !== newGuild.name) {
      changes.push({ type: 'NAME_CHANGE', old: oldGuild.name, new: newGuild.name });
    }
    
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      changes.push({ type: 'VANITY_CHANGE', old: oldGuild.vanityURLCode, new: newGuild.vanityURLCode });
    }

    if (changes.length === 0) return;

    try {
      const auditLogs = await newGuild.fetchAuditLogs({
        type: AuditLogEvent.GuildUpdate,
        limit: 1
      });

      const updateLog = auditLogs.entries.first();
      if (!updateLog) return;

      const { executor } = updateLog;
      if (!executor || await this.isWhitelisted(newGuild.id, executor.id)) return;

      await this.punishUser(newGuild, executor, 'GUILD_MODIFICATION', 1);

      // Attempt to revert changes
      if (changes.some(c => c.type === 'NAME_CHANGE')) {
        await newGuild.setName(oldGuild.name, 'Anti-Nuke: Reverting unauthorized name change');
      }

      await logSecurityEvent({
        guildId: newGuild.id,
        userId: executor.id,
        eventType: 'GUILD_MODIFICATION',
        severity: 'CRITICAL',
        details: { changes }
      });

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling guild update:', error);
    }
  }

  async handleBotAdd(member) {
    const settings = await this.getSettings(member.guild.id);
    if (!settings.enabled) return;

    try {
      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.BotAdd,
        limit: 1
      });

      const botLog = auditLogs.entries.first();
      if (!botLog) return;

      const { executor } = botLog;
      if (!executor || await this.isWhitelisted(member.guild.id, executor.id)) return;

      // Check if bot has dangerous permissions
      const botPerms = member.permissions.toArray();
      const dangerousPerms = [
        'Administrator',
        'ManageGuild',
        'ManageRoles',
        'BanMembers',
        'KickMembers'
      ];

      const hasDangerous = botPerms.some(p => dangerousPerms.includes(p));

      if (hasDangerous) {
        await this.punishUser(member.guild, executor, 'DANGEROUS_BOT_ADD', 1);
        await member.kick('Anti-Nuke: Unauthorized bot with dangerous permissions');

        await logSecurityEvent({
          guildId: member.guild.id,
          userId: executor.id,
          eventType: 'DANGEROUS_BOT_ADD',
          severity: 'CRITICAL',
          details: {
            botName: member.user.tag,
            botId: member.user.id,
            permissions: botPerms
          }
        });
      }

    } catch (error) {
      console.error('[ANTI-NUKE] Error handling bot add:', error);
    }
  }

  async punishUser(guild, user, reason, actionCount) {
    const settings = await this.getSettings(guild.id);
    
    try {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Don't punish server owner
      if (member.id === guild.ownerId) {
        console.log('[ANTI-NUKE] Cannot punish server owner');
        return;
      }

      const isNight = this.isNightMode(settings);

      console.log(`[ANTI-NUKE] 🚨 ${isNight ? '🌙 NIGHT MODE' : ''} PUNISHING ${user.tag} for ${reason} (${actionCount} actions)`);

      // Strip dangerous roles first
      const dangerousRoles = member.roles.cache.filter(role => 
        role.permissions.has(PermissionFlagsBits.Administrator) ||
        role.permissions.has(PermissionFlagsBits.ManageGuild) ||
        role.permissions.has(PermissionFlagsBits.ManageRoles)
      );

      for (const role of dangerousRoles.values()) {
        await member.roles.remove(role, `Anti-Nuke: Removing dangerous role due to ${reason}`);
      }

      // Apply punishment based on settings
      switch (settings.punishmentType) {
        case 'BAN':
          await member.ban({ 
            reason: `Anti-Nuke${isNight ? ' [NIGHT MODE]' : ''}: ${reason} - ${actionCount} malicious actions detected` 
          });
          break;

        case 'KICK':
          await member.kick(`Anti-Nuke${isNight ? ' [NIGHT MODE]' : ''}: ${reason}`);
          break;

        case 'STRIP_ROLES':
          await member.roles.set([], `Anti-Nuke${isNight ? ' [NIGHT MODE]' : ''}: ${reason}`);
          break;
      }

      // Notify owner
      if (settings.notifyOwner) {
        await this.notifyOwner(guild, user, reason, actionCount, isNight);
      }

      // Lockdown if enabled (more aggressive in night mode)
      if (settings.lockdownOnTrigger || (isNight && settings.nightmodeAutoLock)) {
        await this.initiateServerLockdown(guild, reason, isNight);
      }

    } catch (error) {
      console.error('[ANTI-NUKE] Error punishing user:', error);
    }
  }

  async restoreChannel(channel) {
    try {
      await channel.guild.channels.create({
        name: channel.name,
        type: channel.type,
        parent: channel.parent,
        permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({
          id: o.id,
          allow: o.allow.bitfield,
          deny: o.deny.bitfield
        })),
        position: channel.position,
        reason: 'Anti-Nuke: Restoring deleted channel'
      });

      console.log(`[ANTI-NUKE] ✅ Restored channel: ${channel.name}`);
    } catch (error) {
      console.error('[ANTI-NUKE] Error restoring channel:', error);
    }
  }

  async restoreRole(role) {
    try {
      await role.guild.roles.create({
        name: role.name,
        color: role.color,
        permissions: role.permissions,
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position,
        reason: 'Anti-Nuke: Restoring deleted role'
      });

      console.log(`[ANTI-NUKE] ✅ Restored role: ${role.name}`);
    } catch (error) {
      console.error('[ANTI-NUKE] Error restoring role:', error);
    }
  }

  async notifyOwner(guild, attacker, reason, actionCount, isNightMode = false) {
    try {
      const owner = await guild.fetchOwner();
      
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🚨 ANTI-NUKE ALERT ${isNightMode ? '🌙 NIGHT MODE' : ''} - SERVER UNDER ATTACK`)
        .setDescription(`**Threat Detected and Neutralized**`)
        .addFields(
          { name: '⚠️ Threat Type', value: reason, inline: true },
          { name: '👤 Attacker', value: `${attacker.tag} (${attacker.id})`, inline: true },
          { name: '🔢 Actions Detected', value: actionCount.toString(), inline: true },
          { name: '🛡️ Action Taken', value: 'User punished and permissions revoked', inline: false },
          { name: '📊 Server Status', value: 'Protected and Monitored', inline: true },
          { name: '⏰ Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: 'Premium Anti-Nuke System by Arvind Nag' })
        .setTimestamp();

      if (isNightMode) {
        embed.addFields({
          name: '🌙 Night Mode Active',
          value: 'Enhanced protection during off-hours - Stricter limits are in effect',
          inline: false
        });
      }

      await owner.send({ embeds: [embed] }).catch(() => 
        console.log('[ANTI-NUKE] Could not DM owner')
      );

    } catch (error) {
      console.error('[ANTI-NUKE] Error notifying owner:', error);
    }
  }

  async initiateServerLockdown(guild, reason) {
    try {
      const settings = await this.getSettings(guild.id);
      const isNight = this.isNightMode(settings);
      
      console.log(`[ANTI-NUKE] 🔒 ${isNight ? '🌙 NIGHT MODE' : ''} Initiating server lockdown due to ${reason}`);

      // Lock all text channels
      const channels = guild.channels.cache.filter(c => c.isTextBased());
      
      for (const channel of channels.values()) {
        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: false
        }, { reason: `Anti-Nuke${isNight ? ' [NIGHT MODE]' : ''} Lockdown: ${reason}` });
      }

      // Create lockdown notification channel
      const lockdownChannel = await guild.channels.create({
        name: isNight ? '🌙-night-lockdown' : '🔒-server-lockdown',
        reason: `Anti-Nuke${isNight ? ' [NIGHT MODE]' : ''}: Lockdown notification channel`
      });

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔒 SERVER LOCKDOWN ACTIVATED ${isNight ? '🌙 NIGHT MODE' : ''}`)
        .setDescription(
          '**The server has been automatically locked down by the Anti-Nuke system.**\n\n' +
          `**Reason:** ${reason}\n\n` +
          (isNight ? '**🌙 Night Mode Protection:** Extra strict protection is active during off-hours.\n\n' : '') +
          '**What happened:**\n' +
          '• Malicious activity was detected\n' +
          '• The threat has been neutralized\n' +
          '• All channels have been temporarily locked\n' +
          (isNight ? '• Night mode stricter limits were triggered\n' : '') +
          '\n**What to do:**\n' +
          '• Server staff will review the situation\n' +
          '• Channels will be unlocked once verified safe\n' +
          '• Please remain calm and patient\n\n' +
          '**For administrators:** Use `/antinuke unlock` to lift lockdown'
        )
        .setFooter({ text: 'Premium Anti-Nuke Protection' })
        .setTimestamp();

      await lockdownChannel.send({ embeds: [embed] });

    } catch (error) {
      console.error('[ANTI-NUKE] Error initiating lockdown:', error);
    }
  }

  async unlockServer(guild) {
    try {
      console.log('[ANTI-NUKE] 🔓 Unlocking server');

      const channels = guild.channels.cache.filter(c => c.isTextBased());
      
      for (const channel of channels.values()) {
        if (channel.name === '🔒-server-lockdown' || channel.name === '🌙-night-lockdown') {
          await channel.delete('Anti-Nuke: Removing lockdown channel');
          continue;
        }

        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: null
        }, { reason: 'Anti-Nuke: Lockdown lifted' });
      }

      return true;
    } catch (error) {
      console.error('[ANTI-NUKE] Error unlocking server:', error);
      return false;
    }
  }
}

export function getActionEmoji(action) {
  const emojis = {
    'CHANNEL_DELETE': '🗑️',
    'CHANNEL_CREATE': '➕',
    'ROLE_DELETE': '🔴',
    'ROLE_CREATE': '🟢',
    'MASS_BAN': '🔨',
    'MASS_KICK': '👢',
    'WEBHOOK_SPAM': '🎣',
    'PERMISSION_ESCALATION': '⬆️',
    'GUILD_MODIFICATION': '⚙️',
    'DANGEROUS_BOT_ADD': '🤖'
  };

  return emojis[action] || '⚠️';
}
