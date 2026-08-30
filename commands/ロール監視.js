const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// ✅ サーバー別設定保存
const guildConfig = new Map();

// ✅ 一時操作データ
const temp = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ロール監視')
    .setDescription('ロール監視設定・実行'),

  async execute(i) {
    await i.deferReply({ flags: 64 });
    const key = `${i.guild.id}-${i.user.id}`;

    // ✅ メインパネル
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`main-${key}`)
      .setPlaceholder('選択してください')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('log指定チャンネル').setDescription('ロール条件で削除・付与を実行').setValue('log'),
        new StringSelectMenuOptionBuilder().setLabel('監視設定を保存').setDescription('条件をサーバーに保存').setValue('save'),
        new StringSelectMenuOptionBuilder().setLabel('監視設定を表示').setDescription('現在の設定を確認').setValue('view')
      );

    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('🔍 ロール監視')
          .setDescription('実行する処理を選択してください')
      ],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  },

  async handleMenu(i, value) {
    const key = i.customId.replace('main-', '');
    const [guildId, userId] = key.split('-');

    if (i.user.id !== userId) return i.reply({ content: '⛔ 本人専用です', flags: 64 });

    // ✅ log指定チャンネル実行
    if (value === 'log') {
      temp.set(key, { step: 1 });
      const checkMenu = new RoleSelectMenuBuilder()
        .setCustomId(`check-${key}`)
        .setPlaceholder('✅ 確認するロール（1つ）')
        .setMinValues(1).setMaxValues(1);

      return i.update({
        embeds: [new EmbedBuilder().setTitle('🔍 log指定チャンネル 1/3').setDescription('「このロールが無ければ」のロールを選んで')],
        components: [new ActionRowBuilder().addComponents(checkMenu)]
      });
    }

    // ✅ 設定保存
    if (value === 'save') {
      temp.set(`${key}-save`, { step: 1 });
      const checkMenu = new RoleSelectMenuBuilder()
        .setCustomId(`savechk-${key}`)
        .setPlaceholder('✅ 確認ロール')
        .setMinValues(1).setMaxValues(1);

      return i.update({
        embeds: [new EmbedBuilder().setTitle('⚙️ 監視設定保存 1/3').setDescription('確認するロールを選んで')],
        components: [new ActionRowBuilder().addComponents(checkMenu)]
      });
    }

    // ✅ 設定表示
    if (value === 'view') {
      const cfg = guildConfig.get(guildId);
      if (!cfg) return i.update({ embeds: [new EmbedBuilder().setTitle('📋 監視設定').setDescription('まだ設定がありません')], components: [] });

      const del = cfg.removeRoles.map(id => `<@&${id}>`).join('\n') || 'なし';
      const add = cfg.addRoles.map(id => `<@&${id}>`).join('\n') || 'なし';

      return i.update({
        embeds: [new EmbedBuilder()
          .setTitle('📋 サーバー監視設定')
          .addFields(
            { name: '✅ 確認ロール', value: `<@&${cfg.checkRoleId}>` },
            { name: '🗑️ 削除するロール', value: del },
            { name: '🎁 付与するロール', value: add }
          )],
        components: []
      });
    }
  },

  async handleRole(i, prefix) {
    const isSave = prefix.startsWith('save');
    const key = i.customId.replace(`${prefix}-`, '');
    const [guildId, userId] = key.split('-');

    if (i.user.id !== userId) return i.reply({ content: '⛔ 本人専用です', flags: 64 });

    const tempKey = isSave ? `${key}-save` : key;
    const data = temp.get(tempKey);
    if (!data) return i.reply({ content: '❌ 期限切れ。もう一度 /ロール監視', flags: 64 });

    const selected = i.roles;

    // ✅ 確認ロール選択完了
    if (prefix === 'check' || prefix === 'savechk') {
      data.checkRoleId = selected.first().id;
      data.step = 2;

      const removeMenu = new RoleSelectMenuBuilder()
        .setCustomId(`${isSave?'saverem':'remove'}-${key}`)
        .setPlaceholder('🗑️ 削除するロール（複数可）')
        .setMinValues(0).setMaxValues(10);

      return i.update({
        embeds: [new EmbedBuilder().setTitle(isSave ? '⚙️ 設定保存 2/3' : '🔍 log指定チャンネル 2/3')
          .setDescription(`確認ロール：<@&${data.checkRoleId}>\n\n削除するロールを選んで（無い場合はそのまま進む）`)],
        components: [new ActionRowBuilder().addComponents(removeMenu)]
      });
    }

    // ✅ 削除ロール選択完了
    if (prefix === 'remove' || prefix === 'saverem') {
      data.removeRoles = selected.map(r => r.id);
      data.step = 3;

      const addMenu = new RoleSelectMenuBuilder()
        .setCustomId(`${isSave?'saveadd':'add'}-${key}`)
        .setPlaceholder('🎁 付与するロール（複数可）')
        .setMinValues(0).setMaxValues(10);

      return i.update({
        embeds: [new EmbedBuilder().setTitle(isSave ? '⚙️ 設定保存 3/3' : '🔍 log指定チャンネル 3/3')
          .setDescription(`削除ロール：${data.removeRoles.length>0?'選択したロール':'なし'}\n\n付与するロールを選んで`)],
        components: [new ActionRowBuilder().addComponents(addMenu)]
      });
    }

    // ✅ 付与ロール選択 → 実行 or 保存
    if (prefix === 'add' || prefix === 'saveadd') {
      data.addRoles = selected.map(r => r.id);
      temp.delete(tempKey);

      // ✅ 設定保存
      if (isSave) {
        guildConfig.set(guildId, {
          checkRoleId: data.checkRoleId,
          removeRoles: data.removeRoles,
          addRoles: data.addRoles
        });
        return i.update({
          embeds: [new EmbedBuilder().setTitle('✅ 設定保存完了').setDescription('このサーバーの監視設定を保存しました')],
          components: []
        });
      }

      // ✅ log指定チャンネル：実行
      const member = i.member;
      const hasCheck = member.roles.cache.has(data.checkRoleId);
      let result = '';

      if (!hasCheck) {
        // ❌ 確認ロールが無い → 削除 → 付与
        const removed = [];
        for (const rid of data.removeRoles) {
          if (member.roles.cache.has(rid)) {
            await member.roles.remove(rid);
            removed.push(`<@&${rid}>`);
          }
        }
        const added = [];
        for (const rid of data.addRoles) {
          if (!member.roles.cache.has(rid)) {
            await member.roles.add(rid);
            added.push(`<@&${rid}>`);
          }
        }

        result = `❌ 確認ロール <@&${data.checkRoleId}> を持っていません\n`;
        result += removed.length > 0 ? `🗑️ 削除：${removed.join(', ')}\n` : '';
        result += added.length > 0 ? `🎁 付与：${added.join(', ')}` : '';
        if (!removed.length && !added.length) result += '変更はありません';
      } else {
        // ✅ 確認ロールが有る → 何もしない
        result = `✅ 確認ロール <@&${data.checkRoleId}> を持っているため\n変更は行いません`;
      }

      return i.update({
        embeds: [new EmbedBuilder().setTitle('✅ 処理完了').setDescription(result)],
        components: []
      });
    }
  }
};
