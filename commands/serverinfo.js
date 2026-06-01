const {
SlashCommandBuilder,
EmbedBuilder,
PermissionFlagsBits
} = require("discord.js");

module.exports = {
data: new SlashCommandBuilder()
.setName("serverinfo")
.setDescription("サーバー情報を表示")
.setDefaultMemberPermissions(
PermissionFlagsBits.Administrator
),

```
async execute(interaction) {

    const guild = interaction.guild;

    const embed = new EmbedBuilder()
        .setTitle("📊 サーバー情報")
        .setColor("Blue")
        .addFields(
            {
                name: "サーバー名",
                value: guild.name,
                inline: true
            },
            {
                name: "サーバーID",
                value: guild.id,
                inline: true
            },
            {
                name: "オーナーID",
                value: guild.ownerId,
                inline: true
            },
            {
                name: "メンバー数",
                value: `${guild.memberCount}`,
                inline: true
            },
            {
                name: "チャンネル数",
                value: `${guild.channels.cache.size}`,
                inline: true
            },
            {
                name: "ロール数",
                value: `${guild.roles.cache.size}`,
                inline: true
            }
        )
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setTimestamp();

    await interaction.reply({
        embeds: [embed]
    });
}
```

};
