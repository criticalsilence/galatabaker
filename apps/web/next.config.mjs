/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@galatabaker/sdk'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Beacon SDK + BLS sadece browser'da yasar (localStorage, WebSocket, native
      // addon). Server bundle'a girerse 'Client-only API' veya 'Can't resolve
      // fs' hatasi aliriz. resolve.alias = false modulu bos yapar, runtime
      // import bos module doner, ama type-only import'lar zaten silinir.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@galatabaker/sdk/wallet$': false,
        '@galatabaker/sdk/bls$': false,
        '@taquito/beacon-wallet$': false,
        '@airgap/beacon-sdk$': false,
        '@airgap/beacon-dapp$': false,
        '@airgap/beacon-ui$': false,
        'qrcode-svg$': false,
        'bls-signatures$': false,
      };
    }
    return config;
  },
};

export default nextConfig;
