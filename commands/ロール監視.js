const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const temp = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ロール監視')
    .setDescription('ロールがあったら付与・削除・ログ送信'),

  async execute(i) {
    await i.deferReply({ flags: 64 });
    const key = `${i.guild.id}-${i.user.id}`;

    const menu1 = new RoleSelectMenuBuilder()
      .setCustomId(`step1-${key}`)
      .setPlaceholder('✅ 「このロールがあったら」を選ぶ')
      .setMinValues(1).setMaxValues(1);

    await i.editReply({
      embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
        .setDescription('📌 手順 1/4\n**「このロールがあったら」** のロールを選んでください')],
      components: [new ActionRowBuilder().addComponents(menu1)]
    });
  },

  async handleSelect(i, step) {
    const isSkip = i.customId.endsWith('-skip');
    const isBack = i.customId.endsWith('-back');
    const key = i.customId.replace(/-skip|-back/g, '').replace(/step\d+-/, '');
    const [, userId] = key.split('-');
    if (i.user.id !== userId) return i.reply({ content: '⛔ 本人専用です', flags: 64 });

    let data = temp.get(key) || {};

    // ✅ 戻るボタン処理
    if (isBack) {
      if (step === 'step3') {
        // 手順3 → 手順2 に戻る
        const m = new RoleSelectMenuBuilder().setCustomId(`step2-${key}`).setPlaceholder('🎁 付与するロール（任意）').setMinValues(0).setMaxValues(10);
        const skipBtn = new ButtonBuilder().setCustomId(`step2-${key}-skip`).setLabel('スキップ').setStyle(ButtonStyle.Secondary);
        return i.update({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 2/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n\n**🎁 付与するロール** を選ぶか「スキップ」を押してください`)],
          components: [new ActionRowBuilder().addComponents(m), new ActionRowBuilder().addComponents(skipBtn)]
        });
      }
      if (step === 'step4') {
        // 手順4 → 手順3 に戻る
        const m = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('🗑️ 削除するロール（任意）').setMinValues(0).setMaxValues(10);
        const skipBtn = new ButtonBuilder().setCustomId(`step3-${key}-skip`).setLabel('スキップ').setStyle(ButtonStyle.Secondary);
        const backBtn = new ButtonBuilder().setCustomId(`step3-${key}-back`).setLabel('戻る').setStyle(ButtonStyle.Secondary);
        return i.update({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds?.length>0?data.addRoleIds.length+'件':'なし'}\n\n**🗑️ 削除するロール** を選ぶか「スキップ」を押してください`)],
          components: [new ActionRowBuilder().addComponents(m), new ActionRowBuilder().addComponents(skipBtn, backBtn)]
        });
      }
    }

    // ✅ スキップボタン処理
    if (isSkip) {
      if (step === 'step2') data.addRoleIds = [];
      if (step === 'step3') data.removeRoleIds = [];
      temp.set(key, data);
    }

    // ✅ 手順1：確認ロール
    if (step === 'step1') {
      data.checkRoleId = i.roles.first().id;
      temp.set(key, data);
      const m = new RoleSelectMenuBuilder().setCustomId(`step2-${key}`).setPlaceholder('🎁 付与するロール（任意）').setMinValues(0).setMaxValues(10);
      const skipBtn = new ButtonBuilder().setCustomId(`step2-${key}-skip`).setLabel('スキップ').setStyle(ButtonStyle.Secondary);
      return i.update({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`📌 手順 2/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n\n**🎁 付与するロール** を選ぶか「スキップ」を押してください`)],
        components: [new ActionRowBuilder().addComponents(m), new ActionRowBuilder().addComponents(skipBtn)]
      });
    }

    // ✅ 手順2：付与ロール
    if (step === 'step2') {
      if (!isSkip) data.addRoleIds = i.roles.map(r => r.id);
      temp.set(key, data);
      const m = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('🗑️ 削除するロール（任意）').setMinValues(0).setMaxValues(10);
      const skipBtn = new ButtonBuilder().setCustomId(`step3-${key}-skip`).setLabel('スキップ').setStyle(ButtonStyle.Secondary);
      const backBtn = new ButtonBuilder().setCustomId(`step3-${key}-back`).setLabel('戻る').setStyle(ButtonStyle.Secondary);
      return i.update({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds.length>0?data.addRoleIds.length+'件':'なし'}\n\n**🗑️ 削除するロール** を選ぶか「スキップ」を押してください`)],
        components: [new ActionRowBuilder().addComponents(m), new ActionRowBuilder().addComponents(skipBtn, backBtn)]
      });
    }

    // ✅ 手順3：削除ロール
    if (step === 'step3') {
      if (!isSkip) data.removeRoleIds = i.roles.map(r => r.id);
      temp.set(key, data);
      const m = new ChannelSelectMenuBuilder().setCustomId(`step4-${key}`).setPlaceholder('📝 ログを送るチャンネル（必須）').setMinValues(1).setMaxValues(1);
      const backBtn = new ButtonBuilder().setCustomId(`step4-${key}-back`).setLabel('戻る').setStyle(ButtonStyle.Secondary);
      return i.update({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`📌 手順 4/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds?.length>0?data.addRoleIds.length+'件':'なし'}\n🗑️ 削除：${data.removeRoleIds?.length>0?data.removeRoleIds.length+'件':'なし'}\n\n**📝 ログを送るチャンネル** を選んでください`)],
        components: [new ActionRowBuilder().addComponents(m), new ActionRowBuilder().addComponents(backBtn)]
      });
    }

    // ✅ 手順4：ログチャンネル選択 → 実行
    if (step === 'step4') {
      data.logChId = i.channels.first().id;
      temp.delete(key);
      const mem = i.member;
      const has = mem.roles.cache.has(data.checkRoleId);
      let res = '', log = '';

      if (has) {
        const rm = [];
        for (const id of data.removeRoleIds||[]) {
          if (mem.roles.cache.has(id)) {
            await mem.roles.remove(id);
            rm.push(`<@&${id}>`);
          }
        }
        const add = [];
        for (const id of data.addRoleIds||[]) {
          if (!mem.roles.cache.has(id)) {
            await mem.roles.add(id);
            add.push(`<@&${id}>`);
          }
        }

        res = `✅ <@&${data.checkRoleId}> を持っているので実行\n`;
        res += rm.length > 0 ? `🗑️ 削除：${rm.join(', ')}\n` : '';
        res += add.length > 0 ? `🎁 付与：${add.join(', ')}` : '';
        if (!rm.length && !add.length) res += '変更するロールは指定されませんでした';

        log = `📋 ロール監視 実行ログ\n👤 ${mem.user.tag}\n✅ 確認：<@&${data.checkRoleId}> → 保持中\n`;
        if (rm.length) log += `🗑️ 削除：${rm.join(', ')}\n`;
        if (add.length) log += `🎁 付与：${add.join(', ')}\n`;
        log += `🕒 ${new Date().toLocaleString('ja-JP')}`;
      } else {
        res = `❌ <@&${data.checkRoleId}> を持っていないのでスキップ`;
        log = `📋 ロール監視 スキップログ\n👤 ${mem.user.tag}\n❌ 確認：<@&${data.checkRoleId}> → 未保持\n🕒 ${new Date().toLocaleString('ja-JP')}`;
      }

      try {
        const ch = await i.guild.channels.fetch(data.logChId);
        if (ch?.send) await ch.send({ content: log });
      } catch (e) {}

      return i.update({
        embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ 処理完了').setDescription(res)],
        components: []
      });
    }
  }
};
