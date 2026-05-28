const fs = require('fs');

const path = './settings.json';

function load() {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify({
      alertChannelId: null,
      linkAlertEnabled: false,
      playerMonitorEnabled: false,
      allowedRoles: [],
      panelText: "",
      panelChannelId: null
    }, null, 2));
  }

  return JSON.parse(fs.readFileSync(path));
}

function save(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
