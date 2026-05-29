const {
  PermissionFlagsBits
} = require("discord.js");

// =====================
// 特別許可ユーザー
// =====================
const OWNER_ID =
  "1266013271518089258";

// =====================
// 管理者チェック
// =====================
function checkAdmin(interaction) {

  const isAdmin =
    interaction.member.permissions.has(
      PermissionFlagsBits.Administrator
    );

  const isOwner =
    interaction.user.id === OWNER_ID;

  return (
    isAdmin ||
    isOwner
  );
}

module.exports = {
  checkAdmin
};
