# スタエフ AI 下書きアシスタント

スマホで録音、または音声ファイルを渡すと、AIがタイトルと概要欄を作り、stand.fm の投稿準備まで進めるアプリです。

## できること

- スマホ/PCブラウザでの音声録音
- 音声ファイルの文字起こし(24MBまで。4MB超はVercel Blob経由で自動アップロード)
- **よーたの文体(Style Cloner)での生成**: `src/content/style/` のガイドライン+見本をFew-Shot注入
- stand.fm 向けタイトル生成
- stand.fm 概要欄生成
- X投稿文と要約の生成
- **Note記事とSubstackレターの下書き生成**(3媒体横展開)
- **Obsidian日誌への自動記録**: 生成完了時にDiscord Webhookへ送信 → `discord_notifier/listener_bot.py` が日誌のContext Streamに追記
- 可能な環境での stand.fm 下書き保存
- 自動保存できない環境でのタイトル/概要欄まとめてコピー
- PWAとしてホーム画面に追加
- 過去の生成結果の履歴保存

## 文体(Style Cloner)の育て方

- 文体ルール: `src/content/style/guidelines.ts`(Vaultの `03_執筆スタイル(Style_Guidelines).md` 由来)
- 見本: `src/content/style/examples.ts`(X/Note/メルマガのfew-shots由来)
- 「もっと自分っぽくしたい」→ examples.ts の見本を良い実物と差し替えるだけ

## Obsidian日誌への自動記録

生成のたびに「タイトル+要約+話した内容」がDiscord経由で当日の日誌に追記されます。
前提: Macで listener_bot が動いていること。ログイン時自動起動は
`~/Library/LaunchAgents/com.yota.discord-obsidian-listener.plist` で設定済み。
※初回のみ「システム設定 > プライバシーとセキュリティ > フルディスクアクセス」で
venvのPython(`/Library/Developer/CommandLineTools/.../python3`)を許可する必要あり。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで `http://127.0.0.1:3000` を開きます。

スマホのホーム画面アプリとして使う場合は、HTTPSで公開されたURLをSafari/Chromeで開き、ホーム画面に追加してください。録音機能はHTTPS環境で安定します。

音声アップロードは24MBまで対応しています(4MB超は自動的にVercel Blob経由でアップロードされます)。

## 必要な環境変数

```bash
OPENAI_API_KEY=your_openai_api_key
GOOGLE_AI_API_KEY=your_gemini_api_key
GOOGLE_AI_MODEL=gemini-2.0-flash
```

APIキーが未設定の場合は、サンプルデータで動作確認できます。

## stand.fm 下書き保存

このアプリは stand.fm の公式投稿APIではなく、可能な環境では手元の Chrome を開いて下書き作成画面を操作します。

1. アプリの「ログインを開く」から stand.fm にログイン
2. アプリへ戻って録音、または音声ファイルを選択
3. AI生成後、音声・タイトル・概要欄を stand.fm に入力
4. 保存ボタンが見つかれば下書き保存まで実行

Chrome が見つからない場合は `.env.local` にブラウザの場所を指定します。

```bash
STANDFM_CHROME_APP_PATH=/Applications/Google Chrome.app
STANDFM_BROWSER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

stand.fm 側の画面構成が変わった場合は、入力まで進めたあと手動保存が必要になることがあります。その場合も生成済みのタイトル・概要欄はアプリ内に残ります。

Codexや一部のmacOS権限環境では、アプリからChromeを自動起動できないことがあります。その場合は画面に `タイトル＋概要欄をコピー` と `stand.fmを開く` ボタンが表示されるので、stand.fmを手動で開いて保存してください。

## スマホ向けデプロイ

Vercelに公開するとHTTPS URLで使えるため、スマホ録音とホーム画面追加が安定します。

```bash
npm run build
npx vercel
npx vercel env add OPENAI_API_KEY production
npx vercel env add GOOGLE_AI_API_KEY production
npx vercel env add GOOGLE_AI_MODEL production
npx vercel --prod
```

この環境ではVercelログインが必要です。CLIに表示される認証URLを開いてログインしてください。

## 技術スタック

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- OpenAI Whisper
- Google Gemini
- Playwright Core
