const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
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
    const key = i.customId.replace(`${step}-`, '');
    const [, userId] = key.split('-');
    if (i.user.id !== userId) return i.reply({ content: '⛔ 本人専用です', flags: 64 });

    const data = temp.get(key) || {};

    if (step === 'step1') {
      data.checkRoleId = i.roles.first().id;
      temp.set(key, data);
      const m = new RoleSelectMenuBuilder().setCustomId(`step2-${key}`).setPlaceholder('🎁 付与するロール（複数可）').setMinValues(0).setMaxValues(10);
      return i.update({embeds:[new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視').setDescription(`📌 手順 2/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n\n**付与するロール** を選んでください`)],components:[new ActionRowBuilder().addComponents(m)]});
    }

    if (step === 'step2') {
      data.addRoleIds = i.roles.map(r=>r.id);
      temp.set(key,data);
      const m = new RoleSelectMenuBuilder().setCustomId(`step3-${key}`).setPlaceholder('🗑️ 削除するロール（複数可）').setMinValues(0).setMaxValues(10);
      return i.update({embeds:[new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視').setDescription(`📌 手順 3/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds.length>0?data.addRoleIds.length+'件':'なし'}\n\n**削除するロール** を選んでください`)],components:[new ActionRowBuilder().addComponents(m)]});
    }

    if (step === 'step3') {
      data.removeRoleIds = i.roles.map(r=>r.id);
      temp.set(key,data);
      const m = new ChannelSelectMenuBuilder().setCustomId(`step4-${key}`).setPlaceholder('📝 ログを送るチャンネル').setMinValues(1).setMaxValues(1);
      return i.update({embeds:[new EmbedBuilder().setColor('#5865F2').setTitle('🔍 ロール監視').setDescription(`📌 手順 4/4\n✅ 確認ロール：<@&${data.checkRoleId}>\n🎁 付与：${data.addRoleIds.length>0?data.addRoleIds.length+'件':'なし'}\n🗑️ 削除：${data.removeRoleIds.length>0?data.removeRoleIds.length+'件':'なし'}\n\n**ログを送るチャンネル** を選んでください`)],components:[new ActionRowBuilder().addComponents(m)]});
    }

    if (step === 'step4') {
      data.logChId = i.channels.first().id;
      temp.delete(key);
      const mem = i.member;
      const has = mem.roles.cache.has(data.checkRoleId);
      let res='', log='';

      // ✅ 「ロールがあったら」実行に変更！
      if (has) {
        // ✅ 確認ロールを持っている → 削除 → 付与
        const rm=[]; for(const id of data.removeRoleIds) if(mem.roles.cache.has(id)){await mem.roles.remove(id); rm.push(`<@&${id}>`);}
        const add=[]; for(const id of data.addRoleIds) if(!mem.roles.cache.has(id)){await mem.roles.add(id); add.push(`<@&${id}>`);}
        res=`✅ <@&${data.checkRoleId}> を持っているので実行\n${rm.length?'🗑️ 削除：'+rm.join(', ')+'\n':''}${add.length?'🎁 付与：'+add.join(', '):''}`;
        log=`📋 ロール監視 実行ログ\n👤 ${mem.user.tag}\n✅ 確認：<@&${data.checkRoleId}> → 保持中\n${rm.length?'🗑️ 削除：'+rm.join(', ')+'\n':''}${add.length?'🎁 付与：'+add.join(', '):''}\n🕒 ${new Date().toLocaleString('ja-JP')}`;
      } else {
        // ❌ 確認ロールを持っていない → 何もしない
        res=`❌ <@&${data.checkRoleId}> を持っていないのでスキップ`;
        log=`📋 ロール監視 スキップログ\n👤 ${mem.user.tag}\n❌ 確認：<@&${data.checkRoleId}> → 未保持\n🕒 ${new Date().toLocaleString('ja-JP')}`;
      }

      try{const ch=await i.guild.channels.fetch(data.logChId); if(ch?.send)ch.send({content:log});}catch(e){}
      return i.update({embeds:[new EmbedBuilder().setColor('Green').setTitle('✅ 処理完了').setDescription(res)],components:[]});
    }
  }
};
