import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// Web Share Targetのフォールバック。
// 通常はsw.jsが/api/shareへのPOSTを横取りして音声を端末内に保管するため、
// ここに届くのはService Worker未稼働時のみ。その場合は音声をVercel Blobへ
// 保存し、URLを/shareへ引き継ぐ(リダイレクトではPOSTボディを引き継げないため)。
// 注意: Vercelのリクエストボディ上限4.5MBがあるので、ここで扱えるのは小さいファイルのみ。

export const runtime = 'nodejs'

const MAX_FALLBACK_SIZE = 4 * 1024 * 1024

export async function POST(request: NextRequest) {
    const redirectUrl = new URL('/share', request.url)

    try {
        const formData = await request.formData()

        const audioFile = formData.get('audio') as File | null
        const title = formData.get('title') as string | null
        const text = formData.get('text') as string | null
        const url = formData.get('url') as string | null

        if (title) redirectUrl.searchParams.set('title', title)
        if (text) redirectUrl.searchParams.set('text', text)
        if (url) redirectUrl.searchParams.set('url', url)

        if (audioFile && audioFile.size > 0) {
            if (audioFile.size > MAX_FALLBACK_SIZE) {
                redirectUrl.searchParams.set('error', 'too-large')
            } else {
                const fileName = audioFile.name || 'shared-audio.m4a'
                const blob = await put(fileName, audioFile, {
                    access: 'public',
                    addRandomSuffix: true,
                })
                redirectUrl.searchParams.set('blobUrl', blob.url)
                redirectUrl.searchParams.set('fileName', fileName)
            }
        }

        // 303: POSTをGETに変えてリダイレクトする(既定の307だと/shareへ再POSTされて失敗する)
        return NextResponse.redirect(redirectUrl, 303)
    } catch (error) {
        console.error('Share API error:', error)
        redirectUrl.searchParams.set('error', 'share-failed')
        return NextResponse.redirect(redirectUrl, 303)
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const redirectUrl = new URL('/share', request.url)

    const title = searchParams.get('title')
    const text = searchParams.get('text')
    const url = searchParams.get('url')

    if (title) redirectUrl.searchParams.set('title', title)
    if (text) redirectUrl.searchParams.set('text', text)
    if (url) redirectUrl.searchParams.set('url', url)

    return NextResponse.redirect(redirectUrl, 303)
}
