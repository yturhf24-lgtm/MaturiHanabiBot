const fs = require('fs');

const FILE = './settings.json';

const defaultData = {
  monitorEnabled: true,
  linkAlertEnabled: true,
  newAccountAlertEnabled: true,
  alertChannelId: null,
  allowedRoleIds: [],
  panelText: '説明ここ',
  panelButton: 'ボタン'
};

function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
