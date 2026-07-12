/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable experimental features for better mobile experience
    experimental: {
        serverComponentsExternalPackages: ['playwright-core'],
        serverActions: {
            bodySizeLimit: '50mb', // Allow larger audio files
        },
    },
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push({
                'playwright-core': 'commonjs playwright-core',
            })
        }

        return config
    },
}

module.exports = nextConfig
