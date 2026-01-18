import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Stand.fm inspired color palette
                primary: {
                    50: '#fef7ee',
                    100: '#fdedd3',
                    200: '#fad7a5',
                    300: '#f6b96d',
                    400: '#f19132',
                    500: '#ee7711', // Main brand color
                    600: '#df5d07',
                    700: '#b94509',
                    800: '#93370f',
                    900: '#772f10',
                },
                dark: {
                    50: '#f6f6f7',
                    100: '#e2e3e5',
                    200: '#c5c6ca',
                    300: '#a0a2a8',
                    400: '#7b7d85',
                    500: '#60626a',
                    600: '#4c4e54',
                    700: '#3f4045',
                    800: '#27282b', // Background dark
                    900: '#1a1b1d', // Darker background
                },
            },
            fontFamily: {
                sans: ['Inter', 'Hiragino Sans', 'Meiryo', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-gentle': 'bounce 2s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}

export default config
