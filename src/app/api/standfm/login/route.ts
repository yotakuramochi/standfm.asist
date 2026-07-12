import { NextResponse } from 'next/server'
import { openStandfmLogin } from '@/lib/standfm/automation'

export const runtime = 'nodejs'

const STANDFM_URL = process.env.STANDFM_MANUAL_URL || 'https://stand.fm/'

export async function POST() {
    try {
        const result = await openStandfmLogin()

        return NextResponse.json({
            success: true,
            data: result,
        })
    } catch (error) {
        console.error('stand.fm login automation unavailable:', error)

        return NextResponse.json({
            success: true,
            data: {
                status: 'needs_attention',
                message: 'この環境ではstand.fm用ブラウザを自動起動できませんでした。stand.fmを手動で開いてログインしてください。',
                url: STANDFM_URL,
                warnings: ['Chromeの自動起動が制限されています。リンクからstand.fmを開いてください。'],
            },
        })
    }
}
