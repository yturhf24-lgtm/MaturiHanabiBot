const {
  EmbedBuilder
} = require('discord.js');

function okEmbed(
  title,
  desc
) {

  return new EmbedBuilder()
    .setColor(
      0x57f287
    )
    .setTitle(title)
    .setDescription(desc)
    .setTimestamp();
}

function errorEmbed(
  desc
) {

  return new EmbedBuilder()
    .setColor(
      0xed4245
    )
    .setTitle('エラー')
    .setDescription(desc)
    .setTimestamp();
}

module.exports = {
  okEmbed,
  errorEmbed
};
