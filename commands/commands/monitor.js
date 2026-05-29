const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");

const {
  checkAdmin
} = require("../utils/checkAdmin");

const FILE =
  "./data/alerts.json";

module.exports = {

  data:
    new SlashCommandBuilder()

      .setName("monitor")

      .setDescription(
        "10日以内参加監視とリンク監視"
      ),

  async execute(interaction) {

    // =====================
    // 権限
    // =====================
    if (
      !checkAdmin(interaction)
    ) {

      return interaction.reply({

        content:
          "❌ 管理者専用",

        ephemeral: true

      });

    }

    // =====================
    // 設定確認
    // =====================
    if (
      !fs.existsSync(FILE)
    ) {

      return interaction.reply({

        content:
          "❌ アラート送信先未設定",

        ephemeral: true

      });

    }

    const data =
      JSON.parse(
        fs.readFileSync(FILE)
      );

    const guildData =
      data[
        interaction.guild.id
      ];

    if (!guildData) {

      return interaction.reply({

        content:
          "❌ アラート送信先未設定",

        ephemeral: true

      });

    }

    // =====================
    // Embed
    // =====================
    const embed =
      new EmbedBuilder()

        .setColor(
          0xff0000
        )

        .setTitle(
          "🚨 監視開始"
        )

        .setDescription(

`📢 アラート送信先:
<#${guildData.channel}>

👤 メンション:
${interaction.user}

📝 表示名:
${interaction.member.displayName}

🏷️ ユーザー名:
${interaction.user.tag}

📅 実行日時:
<t:${Math.floor(Date.now()/1000)}:F>

━━━━━━━━━━

✅ 10日以内参加プレイヤー監視

✅ リンク監視

━━━━━━━━━━`

        )

        .setTimestamp();

    await interaction.reply({

      embeds: [embed]

    });

  }
};
