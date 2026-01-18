import { GoogleGenerativeAI } from '@google/generative-ai'

export interface GeneratedContent {
    cleanedTranscript: string
    summary: string
    titles: string[]
    standfmDescription: string
    xPost: string
}

// Tone presets
const TONE_PROMPTS: Record<string, string> = {
    standard: '標準的なトーンで、わかりやすく親しみやすい文章にしてください。',
    casual: 'カジュアルで親しみやすいトーンで、絵文字を多めに使ってください。',
    formal: '丁寧で礼儀正しいトーンで、敬語を使ってください。',
    short: '簡潔で短い文章にしてください。要点のみを伝えてください。',
}

export async function generateContent(
    rawTranscript: string,
    tonePreset: string = 'standard'
): Promise<GeneratedContent> {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const toneInstruction = TONE_PROMPTS[tonePreset] || TONE_PROMPTS.standard

    const prompt = `あなたは音声配信コンテンツのプロフェッショナルアシスタントです。
以下の音声文字起こしテキストを元に、各種コンテンツを生成してください。

${toneInstruction}

## 入力（文字起こし原文）:
${rawTranscript}

## 出力形式（JSON）:
以下のJSON形式で出力してください。JSONのみを出力し、それ以外の説明は不要です。

{
  "cleanedTranscript": "フィラーワード（えーと、あのー等）を除去し、読みやすく整形した文字起こしテキスト",
  "summary": "内容を150文字程度で要約したテキスト",
  "titles": ["タイトル候補1（絵文字付き）", "タイトル候補2（絵文字付き）", "タイトル候補3（絵文字付き）"],
  "standfmDescription": "stand.fm概要欄用のテキスト（【テーマ】【内容】【まとめ】の構成でハッシュタグ含む）",
  "xPost": "X（Twitter）投稿用の280文字以内のテキスト（絵文字とハッシュタグ含む）"
}
`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error('Failed to parse AI response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedContent
    return parsed
}
