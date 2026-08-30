// ✅ 特定コマンド用 権限チェック
async function checkCommandPermission(i) {
  const userId = i.user.id;
  const subCommand = i.options.getSubcommand();

  // ✅ 1266013271518089258 は全コマンド・全サーバーで無条件許可
  if (userId === ADMIN_ID) return true;

  // ✅ /role 許可 /role 削除 は「サーバー所有者」だけ許可
  if (subCommand === '許可' || subCommand === '削除') {
    return i.guild.ownerId === userId;
  }

  // ✅ /role 一覧 は 管理者 または 許可ロール保持者 を許可
  if (subCommand === '一覧') {
    if (i.member.permissions.has('Administrator')) return true;
    const allowed = await getAllowedRoles(i.guildId);
    return i.member.roles.cache.some(r => allowed.includes(r.id));
  }

  return false;
}

// ✅ 権限チェック（統合版）
async function canUse(i) {
  // ✅ ADMIN_ID は無条件で全許可
  if (i.user.id === ADMIN_ID) return true;
  // ✅ コマンド別の権限チェック
  return checkCommandPermission(i);
}
