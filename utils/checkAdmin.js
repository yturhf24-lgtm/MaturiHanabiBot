function checkAdmin(interaction) {
  const OWNER_ID = "1266013271518089258";

  if (interaction.user.id === OWNER_ID) {
    return true;
  }

  return interaction.member.permissions.has("Administrator");
}

module.exports = {
  checkAdmin
};
