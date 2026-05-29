const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType
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

      .setName("setalert")

      .setDescription(
        "アラート送信先設定"
      )

      .addChannelOption(option =>

        option

          .setName("channel")

          .setDescription(
            "送信先"
          )

          .addChannelTypes(
            ChannelType.GuildText
          )

          .setRequired(true)

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

    const channel =
      interaction.options.getChannel(
        "channel"
      );

    // =====================
    // JSON
    // =====================
    let data = {};

    if (
      fs.existsSync(FILE)
    ) {

      data =
        JSON.parse(
          fs.readFileSync(FILE)
        );

    }

    // =====================
    // 保存
    // =====================
    data[
      interaction.guild.id
    ] = {

      channel:
        channel.id

    };

    fs.writeFileSync(

      FILE,

      JSON.stringify(
        data,
        null,
        2
      )

    );

    // =====================
    // Embed
    // =====================
    const embed =
      new EmbedBuilder()

        .setColor(
          0x5865f2
        )

        .setTitle(
          "✅ アラート送信先設定"
        )

        .setDescription(

`📢 送信先:
${channel}

👤 メンション:
${interaction.user}

📝 表示名:
${interaction.member.displayName}

🏷️ ユーザー名:
${interaction.user.tag}

📅 設定日時:
<t:${Math.floor(Date.now()/1000)}:F>`

        )

        .setTimestamp();

    await interaction.reply({

      embeds: [embed]

    });

  }
};
