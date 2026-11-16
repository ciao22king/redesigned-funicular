/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "img-src 'self' https://avatars.githubusercontent.com data:",
              "style-src 'self' 'unsafe-inline'",
              // Cloudflare Web Analytics beacon: the script comes from
              // cloudflareinsights.com and reports back to it, so both
              // script-src and connect-src must allow that origin.
              //
              // `wasm-unsafe-eval` is what lets the browser compile the WebLLM
              // kernel: without it the CSP blocks WebAssembly compilation and
              // the engine fails with an opaque error.
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com",
              // WebLLM (the on-device model behind /skiller) fetches its weights
              // from huggingface.co and its compiled kernel from GitHub, so
              // connect-src must allow those origins too, or the model loads and
              // then dies silently.
              "connect-src 'self' https://cloudflareinsights.com https://huggingface.co https://*.hf.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://raw.githubusercontent.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;