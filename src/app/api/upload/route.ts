import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

// 4MB超の音声ファイル用: クライアントからVercel Blobへ直接アップロードするためのトークン発行
// (サーバーを経由しないのでVercelの4.5MBリクエスト制限を受けない)

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: [
                    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
                    'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg',
                    'audio/aac', 'audio/x-caf',
                ],
                maximumSizeInBytes: 24 * 1024 * 1024, // Whisper APIの25MB上限に合わせる
                addRandomSuffix: true,
                // 音声は一時ファイル扱い。定期的に消したい場合はVercelダッシュボードから削除
            }),
            onUploadCompleted: async () => {
                // 完了通知は不要(クライアントがURLを/api/processへ渡す)
            },
        })

        return NextResponse.json(jsonResponse)
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'アップロードに失敗しました' },
            { status: 400 }
        )
    }
}
