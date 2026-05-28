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

  const d = JSON.parse(fs.readFileSync(path));

  return {
    alertChannelId: d.alertChannelId ?? null,
    linkAlertEnabled: !!d.linkAlertEnabled,
    playerMonitorEnabled: !!d.playerMonitorEnabled,
    allowedRoles: Array.isArray(d.allowedRoles) ? d.allowedRoles : [],
    panelText: typeof d.panelText === "string" ? d.panelText : "",
    panelChannelId: d.panelChannelId ?? null
  };
}

function save(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
