import { GoogleGenerativeAI } from '@google/generative-ai'
import { STYLE_GUIDELINES } from '@/content/style/guidelines'
import { X_EXAMPLES, NOTE_EXAMPLE, SUBSTACK_EXAMPLE } from '@/content/style/examples'

export interface GeneratedContent {
    cleanedTranscript: string
    summary: string
    titles: string[]
    standfmDescription: string
    xPost: string
    noteArticle: string
    substackLetter: string
}

// Tone presets(文体はStyle Guidelinesが主。トーンは微調整のみ)
const TONE_PROMPTS: Record<string, string> = {
    standard: '',
    casual: '通常よりさらにカジュアル寄りに、笑いの要素を1つ多めに入れてください。',
    formal: '対外的な場を想定し、一人称は「私」、崩し表現(「的な。」等)は控えめにしてください。',
    short: '各出力を通常の6〜7割の長さに絞ってください。要点優先。',
}

function getModel() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    return genAI.getGenerativeModel({
        model: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
    })
}

function extractJson<T>(text: string): T {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error('Failed to parse AI response')
    }
    return JSON.parse(jsonMatch[0]) as T
}

const STYLE_HEADER = `あなたは「よーた」本人として文章を書くゴーストライターです。
以下の文体ガイドラインと見本を厳守し、AIっぽい文章ではなく「よーた本人が書いた文章」を出力してください。

${STYLE_GUIDELINES}
`

interface ShortPack {
    cleanedTranscript: string
    summary: string
    titles: string[]
    standfmDescription: string
    xPost: string
}

interface LongPack {
    noteArticle: string
    substackLetter: string
}

async function generateShortPack(rawTranscript: string, toneInstruction: string): Promise<ShortPack> {
    const prompt = `${STYLE_HEADER}
## X長文の文体見本
${X_EXAMPLES}

${toneInstruction}

## 入力(音声配信の文字起こし原文)
${rawTranscript}

## タスク
上記の文字起こしを元に、以下をJSONで出力してください。JSONのみを出力し、説明は不要です。

{
  "cleanedTranscript": "フィラーワード(えーと、あのー等)を除去し、読みやすく整形した文字起こし。内容の削除や要約はしない",
  "summary": "内容の要約(150文字程度)。日誌に記録するので、話した本人が後から見て思い出せる具体性を持たせる",
  "titles": ["stand.fm用タイトル候補1(絵文字1つ付き・28文字以内)", "候補2", "候補3"],
  "standfmDescription": "stand.fm概要欄。【今日のテーマ】【内容(箇条書き)】【まとめ】の構成+ハッシュタグ3〜4個(#standfm含む)",
  "xPost": "X投稿文。1行目で指を止めるフック、縦長レイアウト(改行・箇条書き多用)、最後は本質的な一言で締める。280文字以内。ハッシュタグは付けない"
}`

    const result = await getModel().generateContent(prompt)
    return extractJson<ShortPack>(result.response.text())
}

async function generateLongPack(rawTranscript: string, toneInstruction: string): Promise<LongPack> {
    const prompt = `${STYLE_HEADER}
## Note記事の文体見本
${NOTE_EXAMPLE}

## メルマガ(Substack)の文体見本
${SUBSTACK_EXAMPLE}

${toneInstruction}

## 入力(音声配信の文字起こし原文)
${rawTranscript}

## タスク
上記の文字起こしを元に、以下をJSONで出力してください。JSONのみを出力し、説明は不要です。
話していない事実を創作しないこと。話が薄い部分は無理に膨らませず、その分短くてよい。

{
  "noteArticle": "Note記事(markdown)。構成: 共感フック→結論→## 見出し2〜3個(それぞれに体験談か具体例)→ポジティブな締め。1200〜2000文字目安。冒頭に音声版への誘導1行(『>>音声で聞きたい方はこちら!』)を入れる",
  "substackLetter": "Substack用レター(markdown弱め)。特定の一人に手紙を書くような親密なトーンで、冒頭は挨拶+近況から入る。Noteより裏話・感情多め。800〜1400文字目安。締めに『それでは、また次のレターで!』系の一文"
}`

    const result = await getModel().generateContent(prompt)
    return extractJson<LongPack>(result.response.text())
}

export async function generateContent(
    rawTranscript: string,
    tonePreset: string = 'standard'
): Promise<GeneratedContent> {
    const toneInstruction = TONE_PROMPTS[tonePreset] ?? ''

    // 短尺パック(タイトル・概要欄・X)と長尺パック(Note・Substack)を並列生成
    const [shortPack, longPack] = await Promise.all([
        generateShortPack(rawTranscript, toneInstruction),
        generateLongPack(rawTranscript, toneInstruction),
    ])

    return { ...shortPack, ...longPack }
}
