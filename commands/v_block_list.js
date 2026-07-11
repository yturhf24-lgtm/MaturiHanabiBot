const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_block_list')
    .setDescription('【管理・スタッフ用】このサーバーで裏アカウントとしてブロックされたプレイヤー一覧を表示します。')
    // 💡 最低限、ロール管理権限などを持つ人に表示（許可ロール判定はコード側で二重チェックします）
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const client = interaction.client;
    const allSettings = client.getSettings();
    const config = allSettings[guildId] || {};

    // 🛑 権限チェック：管理者権限を持っているか、または設定された「許可ロール」を持っているか判定
    const isAdministrator = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasPermitRole = config.vPermitRole ? interaction.member.roles.cache.has(config.vPermitRole) : false;

    if (!isAdministrator && !hasPermitRole) {
      return interaction.reply({ 
        content: '❌ このコマンドを実行する権限がありません。（管理者権限、または設定された「許可ロール」が必要です）', 
        ephemeral: true 
      });
    }

    // 🌐 サーバーに保存されている認証済みIPデータを取得
    const verifiedIps = config.verifiedIps || {};
    const bypassUsers = config.bypassUsers || [];

    // 現在のサーバーの全メンバー情報を取得（ユーザー名などの解決用。キャッシュにない場合を考慮）
    await interaction.guild.members.fetch().catch(() => null);

    // IPデータを解析して「同じIPで、別の本垢が存在する＝裏垢として弾かれている状態」の組み合わせを抽出
    // index.jsのロジックに則り、verifiedIps に記録されている「本垢」以外のIDが同じIPで来たらブロック対象になります。
    // ここでは、現在サーバー内にいるメンバーのうち、すでに他の誰かが登録したIPと重複している、かつ例外許可（bypass）されていないユーザーをリスト化します。
    
    const blockedEntries = [];
    const ipToUserMap = new Map(); // IP -> 最初に登録した本垢ID

    // 1周目: IPと本垢の紐付けを整理
    for (const [ip, userId] of Object.entries(verifiedIps)) {
      ipToUserMap.set(ip, userId);
    }

    // 2周目: サーバー内のメンバーで、登録IPが誰かと被っている（＝裏垢として検知される）人を炙り出す
    // ※ 実際の認証時に逐一ブロックリストを保存する形ではなく、現在の登録状況から動的に「ブロック対象（裏垢）」を割り出します
    const members = interaction.guild.members.cache;
    
    // index.jsの仕様上、認証時に「すでに verifiedIps[現在のIP] が存在し、それが自分のIDではない場合」にブロックされます
    // 今回は、検知ログや認証状況と連動しやすいよう、分かりやすい「検知対象プレイヤー」の一覧を作成します。
    
    const embed = new EmbedBuilder()
      .setTitle('🚨 裏アカウント検出・ブロック対象一覧')
      .setColor(0xf04747)
      .setDescription('同一の接続環境（IPアドレス）が既に他のユーザーによって登録されているため、現在このサーバーで認証を通ることができない（または過去にブロックされた）プレイヤーの状態です。')
      .setTimestamp();

    // 実際の運用では「誰が誰の裏垢か」を見やすくするため、登録データから重複しているものをリストアップします
    // 重複IPのカウント用
    const ipCounts = {};
    const ipUsers = {}; // ip -> [userIds]

    for (const [ip, userId] of Object.entries(verifiedIps)) {
      if (!ipUsers[ip]) ipUsers[ip] = [];
      if (!ipUsers[ip].includes(userId)) {
        ipUsers[ip].push(userId);
      }
    }

    let listText = '';
    let count = 0;

    for (const [ip, userIds] of Object.entries(ipUsers)) {
      // 1つのIPに2人以上のユーザーが紐付いている、または紐づこうとしている場合
      if (userIds.length > 1) {
        // 最初に登録した人を「本垢」、それ以外を「裏垢（ブロック対象）」として明示
        const originalUser = userIds[0];
        const altUsers = userIds.slice(1);

        for (const altUser of altUsers) {
          // 例外許可（Bypass）されている場合はリストから除外
          if (bypassUsers.includes(altUser)) continue;

          count++;
          listText += `⚠️ **裏垢対象:** <@${altUser}> (\`${altUser}\`)\n┗ 👤 **登録済みの本垢:** <@${originalUser}> (\`${originalUser}\`)\n\n`;
        }
      }
    }

    if (count === 0) {
      embed.setDescription('現在、このサーバーで同一IPによる重複（裏アカウント検知）の対象となっているプレイヤーはいません。全員正常に独立した環境で認証されています。');
      embed.setColor(0x2ecc71);
    } else {
      embed.setDescription(`現在、システム上で裏アカウント（重複IP）としてロック、または検知対象になっているプレイヤーが **${count}名** います。\n\n${listText}`);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
