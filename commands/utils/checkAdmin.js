const {
  PermissionFlagsBits
} = require("discord.js");

const OWNER_ID = "1266013271518089258";

function checkAdmin(interaction) {
  const isAdmin =
    interaction.member.permissions.has(
      PermissionFlagsBits.Administrator
    );

  const isOwner =
    interaction.user.id === OWNER_ID;

  return isAdmin || isOwner;
}

module.exports = {
  checkAdmin
};
