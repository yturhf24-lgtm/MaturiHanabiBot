const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Botの機能一覧と使い方を表示します。'),

  async execute(interaction) {
    const isClientAdmin = interaction.member.permissions.has('Administrator');

    // 📄 1ページ目: 一般ユーザー向け
    const userEmbed = new EmbedBuilder()
      .setTitle('🏮 まつり花火Bot - ヘルプメニュー (1/2)')
      .setDescription('当Botをご利用いただきありがとうございます！コミュニティの安全を守るためのセキュリティBotです。')
      .setColor(0x3498DB)
      .addFields(
        { name: '🔒 サーバー認証への参加方法', value: '1. 管理者が設置した認証パネルの「認証」ボタンを押します。\n2. Botから送られる専用リンク（URL）をクリックします。\n3. ブラウザが開くので、端末スキャンを許可して認証を完了させてください。', inline: false },
        { name: '💡 認証がうまくいかないときは？', value: '・Discordアプリ内の内蔵ブラウザではなく、SafariやChromeなどの標準ブラウザでリンクを開き直してください。\n・VPNやプロキシ、プライベートリレー（iCloud）をONにしていると裏垢/不正接続と判定され弾かれる場合があります。一時的にOFFにしてお試しください。', inline: false }
      )
      .setFooter({ text: 'ボタンを押すとページを切り替えられます' })
      .setTimestamp();

    // 📄 2ページ目: 管理者向け機能
    const adminEmbed = new EmbedBuilder()
      .setTitle('🛡️ まつり花火Bot - 管理者向けマニュアル (2/2)')
      .setDescription('⚠️ このページはサーバーの管理者（Administrator権限保持者）にのみ開示されています。')
      .setColor(0xFAA61A)
      .addFields(
        { name: '⚙️ 認証システムのセットアップ', value: '`/v_setup` コマンドを実行して、認証成功時に付与するロール、剥奪するロール（任意）、およびパネルの案内テキストを設定・設置します。', inline: false },
        { name: '🤖 不正・捨て垢自動防衛システム', value: 'アカウント作成日から30日未満の捨てアカウント、およびアバター初期状態（アイコン未設定）のユーザーがサーバーに参加した際、自動でキック(Kick)しログに報告する防衛機能が標準搭載されています。', inline: false },
        { name: '🚨 ログチャンネルの確認', value: '認証の成功ログや、同一IPによる多重接続（裏アカウント検知によるブロック）の警告は、セットアップ時に指定したログ用チャンネルへリアルタイムに通知されます。', inline: false }
      )
      .setTimestamp();

    // 🔘 操作用ボタンの作成
    const btnUser = new ButtonBuilder().setCustomId('help_page_user').setLabel('👥 一般向け').setStyle(ButtonStyle.Primary).setDisabled(true);
    const btnAdmin = new ButtonBuilder().setCustomId('help_page_admin').setLabel('👑 管理者向け').setStyle(ButtonStyle.Secondary);

    // 管理者ではない場合、管理者ボタンを非表示、または無効化
    if (!isClientAdmin) {
      btnAdmin.setDisabled(true).setLabel('👑 管理者向け (権限なし)');
    }

    const row = new ActionRowBuilder().addComponents(btnUser, btnAdmin);

    // 🟢 最初の応答（メッセージはコマンド実行者にしか見えない Ephemeral 仕様）
    const response = await interaction.reply({
      embeds: [userEmbed],
      components: [row],
      flags: [MessageFlags.Ephemeral]
    });

    // ⏳ コレクターの作成（ボタン入力を5分間受け付ける）
    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
      if (i.customId === 'help_page_user') {
        btnUser.setDisabled(true).setStyle(ButtonStyle.Primary);
        btnAdmin.setDisabled(!isClientAdmin).setStyle(ButtonStyle.Secondary);
        await i.update({ embeds: [userEmbed], components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] }).catch(() => null);
      } else if (i.customId === 'help_page_admin') {
        btnUser.setDisabled(false).setStyle(ButtonStyle.Secondary);
        btnAdmin.setDisabled(true).setStyle(ButtonStyle.Primary);
        await i.update({ embeds: [adminEmbed], components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] }).catch(() => null);
      }
    });

    collector.on('end', async () => {
      // タイムアウトしたらボタンを押せなくする
      btnUser.setDisabled(true);
      btnAdmin.setDisabled(true);
      await interaction.editReply({ components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] }).catch(() => null);
    });
  }
};
