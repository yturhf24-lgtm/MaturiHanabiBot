const fs = require('fs');
const path = require('path');

const SETTINGS =
  path.join(
    __dirname,
    '../../settings.json'
  );

function defaultGuild() {

  return {
    alertChannelId: null,
    panelChannelId: null,
    panelViewChannelId: null,
    allowedRoles: [],
    linkAlertEnabled: false,
    playerMonitorEnabled: false
  };
}

function loadAllSettings() {

  try {

    if (
      !fs.existsSync(
        SETTINGS
      )
    ) {

      fs.writeFileSync(
        SETTINGS,
        JSON.stringify(
          {},
          null,
          2
        )
      );
    }

    return JSON.parse(
      fs.readFileSync(
        SETTINGS,
        'utf8'
      )
    );

  } catch {

    return {};
  }
}

function saveAllSettings(data) {

  fs.writeFileSync(
    SETTINGS,
    JSON.stringify(
      data,
      null,
      2
    )
  );
}

function getGuildSettings(
  guildId
) {

  const data =
    loadAllSettings();

  if (!data[guildId]) {

    data[guildId] =
      defaultGuild();

    saveAllSettings(data);
  }

  return data[guildId];
}

function saveGuildSettings(
  guildId,
  settings
) {

  const data =
    loadAllSettings();

  data[guildId] =
    settings;

  saveAllSettings(data);
}

module.exports = {
  getGuildSettings,
  saveGuildSettings
};
