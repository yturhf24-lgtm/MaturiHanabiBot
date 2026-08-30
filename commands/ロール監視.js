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
      .setPlaceholder('▼ ロールを選んでください')
      .setMinValues(1).setMaxValues(1);

    const nextBtn = new ButtonBuilder().setCustomId(`step1-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(true);

    await i.editReply({
      embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
        .setDescription('📌 手順 1/4\n**「このロールがあったら」** のロールを選んでください')],
      components: [new ActionRowBuilder().addComponents(menu1), new ActionRowBuilder().addComponents(nextBtn)]
    });
  },

  async handleSelect(i, step) {
    const customId = i.customId;
    const isSkip = customId.includes('-skip');
    const isBack = customId.includes('-back');
    const isNext = customId.includes('-next');

    let key = '';
    if (isSkip || isBack || isNext) {
      const parts = customId.split('-');
      key = parts.slice(2).join('-');
    } else {
      key = customId.replace(/step\d+-/, '');
    }

    const [, userId] = key.split('-');

    // ✅ 本人以外は拒否
    if (i.user.id !== userId) {
      if (!i.replied && !i.deferred) await i.reply({ content: '⛔ このパネルは実行者本人だけが操作できます', flags: 64 });
      return;
    }

    // ✅ 応答を保証
    if (!i.deferred && !i.replied) await i.deferUpdate();

    let data = temp.get(key) || {};

    // ─── ロール選択時：「次へ」ボタンを押せるようにする ───
    if (step === 'step1' && !isNext && !isSkip && !isBack) {
      data.checkRoleId = i.roles.first().id;
      temp.set(key, data);
      const menu = new RoleSelectMenuBuilder().setCustomId(`step1-${key}`).setPlaceholder('▼ ロールを選んでください').setMinValues(1).setMaxValues(1).setDisabled(true);
      const nextBtn = new ButtonBuilder().setCustomId(`step1-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(false);
      return i.editReply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`✅ 選択完了：<@&${data.checkRoleId}>\n\n**「➡️ 次へ」ボタンを押して進んでください**`)],
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(nextBtn)]
      });
    }

    if (step === 'step2' && !isNext && !isSkip && !isBack) {
      data.addRoleIds = i.roles.map(r => r.id);
      temp.set(key, data);
      const menu = new RoleSelectMenuBuilder().setCustomId(`step2-${key}`).setPlaceholder('▼ ロールを選んでください').setMinValues(0).setMaxValues(10).setDisabled(true);
      const nextBtn = new ButtonBuilder().setCustomId(`step2-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(false);
      const skipBtn = new ButtonBuilder().setCustomId(`step2-skip-${key}`).setLabel('⏭️ スキップ').setStyle(ButtonStyle.Secondary).setDisabled(true);
      const backBtn = new ButtonBuilder().setCustomId(`step2-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
      return i.editReply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`✅ 選択完了：${data.addRoleIds.length>0?data.addRoleIds.length+'件':'なし'}\n\n**「➡️ 次へ」ボタンを押して進んでください**`)],
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn, nextBtn)]
      });
    }

    if (step === 'step3' && !isNext && !isSkip && !isBack) {
      data.removeRoleIds = i.roles.map(r => r.id);
      temp.set(key, data);
      const menu = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('▼ ロールを選んでください').setMinValues(0).setMaxValues(10).setDisabled(true);
      const nextBtn = new ButtonBuilder().setCustomId(`step3-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(false);
      const backBtn = new ButtonBuilder().setCustomId(`step3-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
      return i.editReply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`✅ 選択完了：${data.removeRoleIds.length>0?data.removeRoleIds.length+'件':'なし'}\n\n**「➡️ 次へ」ボタンを押して進んでください**`)],
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn, nextBtn)]
      });
    }

    // ─── スキップボタン ───
    if (isSkip) {
      if (step === 'step2') data.addRoleIds = [];
      if (step === 'step3') data.removeRoleIds = [];
      temp.set(key, data);
    }

    // ─── 戻るボタン ───
    if (isBack) {
      if (step === 'step2' || step === 'step3') {
        // 手順2/3 → 手順1
        const menu = new RoleSelectMenuBuilder().setCustomId(`step1-${key}`).setPlaceholder('▼ ロールを選んでください').setMinValues(1).setMaxValues(1);
        const nextBtn = new ButtonBuilder().setCustomId(`step1-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(true);
        return i.editReply({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription('📌 手順 1/4\n**「このロールがあったら」** のロールを選んでください')],
          components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(nextBtn)]
        });
      }
      if (step === 'step4') {
        // 手順4 → 手順3
        const menu = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('▼ 削除するロール（任意）').setMinValues(0).setMaxValues(10);
        const skipBtn = new ButtonBuilder().setCustomId(`step3-skip-${key}`).setLabel('⏭️ スキップ').setStyle(ButtonStyle.Secondary);
        const backBtn = new ButtonBuilder().setCustomId(`step3-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
        const nextBtn = new ButtonBuilder().setCustomId(`step3-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(true);
        return i.editReply({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds?.length>0?data.addRoleIds.length+'件':'なし'}\n\n**🗑️ 削除するロール** を選んでください`),
          components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn, skipBtn, nextBtn)]
        });
      }
    }

    // ─── 次へボタン：手順を進める ───
    if (isNext) {
      const currentStep = step.replace('-next', '');

      if (currentStep === 'step1') {
        // 手順1 → 手順2
        const menu = new RoleSelectMenuBuilder().setCustomId(`step2-${key}`).setPlaceholder('▼ 付与するロール（任意）').setMinValues(0).setMaxValues(10);
        const skipBtn = new ButtonBuilder().setCustomId(`step2-skip-${key}`).setLabel('⏭️ スキップ').setStyle(ButtonStyle.Secondary);
        const backBtn = new ButtonBuilder().setCustomId(`step2-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
        const nextBtn = new ButtonBuilder().setCustomId(`step2-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(true);
        return i.editReply({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 2/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n\n**🎁 付与するロール** を選んでください（選択後「次へ」を押す）`),
          components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn, skipBtn, nextBtn)]
        });
      }

      if (currentStep === 'step2') {
        // 手順2 → 手順3
        const menu = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('▼ 削除するロール（任意）').setMinValues(0).setMaxValues(10);
        const skipBtn = new ButtonBuilder().setCustomId(`step3-skip-${key}`).setLabel('⏭️ スキップ').setStyle(ButtonStyle.Secondary);
        const backBtn = new ButtonBuilder().setCustomId(`step3-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
        const nextBtn = new ButtonBuilder().setCustomId(`step3-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(true);
        return i.editReply({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds?.length>0?data.addRoleIds.length+'件':'なし'}\n\n**🗑️ 削除するロール** を選んでください（選択後「次へ」を押す）`),
          components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn, skipBtn, nextBtn)]
        });
      }

      if (currentStep === 'step3') {
        // 手順3 → 手順4
        const menu = new ChannelSelectMenuBuilder().setCustomId(`step4-${key}`).setPlaceholder('▼ ログを送るチャンネル').setMinValues(1).setMaxValues(1);
        const backBtn = new ButtonBuilder().setCustomId(`step4-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
        return i.editReply({
          embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
            .setDescription(`📌 手順 4/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds?.length>0?data.addRoleIds.length+'件':'なし'}\n🗑️ 削除：${data.removeRoleIds?.length>0?data.removeRoleIds.length+'件':'なし'}\n\n**📝 ログを送るチャンネル** を選んでください`),
          components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn)]
        });
      }

      if (currentStep === 'step4') {
        // 手順4 → 実行
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
          res += rm.length ? `🗑️ 削除：${rm.join(', ')}\n` : '';
          res += add.length ? `🎁 付与：${add.join(', ')}` : '';
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

        return i.editReply({
          embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ 処理完了').setDescription(res)],
          components: []
        });
      }
    }

    // ─── スキップから次へ ───
    if (isSkip && step === 'step2') {
      data.addRoleIds = [];
      temp.set(key, data);
      const menu = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('▼ 削除するロール（任意）').setMinValues(0).setMaxValues(10);
      const skipBtn = new ButtonBuilder().setCustomId(`step3-skip-${key}`).setLabel('⏭️ スキップ').setStyle(ButtonStyle.Secondary);
      const backBtn = new ButtonBuilder().setCustomId(`step3-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
      const nextBtn = new ButtonBuilder().setCustomId(`step3-next-${key}`).setLabel('➡️ 次へ').setStyle(ButtonStyle.Primary).setDisabled(true);
      return i.editReply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：スキップ\n\n**🗑️ 削除するロール** を選んでください（選択後「次へ」を押す）`),
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn, skipBtn, nextBtn)]
      });
    }

    if (isSkip && step === 'step3') {
      data.removeRoleIds = [];
      temp.set(key, data);
      const menu = new ChannelSelectMenuBuilder().setCustomId(`step4-${key}`).setPlaceholder('▼ ログを送るチャンネル').setMinValues(1).setMaxValues(1);
      const backBtn = new ButtonBuilder().setCustomId(`step4-back-${key}`).setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary);
      return i.editReply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視')
          .setDescription(`📌 手順 4/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds?.length>0?data.addRoleIds.length+'件':'スキップ'}\n🗑️ 削除：スキップ\n\n**📝 ログを送るチャンネル** を選んでください`),
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backBtn)]
      });
    }

    // ─── 手順4：チャンネル選択 → 自動実行 ───
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
        res += rm.length ? `🗑️ 削除：${rm.join(', ')}\n` : '';
        res += add.length ? `🎁 付与：${add.join(', ')}` : '';
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

      return i.editReply({
        embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ 処理完了').setDescription(res)],
        components: []
      });
    }
  }
};
