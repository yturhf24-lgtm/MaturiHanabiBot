// index.js
// ============================================
// Discord ロール自動復旧BOT
// Render対応 完全版
// ============================================

// npm install discord.js

const {
    Client,
    GatewayIntentBits,
    Partials
} = require('discord.js');

// =====================
// BOT TOKEN
// =====================

const TOKEN = process.env.TOKEN;

// =====================
// 保護対象ユーザー
// =====================

const protectedUsers = [
    '1345621295303495711'
];

// =====================
// 保護ロール
// =====================

const protectedRoles = [
    '1406344310072414218',
    '1447596863678320641'
];

// =====================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.GuildMember]
});

client.once('ready', () => {

    console.log(`✅ ${client.user.tag} 起動完了`);

});

client.on('guildMemberUpdate', async (oldMember, newMember) => {

    try {

        // 指定ユーザー以外無視
        if (!protectedUsers.includes(newMember.id)) return;

        for (const roleId of protectedRoles) {

            const hadRole = oldMember.roles.cache.has(roleId);
            const hasRole = newMember.roles.cache.has(roleId);

            // ロール削除検知
            if (hadRole && !hasRole) {

                console.log(
                    `⚠ ロール削除検知 → ${newMember.user.tag}`
                );

                // 即復旧
                await newMember.roles.add(
                    roleId,
                    '保護ロール自動復旧'
                );

                console.log(
                    `✅ ロール復旧完了 → ${roleId}`
                );
            }
        }

    } catch (err) {

        console.error('❌ エラー');

        console.error(err);

    }

});

// ログイン
client.login(TOKEN);
