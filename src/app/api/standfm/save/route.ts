import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { saveDraftToStandfm } from '@/lib/standfm/automation'

export const runtime = 'nodejs'

const UPLOAD_DIR = path.resolve(process.cwd(), '.standfm-uploads')
const STANDFM_URL = process.env.STANDFM_MANUAL_URL || 'https://stand.fm/'

function safeExtension(fileName: string) {
    const ext = path.extname(fileName).toLowerCase()
    return ext && /^[a-z0-9.]+$/.test(ext) ? ext : '.mp3'
}

export async function POST(request: Request) {
    let audioPath: string | null = null

    try {
        const formData = await request.formData()
        const audioFile = formData.get('audio') as File | null
        const title = String(formData.get('title') || '').trim()
        const description = String(formData.get('description') || '').trim()

        if (!audioFile) {
            return NextResponse.json(
                { success: false, error: '音声ファイルがありません' },
                { status: 400 }
            )
        }

        if (!title || !description) {
            return NextResponse.json(
                { success: false, error: 'タイトルと概要欄が必要です' },
                { status: 400 }
            )
        }

        await fs.mkdir(UPLOAD_DIR, { recursive: true })

        const buffer = Buffer.from(await audioFile.arrayBuffer())
        audioPath = path.join(UPLOAD_DIR, `${Date.now()}-${randomUUID()}${safeExtension(audioFile.name)}`)
        await fs.writeFile(audioPath, buffer)

        const result = await saveDraftToStandfm({
            audioPath,
            title,
            description,
        })

        if (result.status === 'saved') {
            await fs.unlink(audioPath).catch(() => undefined)
            audioPath = null
        }

        return NextResponse.json({
            success: true,
            data: result,
        })
    } catch (error) {
        if (audioPath) {
            await fs.unlink(audioPath).catch(() => undefined)
        }

        console.error('stand.fm save automation unavailable:', error)

        return NextResponse.json({
            success: true,
            data: {
                status: 'needs_attention',
                message: 'stand.fmへの自動保存はできませんでした。stand.fmを開いて、生成済みのタイトルと概要欄を手動で貼り付けてください。',
                url: STANDFM_URL,
                warnings: ['Chromeの自動操作が制限されています。生成結果をコピーして手動で保存してください。'],
            },
        })
    }
}
