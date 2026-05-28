const fs = require('fs');

const FILE = './settings.json';

const defaultSettings = {
  monitorEnabled: true,
  linkAlertEnabled: true,
  newAccountAlertEnabled: true,
  alertChannelId: null,
  allowedRoleIds: [],
  panelDescription: '説明',
  panelButtonLabel: '開く'
};

function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(defaultSettings, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  load,
  save
};
