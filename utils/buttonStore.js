const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../config/buttons.json");

function load() {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function set(id, value) {
    const data = load();
    data[id] = value;
    save(data);
}

function get(id) {
    const data = load();
    return data[id];
}

module.exports = { set, get };
