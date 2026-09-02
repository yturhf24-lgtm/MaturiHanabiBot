const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GH_TOKEN || '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';
const OWNER = 'yturhf24-lgtm';
const REPO = '-bot';
const BRANCH = 'main'; // デフォルトブランチ名

const filesToUpload = [
  'package.json',
  'Procfile',
  'config.json',
  'index.js',
  'commands/panel.js',
  'commands/setlog.js',
  'commands/setroles.js'
];

async function updateFile(filePath) {
  const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  const base64Content = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

  // 既存ファイルのSHA取得
  let sha = null;
  try {
    const res = await fetch(url + `?ref=${BRANCH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'Node.js' }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  // ファイルの作成・更新
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Node.js'
    },
    body: JSON.stringify({
      message: `Update ${filePath} via script`,
      content: base64Content,
      branch: BRANCH,
      ...(sha ? { sha } : {})
    })
  });

  if (response.ok) {
    console.log(`✅ 保存成功: ${filePath}`);
  } else {
    const errorData = await response.json();
    console.error(`❌ 保存失敗: ${filePath}`, errorData);
  }
}

async function main() {
  for (const file of filesToUpload) {
    await updateFile(file);
  }
}

main();
