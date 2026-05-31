function checkAdmin(interaction) {

  if (
    interaction.user.id ===
    "1266013271518089258"
  ) {
    return true;
  }

  return interaction.member.permissions.has(
    "Administrator"
  );

}

module.exports = {
  checkAdmin
};
