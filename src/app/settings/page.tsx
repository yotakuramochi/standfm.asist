'use client'

import { useState, useEffect } from 'react'

interface ProfileSettings {
    achievements: string[]
    targetAudience: string
    channelDescription: string
    xLink: string
    customLinks: { name: string; url: string }[]
}

const PROFILE_KEY = 'standfm-ai-profile'

const DEFAULT_PROFILE: ProfileSettings = {
    achievements: ['', '', ''],
    targetAudience: '',
    channelDescription: '',
    xLink: '',
    customLinks: [{ name: '', url: '' }],
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<ProfileSettings>(DEFAULT_PROFILE)
    const [isSaving, setIsSaving] = useState(false)
    const [showSaved, setShowSaved] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem(PROFILE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                setProfile({ ...DEFAULT_PROFILE, ...parsed })
            } catch (e) {
                console.error('Failed to parse profile:', e)
            }
        }
    }, [])

    const handleSave = () => {
        setIsSaving(true)
        try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
            setShowSaved(true)
            setTimeout(() => setShowSaved(false), 2000)
        } catch (e) {
            console.error('Failed to save profile:', e)
        }
        setIsSaving(false)
    }

    const updateAchievement = (index: number, value: string) => {
        const newAchievements = [...profile.achievements]
        newAchievements[index] = value
        setProfile({ ...profile, achievements: newAchievements })
    }

    const addCustomLink = () => {
        setProfile({
            ...profile,
            customLinks: [...profile.customLinks, { name: '', url: '' }],
        })
    }

    const updateCustomLink = (index: number, field: 'name' | 'url', value: string) => {
        const newLinks = [...profile.customLinks]
        newLinks[index] = { ...newLinks[index], [field]: value }
        setProfile({ ...profile, customLinks: newLinks })
    }

    const removeCustomLink = (index: number) => {
        const newLinks = profile.customLinks.filter((_, i) => i !== index)
        setProfile({ ...profile, customLinks: newLinks.length ? newLinks : [{ name: '', url: '' }] })
    }

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">プロフィール設定</h1>
            </div>

            {/* Save Success Message */}
            {showSaved && (
                <div className="alert-success rounded-lg p-4 mb-6">
                    ✅ 保存しました！
                </div>
            )}

            {/* 基本情報 Section */}
            <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span>✏️</span> 基本情報
                </h2>

                {/* ニックネーム */}
                <div className="mb-6">
                    <label className="field-label">ニックネーム</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="表示名を入力"
                    />
                </div>

                {/* アイコン */}
                <div className="mb-6">
                    <label className="field-label">アイコン</label>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                            👤
                        </div>
                        <button className="px-4 py-2 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50">
                            画像を変更
                        </button>
                    </div>
                </div>

                {/* 一言紹介 */}
                <div className="mb-6">
                    <label className="field-label">一言紹介</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="例：毎日配信してます！"
                    />
                </div>
            </section>

            {/* 強み・実績の提示 Section */}
            <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>🏆</span> 強み・実績の提示
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    概要欄に表示する、直近のトピック3つまでを選べます。（テンプレートとして使われます。）
                </p>

                {profile.achievements.map((achievement, index) => (
                    <div key={index} className="mb-4">
                        <label className="field-label">実績 {index + 1}</label>
                        <input
                            type="text"
                            value={achievement}
                            onChange={(e) => updateAchievement(index, e.target.value)}
                            className="input-field"
                            placeholder={
                                index === 0 ? "例：1000フォロワー達成" :
                                    index === 1 ? "例：noteを累計3000PV達成" :
                                        "例：stand.fm Partner認定"
                            }
                        />
                    </div>
                ))}
            </section>

            {/* ターゲット設定 Section */}
            <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>🎯</span> ターゲット設定
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    あなたの音声を誰に届けたいですか？<br />
                    設定すると、AIがターゲットに合わせた文章を生成します。
                </p>

                <div className="mb-4">
                    <label className="field-label">ターゲット層</label>
                    <textarea
                        value={profile.targetAudience}
                        onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })}
                        className="input-field resize-none"
                        rows={3}
                        placeholder="例：副業を始めたい会社員、フリーランスを目指す人、挑戦している人の話を聞きたい人"
                    />
                </div>
            </section>

            {/* チャンネルについて Section */}
            <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>📻</span> チャンネルについて
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    概要欄の「▼このチャンネルでは」に表示されます。
                </p>

                <div className="mb-4">
                    <label className="field-label">チャンネルの説明</label>
                    <textarea
                        value={profile.channelDescription}
                        onChange={(e) => setProfile({ ...profile, channelDescription: e.target.value })}
                        className="input-field resize-none"
                        rows={4}
                        placeholder="例：理学療法士、Webライター、副業、インタビュー企画など、実体験をもとに発信しています。&#10;&quot;今、挑戦している人&quot;の背中を押せるような内容を目指しています。"
                    />
                </div>
            </section>

            {/* 🔗 概要欄スタイル設定 Section */}
            <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>🔗</span> 概要欄スタイル設定
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    概要欄に表示するリンクを設定します。
                </p>

                {/* X Link */}
                <div className="mb-6">
                    <label className="field-label">X（旧Twitter）</label>
                    <input
                        type="url"
                        value={profile.xLink}
                        onChange={(e) => setProfile({ ...profile, xLink: e.target.value })}
                        className="input-field"
                        placeholder="https://x.com/yourusername"
                    />
                </div>

                {/* Custom Links */}
                <div className="mb-4">
                    <label className="field-label">その他のリンク</label>
                    {profile.customLinks.map((link, index) => (
                        <div key={index} className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={link.name}
                                onChange={(e) => updateCustomLink(index, 'name', e.target.value)}
                                className="input-field flex-1"
                                placeholder="名称（例：おもろい図鑑）"
                            />
                            <input
                                type="url"
                                value={link.url}
                                onChange={(e) => updateCustomLink(index, 'url', e.target.value)}
                                className="input-field flex-1"
                                placeholder="URL"
                            />
                            {profile.customLinks.length > 1 && (
                                <button
                                    onClick={() => removeCustomLink(index)}
                                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={addCustomLink}
                        className="text-sm text-orange-600 hover:text-orange-700"
                    >
                        ＋ リンクを追加
                    </button>
                </div>
            </section>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-4 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
                {isSaving ? '保存中...' : '💾 設定をアプリに反映する'}
            </button>

            {/* Preview Section */}
            <section className="mt-12 pt-8 border-t border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>👁️</span> プレビュー（概要欄の出力例）
                </h2>

                <div className="bg-gray-50 rounded-xl p-6 text-sm">
                    <div className="alert-info rounded-lg p-4 mb-6">
                        💡 <strong>ヒント:</strong> 以下のような形式で概要欄が生成されます。AIで生成した概要（上の部分以外）は毎回変わります。
                    </div>

                    <div className="bg-white rounded-lg p-5 border border-gray-200 whitespace-pre-wrap text-gray-700">
                        {profile.channelDescription && (
                            <>
                                <div className="font-medium text-gray-900 mb-1">▼このチャンネルでは</div>
                                <div className="mb-4">{profile.channelDescription}</div>
                            </>
                        )}
                        {profile.xLink && (
                            <div className="mb-3">
                                <span className="font-medium text-gray-900">▪️X（旧Twitter）</span>
                                <br />
                                <span className="text-blue-600">{profile.xLink}</span>
                            </div>
                        )}
                        {profile.customLinks.filter(l => l.name && l.url).map((link, i) => (
                            <div key={i} className="mb-3">
                                <span className="font-medium text-gray-900">▪️{link.name}</span>
                                <br />
                                <span className="text-blue-600">{link.url}</span>
                            </div>
                        ))}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="font-bold text-orange-600 mb-2">【AI要約】</div>
                            <div className="text-gray-500 italic">（ここにAI生成の概要欄が追加されます）</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Account Section */}
            <section className="mt-12 pt-8 border-t border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>👤</span> アカウント・サインイン連携
                </h2>

                <div className="space-y-3">
                    <button className="w-full py-3 px-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span>🔗</span>
                            <span>Twitterと連携してサインイン</span>
                        </div>
                        <span className="text-gray-400">→</span>
                    </button>
                </div>
            </section>

            {/* Version */}
            <p className="text-center text-xs text-gray-400 mt-12">
                v0.1.0 (MVP)
            </p>
        </div>
    )
}
