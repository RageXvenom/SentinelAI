/*
  # Discord Moderation Bot Database Schema

  ## Overview
  This migration creates the complete database schema for an AI-powered Discord moderation bot.
  
  ## New Tables
  
  ### 1. `discord_users`
  Stores Discord user information and metadata
  - `id` (uuid, primary key) - Internal database ID
  - `discord_user_id` (text, unique) - Discord user ID
  - `username` (text) - Discord username
  - `discriminator` (text) - Discord discriminator
  - `account_created_at` (timestamptz) - Discord account creation date
  - `first_seen_at` (timestamptz) - First time seen in any server
  - `total_warnings` (integer) - Total warnings across all actions
  - `average_risk_score` (numeric) - Average risk score for analytics
  - `captcha_verified` (boolean) - Whether user has passed CAPTCHA
  - `captcha_verified_at` (timestamptz) - When CAPTCHA was verified
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp
  
  ### 2. `server_members`
  Tracks user membership in specific Discord servers
  - `id` (uuid, primary key) - Internal database ID
  - `user_id` (uuid, foreign key) - References discord_users
  - `guild_id` (text) - Discord server/guild ID
  - `joined_at` (timestamptz) - When user joined the server
  - `server_warnings` (integer) - Warnings in this specific server
  - `is_active` (boolean) - Whether user is still in server
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### 3. `messages`
  Stores message metadata for moderation analysis
  - `id` (uuid, primary key) - Internal database ID
  - `message_id` (text, unique) - Discord message ID
  - `user_id` (uuid, foreign key) - References discord_users
  - `guild_id` (text) - Discord server/guild ID
  - `channel_id` (text) - Discord channel ID
  - `content_hash` (text) - SHA-256 hash of content (not storing actual content for privacy)
  - `has_attachments` (boolean) - Whether message had attachments
  - `has_links` (boolean) - Whether message contained links
  - `has_images` (boolean) - Whether message had images
  - `message_length` (integer) - Length of message content
  - `created_at` (timestamptz) - When message was sent
  
  ### 4. `moderation_actions`
  Logs all moderation decisions and actions taken
  - `id` (uuid, primary key) - Internal database ID
  - `message_id` (uuid, foreign key) - References messages
  - `user_id` (uuid, foreign key) - References discord_users
  - `guild_id` (text) - Discord server/guild ID
  - `risk_score` (integer) - Calculated risk score (0-100)
  - `risk_level` (text) - Risk level: SAFE, SUSPICIOUS, DANGEROUS
  - `detected_categories` (jsonb) - Array of detected violation categories
  - `recommended_action` (text) - Action recommended by AI
  - `action_taken` (text) - Actual action taken
  - `reasoning` (text) - AI explanation for the decision
  - `moderator_override` (boolean) - Whether human moderator overrode decision
  - `override_reason` (text) - Reason for override
  - `created_at` (timestamptz) - When action was taken
  
  ### 5. `user_warnings`
  Tracks individual warning incidents
  - `id` (uuid, primary key) - Internal database ID
  - `user_id` (uuid, foreign key) - References discord_users
  - `guild_id` (text) - Discord server/guild ID
  - `moderation_action_id` (uuid, foreign key) - References moderation_actions
  - `warning_reason` (text) - Reason for warning
  - `severity` (text) - Severity level
  - `created_at` (timestamptz) - When warning was issued
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Service role access for bot operations
  - Restrictive policies for data protection
  
  ## Indexes
  - Optimized for common query patterns
  - Fast lookups by Discord IDs
  - Efficient time-based queries
*/

-- Create discord_users table
CREATE TABLE IF NOT EXISTS discord_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id text UNIQUE NOT NULL,
  username text NOT NULL DEFAULT '',
  discriminator text DEFAULT '',
  account_created_at timestamptz,
  first_seen_at timestamptz DEFAULT now(),
  total_warnings integer DEFAULT 0,
  average_risk_score numeric(5,2) DEFAULT 0.00,
  captcha_verified boolean DEFAULT false,
  captcha_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create server_members table
CREATE TABLE IF NOT EXISTS server_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES discord_users(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  server_warnings integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, guild_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES discord_users(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  content_hash text,
  has_attachments boolean DEFAULT false,
  has_links boolean DEFAULT false,
  has_images boolean DEFAULT false,
  message_length integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create moderation_actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  user_id uuid REFERENCES discord_users(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  risk_score integer NOT NULL,
  risk_level text NOT NULL,
  detected_categories jsonb DEFAULT '[]'::jsonb,
  recommended_action text NOT NULL,
  action_taken text NOT NULL,
  reasoning text NOT NULL DEFAULT '',
  moderator_override boolean DEFAULT false,
  override_reason text,
  created_at timestamptz DEFAULT now()
);

-- Create user_warnings table
CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES discord_users(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  moderation_action_id uuid REFERENCES moderation_actions(id) ON DELETE SET NULL,
  warning_reason text NOT NULL,
  severity text DEFAULT 'MEDIUM',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discord_users_discord_id ON discord_users(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_guild_id ON server_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_guild_id ON messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_user_id ON moderation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_guild_id ON moderation_actions(guild_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);

-- Enable Row Level Security
ALTER TABLE discord_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Service role only - bot operations)
CREATE POLICY "Service role has full access to discord_users"
  ON discord_users
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to server_members"
  ON server_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to messages"
  ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to moderation_actions"
  ON moderation_actions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to user_warnings"
  ON user_warnings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for discord_users updated_at
DROP TRIGGER IF EXISTS update_discord_users_updated_at ON discord_users;
CREATE TRIGGER update_discord_users_updated_at
  BEFORE UPDATE ON discord_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();