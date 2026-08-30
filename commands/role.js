const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('許可ロールの管理')
    .addSubcommand(sc =>
      sc.setName('許可').setDescription('許可ロールを追加')
        .addRoleOption(o => o.setName('ロール').setRequired(true).setDescription('追加するロール'))
    )
    .addSubcommand(sc =>
      sc.setName('削除').setDescription('許可ロールを削除')
        .addRoleOption(o => o.setName('ロール').setRequired(true).setDescription('削除するロール'))
    )
    .addSubcommand(sc =>
      sc.setName('一覧').setDescription('許可ロール一覧を表示')
    ),

  async execute(i) {
    await i.deferReply(); // 保存に時間がかかるので先に応答

    const { content: data } = await global.loadData();
    const gid = i.guildId;
    if (!data[gid]) data[gid] = [];

    const sub = i.options.getSubcommand();
    const role = i.options.getRole('ロール');

    if (sub === '許可') {
      if (!data[gid].includes(role.id)) data[gid].push(role.id);
      await global.saveData(data);
      return i.editReply({ embeds: [
        new EmbedBuilder().setColor('Green').setTitle('✅ 許可ロール追加')
          .setDescription(`<@&${role.id}> を許可ロールに設定しました\n💾 GitHubに保存完了`)
      ]});
    }

    if (sub === '削除') {
      data[gid] = data[gid].filter(id => id !== role.id);
      await global.saveData(data);
      return i.editReply({ embeds: [
        new EmbedBuilder().setColor('Orange').setTitle('🗑️ 許可ロール削除')
          .setDescription(`<@&${role.id}> を許可ロールから外しました\n💾 GitHubに保存完了`)
      ]});
    }

    if (sub === '一覧') {
      const list = data[gid].length
        ? data[gid].map(id => `<@&${id}>`).join('\n')
        : 'まだ設定されていません';
      return i.editReply({ embeds: [
        new EmbedBuilder().setColor('Blue').setTitle('📋 許可ロール一覧').setDescription(list)
      ]});
    }
  }
};
