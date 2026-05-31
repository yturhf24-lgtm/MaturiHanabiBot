module.exports = {
    name: "ready",
    once: true,

    execute(client) {
        console.log(`${client.user.tag} 起動完了`);

        client.user.setActivity("/server_info");
    }
};
