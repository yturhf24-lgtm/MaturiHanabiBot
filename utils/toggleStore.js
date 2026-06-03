const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../config/toggle.json");

function load() {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function setGuild(guildId, value) {
    const data = load();
    data[guildId] = value;
    save(data);
}

function getGuild(guildId) {
    const data = load();
    return data[guildId] ?? false;
}

module.exports = { setGuild, getGuild };
