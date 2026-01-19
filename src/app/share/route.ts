import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        // Get shared file
        const audioFile = formData.get('audio') as File | null
        const title = formData.get('title') as string | null
        const text = formData.get('text') as string | null
        const url = formData.get('url') as string | null

        // Build redirect URL with query params
        const redirectUrl = new URL('/share', request.url)

        if (title) redirectUrl.searchParams.set('title', title)
        if (text) redirectUrl.searchParams.set('text', text)
        if (url) redirectUrl.searchParams.set('url', url)

        // For file sharing, we need to handle it differently
        // Since we can't pass file data via URL, redirect to share page
        // The share page will have a file input for manual selection
        if (audioFile) {
            redirectUrl.searchParams.set('hasFile', 'true')
            redirectUrl.searchParams.set('fileName', audioFile.name)
        }

        return NextResponse.redirect(redirectUrl)
    } catch (error) {
        console.error('Share API error:', error)
        return NextResponse.redirect(new URL('/share?error=true', request.url))
    }
}

// Handle GET requests (text/url sharing)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)

    const redirectUrl = new URL('/share', request.url)

    const title = searchParams.get('title')
    const text = searchParams.get('text')
    const url = searchParams.get('url')

    if (title) redirectUrl.searchParams.set('title', title)
    if (text) redirectUrl.searchParams.set('text', text)
    if (url) redirectUrl.searchParams.set('url', url)

    return NextResponse.redirect(redirectUrl)
}
