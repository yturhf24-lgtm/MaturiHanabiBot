// =====================
// 保存機能追加
// オフライン→オンラインでも設定保持
// =====================

// これを追加

client.on('ready', () => {

  const s = load();

  console.log('====================');
  console.log('設定読み込み完了');
  console.log(s);
  console.log('====================');

});

// =====================
// 自動保存関数
// =====================
function autoSave(s) {

  fs.writeFileSync(
    SETTINGS,
    JSON.stringify(s, null, 2)
  );

}

// =====================
// monitor の保存修正
// =====================

// monitor の中をこれに変更

if (i.commandName === 'monitor') {

  if (!isAdmin(i, s)) {

    return i.editReply({
      embeds: [
        errorEmbed(
          '❌ 権限なし'
        )
      ]
    });
  }

  if (
    !(await requireAlert(i, s))
  ) return;

  const type =
    i.options.getString(
      'type'
    );

  const mode =
    i.options.getString(
      'mode'
    );

  const enabled =
    mode === 'on';

  // =====================
  // link
  // =====================
  if (type === 'link') {

    s.linkAlertEnabled =
      enabled;

    autoSave(s);

    return i.editReply({
      embeds: [
        infoEmbed(
          'リンク監視',
          enabled
            ? '✅ ON'
            : '❌ OFF'
        )
      ]
    });
  }

  // =====================
  // player
  // =====================
  if (type === 'player') {

    s.playerMonitorEnabled =
      enabled;

    autoSave(s);

    return i.editReply({
      embeds: [
        infoEmbed(
          '参加監視',
          enabled
            ? '✅ ON'
            : '❌ OFF'
        )
      ]
    });
  }
}

// =====================
// alert 保存修正
// =====================

s.alertChannelId = ch.id;

autoSave(s);

// =====================
// role 保存修正
// =====================

autoSave(s);

// =====================
// panel 保存修正
// =====================

autoSave(s);
