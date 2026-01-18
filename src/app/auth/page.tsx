'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    const supabase = createClient()

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                })
                if (error) throw error
                setMessage({ type: 'success', text: '確認メールを送信しました！メールをチェックしてください。' })
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                window.location.href = '/'
            }
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : '認証エラーが発生しました' })
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleAuth = async () => {
        setLoading(true)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (error) throw error
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Googleログインに失敗しました' })
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="text-5xl">🎙️</div>
                    <h1 className="text-2xl font-bold">スタエフ AIアシスタント</h1>
                    <p className="text-gray-400 text-sm">
                        {isSignUp ? 'アカウントを作成' : 'ログインして利用開始'}
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`p-4 rounded-xl text-sm ${message.type === 'error'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-green-500/10 text-green-400 border border-green-500/30'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Google Login */}
                <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl glass flex items-center justify-center gap-3 hover:bg-white/10 btn-press disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Googleでログイン</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-gray-500 text-sm">または</span>
                    <div className="flex-1 h-px bg-gray-700" />
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm text-gray-400 mb-2">
                            メールアドレス
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full glass rounded-xl px-4 py-3 bg-transparent border border-gray-700 focus:border-primary-500 focus:outline-none"
                            placeholder="example@email.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
                            パスワード
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full glass rounded-xl px-4 py-3 bg-transparent border border-gray-700 focus:border-primary-500 focus:outline-none"
                            placeholder="6文字以上"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium btn-press disabled:opacity-50"
                    >
                        {loading ? '処理中...' : isSignUp ? 'アカウント作成' : 'ログイン'}
                    </button>
                </form>

                {/* Toggle */}
                <p className="text-center text-sm text-gray-400">
                    {isSignUp ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでないですか？'}
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setMessage(null)
                        }}
                        className="ml-2 text-primary-400 hover:underline"
                    >
                        {isSignUp ? 'ログイン' : '新規登録'}
                    </button>
                </p>

                {/* Skip for now (development) */}
                <div className="text-center">
                    <a href="/" className="text-xs text-gray-600 hover:text-gray-400">
                        ログインせずに試す →
                    </a>
                </div>
            </div>
        </div>
    )
}
