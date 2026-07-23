const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('まつり花火Botのヘルプメニューと管理者マニュアルを表示します'),

  async execute(interaction, client) {
    // 応答を保留（実行した本人のみに表示）
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // 管理者権限（または開発者）を持っているか判定
    const isClientAdmin = interaction.member 
      ? (interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.user.id === '1266013271518089258') 
      : false;

    // 1️⃣ ユーザー向けヘルプ Embed
    const userEmbed = new EmbedBuilder()
      .setTitle('🏮 まつり花火Bot - ヘルプメニュー (1/2)')
      .setDescription('当Botをご利用いただきありがとうございます！コミュニティの安全を守るためのセキュリティBotです。')
      .setColor(0x3498DB)
      .addFields(
        { 
          name: '🔒 サーバー認証への参加方法', 
          value: '1. 管理者が設置した認証パネルの「認証」ボタンを押します。\n2. Botから送られる専用リンク（URL）をクリックします。\n3. ブラウザが開くので、端末スキャンを許可して認証を完了させてください。', 
          inline: false 
        },
        { 
          name: '💡 認証がうまくいかないときは？', 
          value: '・Discordアプリ内の内蔵ブラウザではなく、SafariやChromeなどの標準ブラウザでリンクを開き直してください。\n・VPNやプロキシ、プライベートリレー（iCloud）をONにしていると裏垢/不正接続と判定され弾かれる場合があります。一時的にOFFにしてお試しください。', 
          inline: false 
        }
      )
      .setFooter({ text: '下のボタンを押すとページを切り替えられます' })
      .setTimestamp();

    // 2️⃣ 管理者向けヘルプ Embed
    const adminEmbed = new EmbedBuilder()
      .setTitle('🛡️ まつり花火Bot - 管理者向けマニュアル (2/2)')
      .setDescription('⚠️ このページはサーバーの管理者（Administrator権限保持者）にのみ開示されています。')
      .setColor(0xFAA61A)
      .addFields(
        { 
          name: '⚙️ `/v_setup`', 
          value: '`認証パネル設置` \n指定した付与ロール・剥奪ロール・案内文を設定し、そのチャンネルに端末認証パネルを送信します。', 
          inline: false 
        },
        { 
          name: '🤖 `/v_antiraid <status> <min_age_days> <block_no_avatar>`', 
          value: '`不正・捨て垢自動防衛` \nアカウント作成日数やアバター未設定（初期アイコン）に基づいて、参加者を自動キックします。\n・`status`: ON / OFF\n・`min_age_days`: 作成日数の制限値\n・`block_no_avatar`: 初期アイコンのブロック (true / false)', 
          inline: false 
        },
        { 
          name: '🔄 `/v_reset <user>`', 
          value: '`制限の個別リセット` \n誤ってブロックされてしまった正規ユーザーをサーバー個別に救済（ブロック解除）します。\n・`user`: 対象のユーザー', 
          inline: false 
        },
        { 
          name: '📜 `/v_log <status>`', 
          value: '`ログ出力チャンネル設定` \nコマンドを実行したチャンネルをログ送信先に指定します。認証成功ログ・メッセージ削除/編集ログ・VCログが集約されます。\n・`status`: ON / OFF', 
          inline: false 
        },
        { 
          name: '🤖 `/v_antiwebhook <status>`', 
          value: '`Webhookスパム自動防御` \n短時間に連続送信されたWebhookメッセージと該当のWebhookをサーバー全体で自動削除・遮断します。\n・`status`: ON / OFF', 
          inline: false 
        },
        { 
          name: '🚨 `/v_risklog <status>`', 
          value: '`リスクアカウント検知` \n初期アイコンのユーザーや作成後3日以内の新規アカウント参加時にログへ警告を出力します。\n・`status`: ON / OFF', 
          inline: false 
        },
        { 
          name: '📢 `/v_antieveryone <status>`', 
          value: '`@everyone 連投防止` \n一般ユーザーによる `@everyone` および `@here` のメンション送信を全チャンネルで即座に自動削除します。\n・`status`: ON / OFF', 
          inline: false 
        },
        { 
          name: '🔗 `/v_antilink <status>`', 
          value: '`同一リンク連投防止` \n5秒以内に同一URLが5回連投された場合、該当メッセージを自動削除します。\n・`status`: ON / OFF', 
          inline: false 
        },
        { 
          name: '🛡️ `/v_antispam <status>`', 
          value: '`簡易スパム連投対策` \n3秒以内に5通以上の連投を行ったユーザーをサーバーから自動キックします。\n・`status`: ON / OFF', 
          inline: false 
        }
      )
      .setFooter({ text: '下のボタンを押すとページを切り替えられます' })
      .setTimestamp();

    // ボタンの作成
    const btnUser = new ButtonBuilder()
      .setCustomId('help_page_user')
      .setLabel('👥 一般向け')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);

    const btnAdmin = new ButtonBuilder()
      .setCustomId('help_page_admin')
      .setLabel(isClientAdmin ? '👑 管理者向け' : '👑 管理者向け (権限なし)')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!isClientAdmin);

    const row = new ActionRowBuilder().addComponents(btnUser, btnAdmin);

    // メッセージ送信
    const response = await interaction.editReply({
      embeds: [userEmbed],
      components: [row]
    });

    // ボタン操作の処理（5分間有効）
    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ この操作はコマンドを実行した人のみ行えます。', flags: [MessageFlags.Ephemeral] });
      }

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
  }
};
