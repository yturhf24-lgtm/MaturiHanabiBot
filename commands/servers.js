const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

// 実行を許可する特定ユーザーのID（環境変数がない場合はフォールバック）
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('【管理者限定】Botが導入されている全サーバーリストを確認します'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ このコマンドはサーバー内でのみ使用できます。',
        flags: MessageFlags.Ephemeral
      });
    }

    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const isAllowedUser = interaction.user.id === ALLOWED_USER_ID;

    if (!isOwner && !isAllowedUser) {
      return interaction.reply({ 
        content: '❌ このコマンドを実行する権限がありません。', 
        flags: MessageFlags.Ephemeral 
      });
    }

    // 処理に時間がかかる場合があるため、一度「思考中」の返信する（Ephemeral）
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guilds = Array.from(interaction.client.guilds.cache.values());
    const totalGuilds = guilds.length;
    const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);

    // サーバーリストを表示用に整形（各サーバーの招待リンクを自動取得）
    const serverLines = [];
    for (let index = 0; index < guilds.length; index++) {
      const guild = guilds[index];
      const number = String(index + 1).padStart(2, '0');

      let inviteLink = null;
      try {
        const invites = await guild.invites.fetch().catch(() => null);
        let validInvite = invites?.find(inv => !inv.expiresTimestamp || inv.expiresTimestamp > Date.now());
        if (validInvite) {
          inviteLink = validInvite.url;
        } else {
          const targetCh = guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite));
          if (targetCh) {
            const newInvite = await targetCh.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
            if (newInvite) inviteLink = newInvite.url;
          }
        }
      } catch (e) {}

      // リンクが取得できた場合はMarkdownリンク、できない場合は名前のみにする
      const serverDisplayName = inviteLink ? `[${guild.name}](${inviteLink})` : guild.name;

      serverLines.push(`\`${number}.\` **${serverDisplayName}**\n┗ 🆔 \`${guild.id}\` | 👤 **${guild.memberCount.toLocaleString()}** 人`);
    }

    let serverListText = serverLines.join('\n\n');

    // Discordの文字数制限（4000文字）を超える場合の安全対策
    if (serverListText.length > 3800) {
      serverListText = serverListText.substring(0, 3750) + '\n\n... (一部のサーバーが省略されました)';
    }

    const embed = new EmbedBuilder()
      .setTitle('🌐 導入サーバー一覧')
      .setColor('#3498db')
      .setDescription(
        `📊 **統計情報**\n` +
        `・導入サーバー数: **${totalGuilds}** サーバー\n` +
        `・合計メンバー数: **${totalMembers.toLocaleString()}** 人\n` +
        `───────────────────\n\n` +
        (serverListText || '導入されているサーバーはありません。')
      )
      .setFooter({ text: `要求ユーザー: ${interaction.user.tag}` })
      .setTimestamp();

    return interaction.editReply({ 
      embeds: [embed] 
    });
  }
};
