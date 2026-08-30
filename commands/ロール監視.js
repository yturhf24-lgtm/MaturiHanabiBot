const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const temp = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ロール監視')
    .setDescription('ロール条件で自動的に付与・削除・ログ送信'),

  async execute(i) {
    await i.deferReply({ flags: 64 });
    const key = `${i.guild.id}-${i.user.id}`;

    // ✅ 手順1：確認ロール
    const menu1 = new RoleSelectMenuBuilder()
      .setCustomId(`step1-${key}`)
      .setPlaceholder('✅ 「このロールが無ければ」を選ぶ')
      .setMinValues(1).setMaxValues(1);

    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🔍 ロール監視')
          .setDescription('📌 手順 1/4\n**「このロールが無ければ」** のロールを選んでください')
      ],
      components: [new ActionRowBuilder().addComponents(menu1)]
    });
  },

  async handleSelect(i, step) {
    const key = i.customId.replace(`${step}-`, '');
    const [guildId, userId] = key.split('-');

    // ✅ 本人確認
    if (i.user.id !== userId) {
      return i.reply({ content: '⛔ このパネルは実行した人本人だけが操作できます', flags: 64 });
    }

    const data = temp.get(key) || {};

    // ✅ 手順1：確認ロール
    if (step === 'step1') {
      data.checkRoleId = i.roles.first().id;
      temp.set(key, data);

      const menu2 = new RoleSelectMenuBuilder()
        .setCustomId(`step2-${key}`)
        .setPlaceholder('🎁 付与するロール（複数可）')
        .setMinValues(0).setMaxValues(10);

      return i.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 2/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n\n**付与するロール** を選んでください（無い場合はそのまま進む）`)
        ],
        components: [new ActionRowBuilder().addComponents(menu2)]
      });
    }

    // ✅ 手順2：付与ロール
    if (step === 'step2') {
      data.addRoleIds = i.roles.map(r => r.id);
      temp.set(key, data);

      const menu3 = new RoleSelectMenuBuilder()
        .setCustomId(`step3-${key}`)
        .setPlaceholder('🗑️ 削除するロール（複数可）')
        .setMinValues(0).setMaxValues(10);

      return i.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds.length>0?''+data.addRoleIds.length+'件':'なし'}\n\n**削除するロール** を選んでください（無い場合はそのまま進む）`)
        ],
        components: [new ActionRowBuilder().addComponents(menu3)]
      });
    }

    // ✅ 手順3：削除ロール
    if (step === 'step3') {
      data.removeRoleIds = i.roles.map(r => r.id);
      temp.set(key, data);

      const menu4 = new ChannelSelectMenuBuilder()
        .setCustomId(`step4-${key}`)
        .setPlaceholder('📝 logを送るチャンネルを1つ')
        .setMinValues(1).setMaxValues(1);

      return i.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 4/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds.length>0?data.addRoleIds.length+'件':'なし'}\n🗑️ 削除：${data.removeRoleIds.length>0?data.removeRoleIds.length+'件':'なし'}\n\n**logを送るチャンネル** を選んでください`)
        ],
        components: [new ActionRowBuilder().addComponents(menu4)]
      });
    }

    // ✅ 手順4：実行＋ログ
    if (step === 'step4') {
      data.logChannelId = i.channels.first().id;
      temp.delete(key);

      const member = i.member;
      const hasCheck = member.roles.cache.has(data.checkRoleId);
      let resultText = '';
      let logText = '';

      if (!hasCheck) {
        // ❌ 確認ロールが無い → 削除実行
        const removed = [];
        for (const rid of data.removeRoleIds) {
          if (member.roles.cache.has(rid)) {
            await member.roles.remove(rid);
            removed.push(`<@&${rid}>`);
          }
        }

        // ✅ 付与実行
        const added = [];
        for (const rid of data.addRoleIds) {
          if (!member.roles.cache.has(rid)) {
            await member.roles.add(rid);
            added.push(`<@&${rid}>`);
          }
        }

        // ✅ 結果文
        resultText = `❌ <@&${data.checkRoleId}> を持っていませんでした\n\n`;
        resultText += removed.length > 0 ? `🗑️ 削除したロール：\n${removed.join('\n')}\n\n` : '';
        resultText += added.length > 0 ? `🎁 付与したロール：\n${added.join('\n')}` : '';
        if (!removed.length && !added.length) resultText += '変更はありません';

        // ✅ ログ文
        logText = `📋 **ロール監視 実行ログ**\n`;
        logText += `👤 対象：<@${member.id}> (\`${member.user.tag}\`)\n`;
        logText += `✅ 確認ロール：<@&${data.checkRoleId}> → **未保持**\n`;
        if (removed.length) logText += `🗑️ 削除：${removed.join(', ')}\n`;
        if (added.length) logText += `🎁 付与：${added.join(', ')}\n`;
        logText += `🕒 ${new Date().toLocaleString('ja-JP')}`;

      } else {
        // ✅ 確認ロールが有る → 何もしない
        resultText = `✅ <@&${data.checkRoleId}> を持っているので\n何も変更しませんでした`;
        logText = `📋 **ロール監視 スキップログ**\n`;
        logText += `👤 対象：<@${member.id}> (\`${member.user.tag}\`)\n`;
        logText += `✅ 確認ロール：<@&${data.checkRoleId}> → **保持中**\n`;
        logText += `🕒 ${new Date().toLocaleString('ja-JP')}`;
      }

      // ✅ ログを指定チャンネルに送信
      try {
        const logCh = await i.guild.channels.fetch(data.logChannelId);
        if (logCh?.send) await logCh.send({ content: logText });
      } catch (e) { console.error('ログ送信失敗:', e); }

      // ✅ 本人に結果表示
      return i.update({
        embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ 処理完了').setDescription(resultText)],
        components: []
      });
    }
  }
};
