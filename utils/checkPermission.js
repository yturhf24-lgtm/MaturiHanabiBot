const fs = require("fs");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");

const OWNER_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

module.exports = interaction => {

    if (OWNER_USERS.includes(interaction.user.id))
        return true;

    if (
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    const file = path.join(
        __dirname,
        "..",
        "data",
        "permissions.json"
    );

    if (!fs.existsSync(file))
        return false;

    const data = JSON.parse(
        fs.readFileSync(file)
    );

    const guildData =
        data[interaction.guild.id];

    if (!guildData)
        return false;

    return interaction.member.roles.cache.some(
        role =>
            guildData.roles.includes(role.id)
    );
};
