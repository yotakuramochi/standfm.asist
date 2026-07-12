import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Browser, BrowserContext, Page } from 'playwright-core'

type SaveStatus = 'saved' | 'needs_attention'

export interface StandfmSaveInput {
    audioPath: string
    title: string
    description: string
}

export interface StandfmAutomationResult {
    status: SaveStatus | 'opened'
    message: string
    url?: string
    warnings?: string[]
}

declare global {
    // eslint-disable-next-line no-var
    var __standfmBrowser: Browser | undefined
    // eslint-disable-next-line no-var
    var __standfmBrowserContext: BrowserContext | undefined
    // eslint-disable-next-line no-var
    var __standfmPage: Page | undefined
}

const execFileAsync = promisify(execFile)

const DEFAULT_DRAFT_URLS = [
    process.env.STANDFM_DRAFT_URL,
    'https://stand.fm/episodes/new',
    'https://stand.fm/recordings/new',
    'https://stand.fm/',
].filter(Boolean) as string[]

const LOGIN_URL = process.env.STANDFM_LOGIN_URL || 'https://stand.fm/'
const PROFILE_DIR = path.resolve(
    process.cwd(),
    process.env.STANDFM_BROWSER_PROFILE_DIR || '.standfm-browser-profile'
)
const CDP_PORT = Number(process.env.STANDFM_REMOTE_DEBUGGING_PORT || '9222')
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`
const CHROME_APP_CANDIDATES = [
    process.env.STANDFM_CHROME_APP_PATH,
    '/Applications/Google Chrome.app',
    `${process.env.HOME || ''}/Applications/Google Chrome.app`,
].filter(Boolean) as string[]

const TITLE_PATTERNS = [/タイトル/i, /title/i, /題名/i]
const DESCRIPTION_PATTERNS = [/概要/i, /説明/i, /本文/i, /description/i, /caption/i, /body/i]
const SAVE_PATTERNS = [/下書き保存/i, /保存する/i, /保存/i, /save/i, /draft/i]
const NEXT_PATTERNS = [/次へ/i, /続ける/i, /next/i, /continue/i]
const UPLOAD_PATTERNS = [/アップロード/i, /音声ファイル/i, /ファイル/i, /upload/i, /audio/i]

async function isCdpReady() {
    try {
        const response = await fetch(`${CDP_URL}/json/version`, {
            signal: AbortSignal.timeout(800),
        })

        return response.ok
    } catch {
        return false
    }
}

async function waitForCdp() {
    for (let i = 0; i < 30; i += 1) {
        if (await isCdpReady()) return
        await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error('stand.fm 操作用Chromeへの接続準備ができませんでした。Chromeが開いているか確認してください。')
}

async function openChromeWithRemoteDebugging() {
    if (await isCdpReady()) return

    await fs.mkdir(PROFILE_DIR, { recursive: true })

    if (process.platform === 'darwin') {
        let chromeAppPath: string | null = null

        for (const candidate of CHROME_APP_CANDIDATES) {
            try {
                await fs.access(candidate)
                chromeAppPath = candidate
                break
            } catch {
                // Try the next Chrome location.
            }
        }

        if (!chromeAppPath) {
            throw new Error('Google Chrome.app が見つかりませんでした。STANDFM_CHROME_APP_PATH にChromeの場所を設定してください。')
        }

        await execFileAsync('/usr/bin/open', [
            '-n',
            chromeAppPath,
            '--args',
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${PROFILE_DIR}`,
            '--no-first-run',
            '--no-default-browser-check',
        ])
    } else if (process.env.STANDFM_BROWSER_EXECUTABLE_PATH) {
        await execFileAsync(process.env.STANDFM_BROWSER_EXECUTABLE_PATH, [
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${PROFILE_DIR}`,
            '--no-first-run',
            '--no-default-browser-check',
        ])
    } else {
        throw new Error('Google Chrome を開けませんでした。Chromeをインストールするか、STANDFM_BROWSER_EXECUTABLE_PATH を設定してください。')
    }

    await waitForCdp()
}

async function getContext() {
    if (globalThis.__standfmBrowserContext) {
        return globalThis.__standfmBrowserContext
    }

    try {
        await openChromeWithRemoteDebugging()

        const { chromium } = await import('playwright-core')
        globalThis.__standfmBrowser = await chromium.connectOverCDP(CDP_URL)

        const context = globalThis.__standfmBrowser.contexts()[0]
        if (!context) {
            throw new Error('Chromeの操作用プロファイルを取得できませんでした。')
        }

        globalThis.__standfmBrowserContext = context
    } catch (error) {
        throw new Error(
            [
                'stand.fm 操作用のブラウザを開けませんでした。',
                'Chromeが落ちる場合は、既存のstand.fm操作用Chromeを閉じてからもう一度「ログインを開く」を押してください。',
                error instanceof Error ? error.message : String(error),
            ].join('\n')
        )
    }

    return globalThis.__standfmBrowserContext
}

async function getPage() {
    const context = await getContext()
    const existingPage = globalThis.__standfmPage

    if (existingPage && !existingPage.isClosed()) {
        return existingPage
    }

    const page = context.pages()[0] || await context.newPage()
    page.setDefaultTimeout(5000)
    globalThis.__standfmPage = page

    return page
}

async function openUrl(page: Page, urls: string[]) {
    let lastError: unknown = null

    for (const url of urls) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await page.waitForTimeout(1000)
            return
        } catch (error) {
            lastError = error
        }
    }

    throw lastError instanceof Error ? lastError : new Error('stand.fm を開けませんでした')
}

async function clickByPatterns(page: Page, patterns: RegExp[], timeout = 1500) {
    for (const pattern of patterns) {
        const candidates = [
            page.getByRole('button', { name: pattern }).first(),
            page.getByRole('link', { name: pattern }).first(),
            page.getByText(pattern).first(),
        ]

        for (const candidate of candidates) {
            try {
                await candidate.waitFor({ state: 'visible', timeout })
                await candidate.click()
                await page.waitForTimeout(1000)
                return true
            } catch {
                // Try the next candidate.
            }
        }
    }

    return false
}

async function uploadAudio(page: Page, audioPath: string) {
    const fileInputs = page.locator('input[type="file"]')

    if (await fileInputs.count()) {
        await fileInputs.first().setInputFiles(audioPath)
        await page.waitForTimeout(2000)
        return true
    }

    await clickByPatterns(page, UPLOAD_PATTERNS, 2000)
    await page.waitForTimeout(1000)

    if (await fileInputs.count()) {
        await fileInputs.first().setInputFiles(audioPath)
        await page.waitForTimeout(2000)
        return true
    }

    return false
}

async function fillByPatterns(page: Page, patterns: RegExp[], value: string) {
    const fields = await page
        .locator('textarea, input[type="text"], input:not([type]), [contenteditable="true"]')
        .elementHandles()

    for (const field of fields) {
        const isVisible = await field.isVisible().catch(() => false)
        if (!isVisible) continue

        const fieldText = await field.evaluate((element) => {
            const input = element as HTMLInputElement | HTMLTextAreaElement
            const labels = input.labels
                ? Array.from(input.labels).map((label) => label.textContent || '')
                : []

            return [
                ...labels,
                input.getAttribute('aria-label') || '',
                input.getAttribute('placeholder') || '',
                input.getAttribute('name') || '',
                input.getAttribute('id') || '',
                input.closest('label')?.textContent || '',
                input.parentElement?.textContent?.slice(0, 200) || '',
            ].join(' ')
        })

        if (patterns.some((pattern) => pattern.test(fieldText))) {
            const contentEditable = await field.evaluate((element) =>
                (element as HTMLElement).getAttribute('contenteditable') === 'true'
            )

            if (contentEditable) {
                await field.evaluate((element, nextValue) => {
                    const editable = element as HTMLElement
                    editable.textContent = nextValue
                    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
                    editable.dispatchEvent(new Event('change', { bubbles: true }))
                }, value)
            } else {
                await field.fill(value)
            }

            return true
        }
    }

    return false
}

async function fillDraftFields(page: Page, title: string, description: string) {
    const titleFilled = await fillByPatterns(page, TITLE_PATTERNS, title)
    const descriptionFilled = await fillByPatterns(page, DESCRIPTION_PATTERNS, description)

    return { titleFilled, descriptionFilled }
}

async function trySaveDraft(page: Page) {
    for (const pattern of SAVE_PATTERNS) {
        const button = page.getByRole('button', { name: pattern }).first()

        try {
            await button.waitFor({ state: 'visible', timeout: 2500 })

            const label = await button.textContent()
            if (label && /公開|publish/i.test(label)) {
                continue
            }

            await button.click()
            await page.waitForTimeout(2000)
            return true
        } catch {
            // Try the next save label.
        }
    }

    return false
}

export async function openStandfmLogin(): Promise<StandfmAutomationResult> {
    const page = await getPage()
    await openUrl(page, [LOGIN_URL])
    await clickByPatterns(page, [/ログイン/i, /sign in/i, /login/i], 2000)

    return {
        status: 'opened',
        message: 'stand.fm のログイン画面を開きました。ログイン後、このアプリに戻って保存を実行してください。',
        url: page.url(),
    }
}

export async function saveDraftToStandfm(input: StandfmSaveInput): Promise<StandfmAutomationResult> {
    const warnings: string[] = []
    const page = await getPage()

    await openUrl(page, DEFAULT_DRAFT_URLS)

    let uploaded = await uploadAudio(page, input.audioPath)

    if (!uploaded) {
        warnings.push('音声ファイルのアップロード欄を自動で見つけられませんでした。開いた stand.fm 画面で音声を選んでください。')
    }

    let fields = await fillDraftFields(page, input.title, input.description)

    if (!fields.titleFilled || !fields.descriptionFilled) {
        await clickByPatterns(page, NEXT_PATTERNS, 2000)
        fields = await fillDraftFields(page, input.title, input.description)
    }

    if (!fields.titleFilled) {
        warnings.push('タイトル欄を自動で見つけられませんでした。')
    }

    if (!fields.descriptionFilled) {
        warnings.push('概要欄を自動で見つけられませんでした。')
    }

    if (warnings.length > 0) {
        return {
            status: 'needs_attention',
            message: 'stand.fm の画面を開きました。見つけられなかった項目だけ手動で入れて保存してください。',
            url: page.url(),
            warnings,
        }
    }

    const saved = await trySaveDraft(page)

    if (!saved) {
        return {
            status: 'needs_attention',
            message: 'タイトルと概要欄は入力できましたが、下書き保存ボタンは自動で押せませんでした。開いた画面で保存してください。',
            url: page.url(),
            warnings: ['保存ボタンを自動で見つけられませんでした。'],
        }
    }

    return {
        status: 'saved',
        message: 'stand.fm に下書き保存しました。',
        url: page.url(),
    }
}
