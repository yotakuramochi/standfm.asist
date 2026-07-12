// Discord Webhook経由でObsidian日誌へ還流する
// 仕組み: このWebhookのチャンネルを listener_bot.py(2nd-Brain/00_システム/devtools/discord_notifier)が
// 監視していて、投稿を日誌の「🧠 思考と感情のログ (Context Stream)」に自動追記する。
// Discordの1メッセージ上限は2000文字のため、1900文字に収めて送る。

const DISCORD_MESSAGE_LIMIT = 1900

export interface DiscordJournalEntry {
    title: string
    summary: string
    transcript: string
}

export async function postToJournalViaDiscord(entry: DiscordJournalEntry): Promise<boolean> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.log('DISCORD_WEBHOOK_URL not configured, skipping journal sync')
        return false
    }

    const header = `🎙️ 音声配信メモ(スタエフツール自動記録)「${entry.title}」`
    const summaryBlock = `【要約】${entry.summary}`

    // 残り文字数に収まる分だけ文字起こしを添える
    const used = header.length + summaryBlock.length + 20
    const remaining = DISCORD_MESSAGE_LIMIT - used
    let transcriptBlock = ''
    if (remaining > 200) {
        const excerpt = entry.transcript.length > remaining
            ? entry.transcript.slice(0, remaining - 30) + '\n…(続きはアプリの履歴で)'
            : entry.transcript
        transcriptBlock = `【話した内容】\n${excerpt}`
    }

    const content = [header, summaryBlock, transcriptBlock].filter(Boolean).join('\n')

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        })
        if (!response.ok) {
            console.error('Discord webhook failed:', response.status, await response.text())
            return false
        }
        return true
    } catch (error) {
        console.error('Discord webhook error:', error)
        return false
    }
}
