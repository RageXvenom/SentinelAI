// src/utils/helpers.js - Enhanced with CAPTCHA generation
import { createCanvas } from 'canvas';

export function calculateAccountAge(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function calculateJoinAge(joinedAt) {
  if (!joinedAt) return 999;

  const now = new Date();
  const joined = new Date(joinedAt);
  const diffMs = now - joined;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return diffMinutes;
}

export function detectLinks(content) {
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-z0-9-]+\.(com|net|org|io|gg|xyz|co|me|tv|bot|dev|app)\b)/gi;
  return urlPattern.test(content);
}

export function detectImages(message) {
  if (message.attachments.size === 0) {
    return false;
  }

  for (const attachment of message.attachments.values()) {
    const ext = attachment.name.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      return true;
    }
  }

  return false;
}

export function sanitizeUsername(username) {
  return username.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function truncateString(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function formatTimestamp(date) {
  return new Date(date).toISOString();
}

export function parseDuration(durationString) {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  const match = durationString.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const [, amount, unit] = match;
  return parseInt(amount) * units[unit];
}

export function getRiskEmoji(riskLevel) {
  switch (riskLevel) {
    case 'SAFE':
      return '✅';
    case 'SUSPICIOUS':
      return '⚠️';
    case 'DANGEROUS':
      return '🚨';
    default:
      return '❓';
  }
}

export function getActionEmoji(action) {
  switch (action) {
    case 'ALLOW':
      return '✅';
    case 'WARN':
      return '⚠️';
    case 'DELETE':
      return '🗑️';
    case 'MUTE':
      return '🔇';
    case 'KICK':
      return '🚫';
    case 'CAPTCHA':
      return '🔐';
    default:
      return '❓';
  }
}

// ============================================
// CAPTCHA IMAGE GENERATION
// ============================================

export function generateCaptchaImage(captchaCode) {
  const width = 300;
  const height = 100;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add noise
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
    ctx.fillRect(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 3,
      Math.random() * 3
    );
  }

  // Add random lines
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.3})`;
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // Draw CAPTCHA text
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = captchaCode.split('');
  const spacing = width / (chars.length + 1);

  chars.forEach((char, index) => {
    const x = spacing * (index + 1);
    const y = height / 2;
    
    // Random rotation
    const angle = (Math.random() - 0.5) * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Draw character
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char, 0, 0);
    
    // Add outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeText(char, 0, 0);
    
    ctx.restore();
  });

  // Add border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, width, height);

  return canvas.toBuffer('image/png');
}

// ============================================
// TEXT ANALYSIS UTILITIES
// ============================================

export function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function containsProfanity(text) {
  const profanityList = [
    'badword1', 'badword2', // Add your profanity list
  ];
  
  const lowerText = text.toLowerCase();
  return profanityList.some(word => lowerText.includes(word));
}

export function detectSpamPattern(text) {
  // Repeated characters
  if (/(.)\1{10,}/.test(text)) return true;
  
  // Excessive caps
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 20) return true;
  
  // Excessive emojis
  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
  if (emojiCount > 10) return true;
  
  return false;
}

export function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export function isDiscordInvite(url) {
  return /discord\.gg|discord\.com\/invite|discordapp\.com\/invite/i.test(url);
}

export function containsSuspiciousLink(text) {
  const suspiciousDomains = [
    'bit.ly',
    'tinyurl',
    'goo.gl',
    'ow.ly',
    't.co',
    'grabify',
    'iplogger'
  ];
  
  const urls = extractUrls(text);
  return urls.some(url => 
    suspiciousDomains.some(domain => url.includes(domain))
  );
}

// ============================================
// FORMAT UTILITIES
// ============================================

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function createProgressBar(current, max, length = 10) {
  const percentage = Math.min(current / max, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage * 100)}%`;
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map();

export function checkRateLimit(userId, action, limit = 5, windowMs = 60000) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }
  
  const timestamps = rateLimitMap.get(key);
  
  // Remove old timestamps
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (validTimestamps.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: validTimestamps[0] + windowMs
    };
  }
  
  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);
  
  return {
    allowed: true,
    remaining: limit - validTimestamps.length,
    resetAt: now + windowMs
  };
}

// ============================================
// PERMISSION CHECKS
// ============================================

export function hasModeratorPermissions(member) {
  return member.permissions.has('ModerateMembers') ||
         member.permissions.has('Administrator') ||
         member.permissions.has('ManageMessages');
}

export function hasAdminPermissions(member) {
  return member.permissions.has('Administrator');
}

export function canModerate(moderator, target) {
  if (!moderator || !target) return false;
  if (target.id === moderator.guild.ownerId) return false;
  
  return moderator.roles.highest.position > target.roles.highest.position;
}
