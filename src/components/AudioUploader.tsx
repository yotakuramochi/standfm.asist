'use client'

import { useRef, useState } from 'react'

interface AudioUploaderProps {
    onFileSelect: (file: File) => void
}

export default function AudioUploader({ onFileSelect }: AudioUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            onFileSelect(file)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) {
            onFileSelect(file)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    return (
        <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
        relative overflow-hidden
        rounded-2xl p-8 sm:p-12 lg:p-16
        flex flex-col items-center justify-center
        min-h-[250px] sm:min-h-[300px] lg:min-h-[350px]
        cursor-pointer transition-all
        ${isDragging
                    ? 'border-2 border-orange-500 bg-orange-50'
                    : 'border-2 border-dashed border-gray-300 hover:border-orange-400 bg-gray-50 hover:bg-orange-50/50'
                }
      `}
        >
            {/* Icon */}
            <div className={`
        text-6xl sm:text-7xl lg:text-8xl mb-6 transition-transform
        ${isDragging ? 'scale-110' : ''}
      `}>
                🎙️
            </div>

            {/* Text */}
            <div className="text-center space-y-3">
                <p className="text-xl sm:text-2xl font-medium text-gray-800">
                    {isDragging ? '離してアップロード' : '音声ファイルをドラッグ＆ドロップ'}
                </p>
                <p className="text-base text-gray-500">
                    または、クリックしてファイルを選択
                </p>
                <p className="text-sm text-gray-400">
                    対応形式: mp3, m4a, wav, webm（30MB以下）
                </p>
            </div>

            {/* Button */}
            <div className="mt-8 px-8 py-4 rounded-full bg-orange-500 text-white font-medium text-lg hover:bg-orange-600 transition-colors">
                ファイルを選択
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    )
}
