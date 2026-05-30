const {
  PermissionFlagsBits
} = require("discord.js");

const OWNER_ID = "1266013271518089258";

function checkAdmin(interaction) {

  return (
    interaction.member.permissions.has(
      PermissionFlagsBits.Administrator
    ) ||
    interaction.user.id === OWNER_ID
  );

}

module.exports = {
  checkAdmin
};
