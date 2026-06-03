const fs = require("fs");

function loadJSON(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify({}, null, 4)
        );
    }

    return JSON.parse(
        fs.readFileSync(file, "utf8")
    );
}

function saveJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 4)
    );
}

module.exports = {
    loadJSON,
    saveJSON
};
