'use client'

type ProcessingStatus = 'uploading' | 'transcribing' | 'generating'

interface ProgressIndicatorProps {
    status: ProcessingStatus
    progress: number
}

const STATUS_CONFIG = {
    uploading: {
        label: 'アップロード中...',
        emoji: '📤',
    },
    transcribing: {
        label: '文字起こし中...',
        emoji: '🎯',
    },
    generating: {
        label: 'コンテンツ生成中...',
        emoji: '✨',
    },
}

export default function ProgressIndicator({ status, progress }: ProgressIndicatorProps) {
    const config = STATUS_CONFIG[status]

    const steps = [
        { key: 'uploading', label: 'アップロード' },
        { key: 'transcribing', label: '文字起こし' },
        { key: 'generating', label: '生成' },
    ]

    const currentIndex = steps.findIndex(s => s.key === status)

    return (
        <div className="card p-8 space-y-6">
            {/* Current Status */}
            <div className="text-center space-y-2">
                <div className="text-5xl animate-bounce">
                    {config.emoji}
                </div>
                <p className="text-xl font-medium text-gray-800">{config.label}</p>
                <p className="text-sm text-gray-500">
                    {progress}% 完了
                </p>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between items-center">
                {steps.map((step, i) => {
                    const isCompleted = i < currentIndex
                    const isCurrent = i === currentIndex
                    const isPending = i > currentIndex

                    return (
                        <div key={step.key} className="flex flex-col items-center gap-1">
                            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                ${isCompleted ? 'bg-green-500 text-white' : ''}
                ${isCurrent ? 'bg-orange-500 text-white' : ''}
                ${isPending ? 'bg-gray-100 text-gray-400' : ''}
              `}>
                                {isCompleted ? '✓' : i + 1}
                            </div>
                            <span className={`text-xs ${isCurrent ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                                {step.label}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Tip */}
            <p className="text-center text-sm text-gray-400">
                💡 処理中は他のアプリを使って大丈夫です
            </p>
        </div>
    )
}
