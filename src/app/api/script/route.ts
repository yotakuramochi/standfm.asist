import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface ScriptRequest {
    memo: string
    materials: string[]
    tone: string
    length: string
}

const TONE_INSTRUCTIONS: Record<string, string> = {
    standard: '標準的なトーンで、わかりやすく親しみやすい文章にしてください。',
    casual: 'カジュアルで親しみやすいトーンで、絵文字を使っても良いです。',
    polite: '丁寧で礼儀正しいトーンで、敬語を使ってください。',
}

const LENGTH_INSTRUCTIONS: Record<string, string> = {
    short: '5分程度で話せる短めの台本にしてください。要点を絞って簡潔に。',
    standard: '10分程度で話せる標準的な長さの台本にしてください。',
    long: '15分程度で話せる長めの台本にしてください。詳しく説明してください。',
}

export async function POST(request: Request) {
    try {
        const body: ScriptRequest = await request.json()
        const { memo, materials, tone, length } = body

        if (!memo?.trim()) {
            return NextResponse.json(
                { error: 'メモを入力してください' },
                { status: 400 }
            )
        }

        // Check if API key is configured
        if (!process.env.GOOGLE_AI_API_KEY) {
            // Return mock data
            console.log('API key not configured, returning mock script')
            return NextResponse.json({
                success: true,
                mock: true,
                script: {
                    title: '今日の気づきと学び',
                    opening: 'こんにちは！今日も聴いてくださりありがとうございます。\n今日は最近の気づきについて話してみようと思います。',
                    body: [
                        {
                            heading: '1. 最近感じたこと',
                            points: [
                                'メモに書いた内容をここで展開します',
                                '具体的なエピソードを交えて',
                                'リスナーにも共感してもらえるように',
                            ],
                        },
                        {
                            heading: '2. そこから学んだこと',
                            points: [
                                '感じたことから得た教訓',
                                '今後どう活かしていくか',
                                'リスナーへのメッセージ',
                            ],
                        },
                    ],
                    conclusion: '今日は最近の気づきについてお話ししました。\n皆さんも何か気づいたことがあれば、ぜひコメントで教えてくださいね。\nそれでは、また次回！',
                    estimatedTime: '10分',
                    fullText: `【タイトル】今日の気づきと学び

【オープニング】
こんにちは！今日も聴いてくださりありがとうございます。
今日は最近の気づきについて話してみようと思います。

【本編】
■ 1. 最近感じたこと
・メモに書いた内容をここで展開します
・具体的なエピソードを交えて
・リスナーにも共感してもらえるように

■ 2. そこから学んだこと
・感じたことから得た教訓
・今後どう活かしていくか
・リスナーへのメッセージ

【まとめ】
今日は最近の気づきについてお話ししました。
皆さんも何か気づいたことがあれば、ぜひコメントで教えてくださいね。
それでは、また次回！

⏱️ 話す目安：10分`,
                },
            })
        }

        // Generate script using Gemini
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

        const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.standard
        const lengthInstruction = LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.standard

        const materialsSection = materials.length > 0
            ? `\n\n## 参考素材（過去の投稿から）:\n${materials.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
            : ''

        const prompt = `あなたは音声配信の台本作成のプロフェッショナルです。
ユーザーのメモを元に、stand.fm用の台本を作成してください。

${toneInstruction}
${lengthInstruction}

## ユーザーのメモ:
${memo}
${materialsSection}

## 出力形式（JSON）:
以下のJSON形式で出力してください。JSONのみを出力し、それ以外の説明は不要です。

{
  "title": "タイトル案（絵文字付きで魅力的に）",
  "opening": "オープニング（つかみ。リスナーの興味を引く導入）",
  "body": [
    {
      "heading": "見出し1",
      "points": ["話すポイント1", "話すポイント2", "話すポイント3"]
    },
    {
      "heading": "見出し2",
      "points": ["話すポイント1", "話すポイント2"]
    }
  ],
  "conclusion": "まとめ（結論と次のアクション）",
  "estimatedTime": "話す目安時間（例：5分）"
}

注意事項:
- 話しやすい自然な流れを意識
- 箇条書きは「これを話す」というポイントのみ
- 完全な文章ではなく、話すきっかけとなるキーワード程度でOK
- 過去の素材がある場合は、関連する内容を自然に組み込む
`

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('Failed to parse AI response')
        }

        const parsed = JSON.parse(jsonMatch[0])

        // Build full text version
        const fullText = `【タイトル】${parsed.title}

【オープニング】
${parsed.opening}

【本編】
${parsed.body.map((section: { heading: string; points: string[] }) =>
            `■ ${section.heading}\n${section.points.map((p: string) => `・${p}`).join('\n')}`
        ).join('\n\n')}

【まとめ】
${parsed.conclusion}

⏱️ 話す目安：${parsed.estimatedTime}`

        return NextResponse.json({
            success: true,
            script: {
                ...parsed,
                fullText,
            },
        })
    } catch (error) {
        console.error('Script generation error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '台本生成に失敗しました' },
            { status: 500 }
        )
    }
}
