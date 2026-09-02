module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Botが正常に起動しました: ${client.user.tag}`);
  }
};
