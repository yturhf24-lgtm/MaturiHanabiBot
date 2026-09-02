module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // スラッシュコマンド実行
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        const replyPayload = { content: 'コマンド実行時にエラーが発生しました。', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload);
        } else {
          await interaction.reply(replyPayload);
        }
      }
      return;
    }

    // セレクトメニュー（ロール削除）操作
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('remove_roles_menu_')) {
        const logChannelId = interaction.customId.replace('remove_roles_menu_', '');
        const selectedRoleIds = interaction.values;
        const member = interaction.member;

        const removedRoles = [];
        const notPossessedRoles = [];

        for (const roleId of selectedRoleIds) {
          if (member.roles.cache.has(roleId)) {
            try {
              await member.roles.remove(roleId);
              removedRoles.push(`<@&${roleId}>`);
            } catch (err) {
              console.error(`ロールID ${roleId} の削除に失敗しました:`, err);
            }
          } else {
            notPossessedRoles.push(`<@&${roleId}>`);
          }
        }

        let responseMessage = '';
        if (removedRoles.length > 0) {
          responseMessage += `✅ 以下のロールを削除しました:\n${removedRoles.join('\n')}\n`;
        }
        if (notPossessedRoles.length > 0) {
          responseMessage += `ℹ️ 以下のロールは所有していませんでした:\n${notPossessedRoles.join('\n')}`;
        }
        if (removedRoles.length === 0 && notPossessedRoles.length === 0) {
          responseMessage = '処理できるロールがありませんでした。';
        }

        await interaction.reply({ content: responseMessage, ephemeral: true });

        // ログチャンネル指定がある場合の通知
        if (logChannelId !== 'none' && removedRoles.length > 0) {
          const logChannel = interaction.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            await logChannel.send({
              content: `📝 **【ロール削除ログ】**\n**実行者**: ${interaction.user.tag} (${interaction.user.id})\n**削除されたロール**:\n${removedRoles.join('\n')}`
            });
          }
        }
      }
    }
  }
};
