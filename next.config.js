/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable experimental features for better mobile experience
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb', // Allow larger audio files
        },
    },
}

module.exports = nextConfig
