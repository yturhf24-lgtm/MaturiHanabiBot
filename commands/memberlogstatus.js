const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const ALLOWED_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

const DATA_FILE = path.join(
    __dirname,
    "..",
    "data",
    "memberlogs.json"
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("memberlogstatus")
        .setDescription("参加・退出ログ設定確認"),

    async execute(interaction) {

        const isOwner =
            interaction.guild.ownerId ===
            interaction.user.id;

        const isAllowed =
            ALLOWED_USERS.includes(
                interaction.user.id
            );

        if (
            !isOwner &&
            !isAllowed
        ) {
            return interaction.reply({
                content:
                    "このコマンドは使用できません。",
                ephemeral: true
            });
        }

        let data = {};

        if (
            fs.existsSync(DATA_FILE)
        ) {
            data = JSON.parse(
                fs.readFileSync(
                    DATA_FILE,
                    "utf8"
                )
            );
        }

        const config =
            data[
                interaction.guild.id
            ] || {};

        const embed =
            new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(
                    "📋 メンバーログ設定"
                )
                .setDescription(
`## 🎉 参加ログ

**チャンネル**
${config.joinChannel ? `<#${config.joinChannel}>` : "OFF"}

**タイトル**
${config.joinTitle || "未設定"}

**メッセージ**
${config.joinMessage || "未設定"}

━━━━━━━━━━━━━━━━━━

## 📤 退出ログ

**チャンネル**
${config.leaveChannel ? `<#${config.leaveChannel}>` : "OFF"}

**タイトル**
${config.leaveTitle || "未設定"}

**メッセージ**
${config.leaveMessage || "未設定"}`
                )
                .setThumbnail(
                    interaction.guild.iconURL({
                        dynamic: true
                    })
                )
                .setFooter({
                    text:
                        `${interaction.guild.name}`
                })
                .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};
