// src/database/supabase.js - Complete Database Functions with Fixed Security Logging
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

export async function getOrCreateUser(discordUser, accountCreatedAt) {
  const { data: existingUser, error: fetchError } = await supabase
    .from('discord_users')
    .select('*')
    .eq('discord_user_id', discordUser.id)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching user:', fetchError);
    throw fetchError;
  }

  if (existingUser) {
    const { data: updated } = await supabase
      .from('discord_users')
      .update({
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0'
      })
      .eq('id', existingUser.id)
      .select()
      .single();

    return updated || existingUser;
  }

  const { data: newUser, error: insertError } = await supabase
    .from('discord_users')
    .insert({
      discord_user_id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator || '0',
      account_created_at: accountCreatedAt,
      first_seen_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating user:', insertError);
    throw insertError;
  }

  return newUser;
}

export async function getOrCreateServerMember(userId, guildId, joinedAt) {
  const { data: existingMember, error: fetchError } = await supabase
    .from('server_members')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching server member:', fetchError);
    throw fetchError;
  }

  if (existingMember) {
    return existingMember;
  }

  const { data: newMember, error: insertError } = await supabase
    .from('server_members')
    .insert({
      user_id: userId,
      guild_id: guildId,
      joined_at: joinedAt,
      is_active: true
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating server member:', insertError);
    throw insertError;
  }

  return newMember;
}

// ============================================
// MESSAGE LOGGING FUNCTIONS
// ============================================

export async function logMessage(messageData) {
  const { messageId, userId, guildId, channelId, content, hasAttachments, hasLinks, hasImages } = messageData;

  const contentHash = content ? hashContent(content) : null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      message_id: messageId,
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      content_hash: contentHash,
      has_attachments: hasAttachments,
      has_links: hasLinks,
      has_images: hasImages,
      message_length: content ? content.length : 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging message:', error);
    throw error;
  }

  return data;
}

export async function getRecentMessages(userId, guildId, limit = 10) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent messages:', error);
    return [];
  }

  return data || [];
}

// ============================================
// MODERATION ACTIONS FUNCTIONS
// ============================================

export async function logModerationAction(actionData) {
  const {
    messageId,
    userId,
    guildId,
    riskScore,
    riskLevel,
    detectedCategories,
    recommendedAction,
    actionTaken,
    reasoning
  } = actionData;

  const { data, error } = await supabase
    .from('moderation_actions')
    .insert({
      message_id: messageId,
      user_id: userId,
      guild_id: guildId,
      risk_score: riskScore,
      risk_level: riskLevel,
      detected_categories: JSON.stringify(detectedCategories),
      recommended_action: recommendedAction,
      action_taken: actionTaken,
      reasoning: reasoning
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging moderation action:', error);
    throw error;
  }

  return data;
}

export async function getRecentModerationActions(guildId, limit = 20) {
  const { data, error } = await supabase
    .from('moderation_actions')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching moderation actions:', error);
    return [];
  }

  return data || [];
}

export async function getUserStats(userId, guildId) {
  const { data, error } = await supabase
    .from('discord_users')
    .select(`
      *,
      server_members!inner (
        guild_id,
        server_warnings,
        total_messages,
        joined_at,
        last_seen_at
      )
    `)
    .eq('id', userId)
    .eq('server_members.guild_id', guildId)
    .single();

  if (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }

  return data;
}

// ============================================
// WARNINGS FUNCTIONS
// ============================================

export async function getUserWarnings(userId, guildId) {
  const { data, error } = await supabase
    .from('user_warnings')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user warnings:', error);
    return [];
  }

  return data || [];
}

export async function addWarning(userId, guildId, moderationActionId, warningReason, severity = 'MEDIUM') {
  const { data, error } = await supabase
    .from('user_warnings')
    .insert({
      user_id: userId,
      guild_id: guildId,
      moderation_action_id: moderationActionId,
      warning_reason: warningReason,
      severity: severity
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding warning:', error);
    throw error;
  }

  await updateUserWarningCount(userId, guildId);

  return data;
}

export async function updateUserWarningCount(userId, guildId) {
  const warnings = await getUserWarnings(userId, guildId);
  const warningCount = warnings.length;

  await supabase
    .from('discord_users')
    .update({ total_warnings: warningCount })
    .eq('id', userId);

  await supabase
    .from('server_members')
    .update({ server_warnings: warningCount })
    .eq('user_id', userId)
    .eq('guild_id', guildId);
}

export async function clearUserWarnings(userId, guildId) {
  const { error } = await supabase
    .from('user_warnings')
    .delete()
    .eq('user_id', userId)
    .eq('guild_id', guildId);

  if (error) {
    console.error('Error clearing warnings:', error);
    throw error;
  }

  await updateUserWarningCount(userId, guildId);

  return { success: true };
}

// ============================================
// CAPTCHA FUNCTIONS
// ============================================

export async function createCaptchaSession(userId, discordUserId, guildId, captchaCode) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any existing unverified sessions
  try {
    await supabase
      .from('captcha_sessions')
      .delete()
      .eq('discord_user_id', discordUserId)
      .eq('is_verified', false);
  } catch (err) {
    console.error('Error deleting old sessions:', err);
  }

  const { data, error } = await supabase
    .from('captcha_sessions')
    .insert({
      user_id: userId,
      discord_user_id: discordUserId,
      guild_id: guildId,
      captcha_code: captchaCode.toUpperCase(),
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      max_attempts: 3,
      is_verified: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating CAPTCHA session:', error);
    throw error;
  }

  return data;
}

export async function verifyCaptcha(discordUserId, submittedCode, client = null) {
  try {
    // Find the most recent unverified CAPTCHA session
    const { data: session, error } = await supabase
      .from('captcha_sessions')
      .select('*')
      .eq('discord_user_id', discordUserId)
      .eq('is_verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !session) {
      return { 
        success: false, 
        message: 'No active CAPTCHA session found. Please use `/verify` command again.',
        guildId: null
      };
    }

    // Check if max attempts exceeded
    if (session.attempts >= session.max_attempts) {
      return { 
        success: false, 
        message: 'Maximum verification attempts exceeded. Please use `/verify` command again.',
        guildId: null
      };
    }

    // Check if code matches (case-insensitive)
    if (session.captcha_code !== submittedCode.toUpperCase()) {
      // Increment attempts
      await supabase
        .from('captcha_sessions')
        .update({ attempts: session.attempts + 1 })
        .eq('id', session.id);

      const remainingAttempts = session.max_attempts - (session.attempts + 1);
      return { 
        success: false, 
        message: `Incorrect code. You have ${remainingAttempts} attempt(s) remaining.`,
        guildId: null
      };
    }

    // Code is correct - mark as verified
    const { error: updateError } = await supabase
      .from('captcha_sessions')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Error marking CAPTCHA as verified:', updateError);
      throw updateError;
    }

    // Update user's CAPTCHA verified status
    await supabase
      .from('discord_users')
      .update({
        captcha_verified: true,
        captcha_verified_at: new Date().toISOString()
      })
      .eq('discord_user_id', discordUserId);

    return { 
      success: true, 
      message: 'CAPTCHA verified successfully!',
      guildId: session.guild_id // Return guild ID for role assignment
    };

  } catch (error) {
    console.error('Error verifying CAPTCHA:', error);
    return { 
      success: false, 
      message: 'An error occurred during verification.',
      guildId: null
    };
  }
}


// ============================================
// SERVER SETTINGS FUNCTIONS
// ============================================

export async function getServerSettings(guildId) {
  const { data, error } = await supabase
    .from('server_settings')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching server settings:', error);
    return null;
  }

  if (!data) {
    return await createDefaultServerSettings(guildId);
  }

  return data;
}

export async function createDefaultServerSettings(guildId) {
  const { data, error } = await supabase
    .from('server_settings')
    .insert({
      guild_id: guildId,
      auto_moderation_enabled: true,
      captcha_enabled: true,
      captcha_age_threshold_days: 7,
      spam_detection_enabled: true,
      link_detection_enabled: true,
      max_warnings_before_kick: 3,
      max_warnings_before_ban: 5,
      verification_enabled: true,
      verification_channel_id: null,
      verified_role_id: null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating default settings:', error);
    return null;
  }

  return data;
}

export async function updateServerSettings(guildId, settings) {
  await getServerSettings(guildId);

  const { data, error } = await supabase
    .from('server_settings')
    .update(settings)
    .eq('guild_id', guildId)
    .select()
    .single();

  if (error) {
    console.error('Error updating server settings:', error);
    throw error;
  }

  return data;
}

// ============================================
// ANTI-NUKE FUNCTIONS
// ============================================

export async function getAntiNukeSettings(guildId) {
  const { data, error } = await supabase
    .from('antinuke_settings')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching anti-nuke settings:', error);
    return null;
  }

  if (!data) {
    return await createDefaultAntiNukeSettings(guildId);
  }

  return data;
}

export async function createDefaultAntiNukeSettings(guildId) {
  const { data, error } = await supabase
    .from('antinuke_settings')
    .insert({
      guild_id: guildId,
      enabled: true,
      channel_delete_limit: 3,
      channel_create_limit: 5,
      role_delete_limit: 3,
      role_create_limit: 5,
      ban_limit: 3,
      kick_limit: 5,
      webhook_create_limit: 3,
      member_prune_limit: 10,
      time_window: 10000,
      punishment_type: 'BAN',
      notify_owner: true,
      lockdown_on_trigger: true,
      whitelist: []
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating anti-nuke settings:', error);
    return null;
  }

  return data;
}

export async function updateAntiNukeSettings(guildId, settings) {
  await getAntiNukeSettings(guildId);

  const { data, error } = await supabase
    .from('antinuke_settings')
    .update(settings)
    .eq('guild_id', guildId)
    .select()
    .single();

  if (error) {
    console.error('Error updating anti-nuke settings:', error);
    throw error;
  }

  return data;
}

// ============================================
// TRUSTED USERS FUNCTIONS
// ============================================

export async function getTrustedUsers(guildId) {
  const { data, error } = await supabase
    .from('trusted_users')
    .select('*, discord_users(username, discord_user_id)')
    .eq('guild_id', guildId)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching trusted users:', error);
    return [];
  }

  return data || [];
}

export async function addTrustedUser(guildId, userId, addedBy, reason = null) {
  const { data, error } = await supabase
    .from('trusted_users')
    .insert({
      guild_id: guildId,
      user_id: userId,
      added_by: addedBy,
      reason: reason
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('User is already trusted');
      return { success: true, message: 'User is already trusted' };
    }
    console.error('Error adding trusted user:', error);
    throw error;
  }

  return data;
}

export async function removeTrustedUser(guildId, userId) {
  const { error } = await supabase
    .from('trusted_users')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing trusted user:', error);
    throw error;
  }

  return { success: true };
}

export async function isTrustedUser(guildId, discordUserId) {
  // First get the internal user_id from discord_user_id
  const { data: userData, error: userError } = await supabase
    .from('discord_users')
    .select('id')
    .eq('discord_user_id', discordUserId)
    .maybeSingle();

  if (userError || !userData) {
    return false;
  }

  const { data, error } = await supabase
    .from('trusted_users')
    .select('id')
    .eq('guild_id', guildId)
    .eq('user_id', userData.id)
    .maybeSingle();

  if (error) {
    console.error('Error checking trusted user:', error);
    return false;
  }

  return !!data;
}

// ============================================
// SECURITY EVENTS FUNCTIONS (FIXED)
// ============================================

export async function logSecurityEvent(eventData) {
  const { guildId, userId, eventType, severity, details, actionTaken } = eventData;

  try {
    // CRITICAL FIX: userId here is a Discord snowflake ID, not the internal UUID
    // We need to look up the internal user_id from the discord_users table
    
    let internalUserId = null;
    
    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from('discord_users')
        .select('id')
        .eq('discord_user_id', userId)
        .maybeSingle();

      if (userError) {
        console.error('[SECURITY] Error looking up user for security event:', userError.message);
        // Continue without user_id rather than failing completely
      } else if (userData) {
        internalUserId = userData.id;
      } else {
        console.log(`[SECURITY] User ${userId} not found in database, logging event without user_id`);
      }
    }

    // Insert security event with the internal UUID (or null if not found)
    const { data, error } = await supabase
      .from('security_events')
      .insert({
        guild_id: guildId,
        user_id: internalUserId, // This is now the UUID from discord_users.id
        event_type: eventType,
        severity: severity,
        details: details,
        action_taken: actionTaken
      })
      .select()
      .single();

    if (error) {
      console.error('[SECURITY] Error inserting security event:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[SECURITY] Error in logSecurityEvent:', error);
    throw error;
  }
}

export async function getSecurityLogs(guildId, limit = 20) {
  const { data, error } = await supabase
    .from('security_events')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching security logs:', error);
    return [];
  }

  return data || [];
}

export async function getSecurityLogsByType(guildId, eventType, limit = 20) {
  const { data, error } = await supabase
    .from('security_events')
    .select('*')
    .eq('guild_id', guildId)
    .eq('event_type', eventType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching security logs by type:', error);
    return [];
  }

  return data || [];
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

export async function getServerStats(guildId) {
  const stats = {
    total_members: 0,
    total_actions: 0,
    total_warnings: 0,
    total_messages: 0,
    ai_moderations: 0,
    security_events: 0
  };

  try {
    const { count: memberCount } = await supabase
      .from('server_members')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId)
      .eq('is_active', true);
    stats.total_members = memberCount || 0;

    const { count: actionCount } = await supabase
      .from('moderation_actions')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    stats.total_actions = actionCount || 0;

    const { count: warningCount } = await supabase
      .from('user_warnings')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    stats.total_warnings = warningCount || 0;

    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    stats.total_messages = messageCount || 0;

    const { count: aiCount } = await supabase
      .from('moderation_actions')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId)
      .neq('action_taken', 'ALLOW');
    stats.ai_moderations = aiCount || 0;

    const { count: securityCount } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    stats.security_events = securityCount || 0;
  } catch (err) {
    console.error('Error in stats calculation:', err);
  }

  return stats;
}

export async function updateAverageRiskScore(userId) {
  const { data: actions } = await supabase
    .from('moderation_actions')
    .select('risk_score')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!actions || actions.length === 0) return;

  const avgScore = actions.reduce((sum, a) => sum + a.risk_score, 0) / actions.length;

  await supabase
    .from('discord_users')
    .update({ average_risk_score: avgScore.toFixed(2) })
    .eq('id', userId);
}



// ============================================
// CAPTCHA CLEANUP
// ============================================

export async function cleanExpiredCaptchaSessions() {
  try {
    const { error } = await supabase
      .from('captcha_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('is_verified', false);

    if (error) {
      console.error('Error cleaning expired CAPTCHA sessions:', error);
    } else {
      console.log('✅ Cleaned up expired CAPTCHA sessions');
    }
  } catch (error) {
    console.error('Error in cleanExpiredCaptchaSessions:', error);
  }
}

export function startCaptchaCleanup() {
  // Run cleanup every hour
  setInterval(() => {
    cleanExpiredCaptchaSessions();
  }, 60 * 60 * 1000);

  console.log('🔄 CAPTCHA cleanup scheduler started');
}

// ============================================
// RATE LIMITING
// ============================================

export async function checkRateLimit(userId, action, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const windowStart = new Date(now - windowMs).toISOString();

  const { count, error } = await supabase
    .from('moderation_actions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_taken', action)
    .gte('created_at', windowStart);

  if (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, remaining: limit };
  }

  const remaining = Math.max(0, limit - (count || 0));
  
  return {
    allowed: (count || 0) < limit,
    remaining: remaining,
    resetAt: now + windowMs
  };
}
