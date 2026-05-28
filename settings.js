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

  const data = JSON.parse(fs.readFileSync(path));

  return {
    alertChannelId: data.alertChannelId ?? null,
    linkAlertEnabled: !!data.linkAlertEnabled,
    playerMonitorEnabled: !!data.playerMonitorEnabled,
    allowedRoles: Array.isArray(data.allowedRoles) ? data.allowedRoles : [],
    panelText: typeof data.panelText === "string" ? data.panelText : "",
    panelChannelId: data.panelChannelId ?? null
  };
}

function save(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
