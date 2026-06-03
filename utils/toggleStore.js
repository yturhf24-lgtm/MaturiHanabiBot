const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../config/toggle.json");

function load() {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function save(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function setGuild(guildId, value) {
    const data = load();
    data[guildId] = value;
    save(data);
}

function getGuild(guildId) {
    const data = load();
    return data[guildId] ?? false; // デフォルトOFF
}

module.exports = {
    setGuild,
    getGuild
};
