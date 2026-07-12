'use client'

import { useEffect } from 'react'

export default function PwaRegistration() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return

        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.error('Failed to register service worker:', error)
        })
    }, [])

    return null
}
