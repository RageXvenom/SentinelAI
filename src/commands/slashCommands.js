// src/commands/slashCommands.js - Complete Slash Commands System
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits
} from 'discord.js';

export const commands = [
  // ============================================
  // GENERAL COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('about')
    .setDescription('Information about the AI Moderation Bot'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),

  // ============================================
  // VERIFICATION COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('Setup the verification system for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel where users should use /verify command')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to give verified users')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Complete CAPTCHA verification to get access to the server'),

  // ============================================
  // INFORMATION COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View server moderation statistics'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View information about a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get information about')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('View server information'),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Check warnings for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check warnings for')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('View recent moderation actions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // ============================================
  // MODERATION COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration (e.g., 10m, 1h, 2d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for timeout')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for kick')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Delete message history (days)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('Discord ID of the user to unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unban')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to clear warnings for')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Slowmode duration in seconds (0 to disable)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete multiple messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    ),

  // ============================================
  // SETTINGS COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Manage server moderation settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('automod')
        .setDescription('Toggle auto-moderation')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('captcha')
        .setDescription('Toggle CAPTCHA system')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('spam')
        .setDescription('Toggle spam detection')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    ),

  // ============================================
  // ANTI-NUKE COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Manage Anti-Nuke protection system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View Anti-Nuke system status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable Anti-Nuke protection')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable Anti-Nuke protection')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configure Anti-Nuke settings')
        .addIntegerOption(option =>
          option.setName('channel_delete_limit')
            .setDescription('Max channel deletes allowed')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('role_delete_limit')
            .setDescription('Max role deletes allowed')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('ban_limit')
            .setDescription('Max bans allowed')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('punishment')
            .setDescription('Punishment type for violations')
            .addChoices(
              { name: 'Ban', value: 'BAN' },
              { name: 'Kick', value: 'KICK' },
              { name: 'Strip Roles', value: 'STRIP_ROLES' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('whitelist')
        .setDescription('Add user to Anti-Nuke whitelist')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to whitelist')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unwhitelist')
        .setDescription('Remove user from Anti-Nuke whitelist')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to remove from whitelist')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlock')
        .setDescription('Unlock server after lockdown')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('View Anti-Nuke security logs')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of logs to show')
            .setMinValue(5)
            .setMaxValue(25)
            .setRequired(false)
        )
    ),

  // ============================================
  // TRUSTED USERS COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('trusted')
    .setDescription('Manage trusted users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a trusted user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to add as trusted')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a trusted user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to remove from trusted')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all trusted users')
    ),

  // ============================================
  // UTILITY COMMANDS
  // ============================================
  new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock or unlock the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Lock or unlock')
        .addChoices(
          { name: 'Lock', value: 'lock' },
          { name: 'Unlock', value: 'unlock' }
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for lockdown')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Announcement title')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Announcement message')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send announcement')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Embed color')
        .addChoices(
          { name: 'Blue', value: '#3498DB' },
          { name: 'Green', value: '#2ECC71' },
          { name: 'Red', value: '#E74C3C' },
          { name: 'Yellow', value: '#F1C40F' },
          { name: 'Purple', value: '#9B59B6' }
        )
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Mass role management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add role to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to add role to')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to add')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove role from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to remove role from')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get information about a role')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to get info about')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create a custom embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Embed title')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Embed description')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Embed color (hex code)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('footer')
        .setDescription('Embed footer text')
        .setRequired(false)
    ),
];

export function registerCommands(client) {
  client.once('ready', async () => {
    try {
      console.log('📝 Registering slash commands...');
      
      const rest = new (await import('discord.js')).REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
      
      const commandsData = commands.map(command => command.toJSON());
      
      const data = await rest.put(
        (await import('discord.js')).Routes.applicationCommands(client.user.id),
        { body: commandsData },
      );

      console.log(`✅ Successfully registered ${data.length} slash commands globally`);
    } catch (error) {
      console.error('Error registering commands:', error);
    }
  });
}
