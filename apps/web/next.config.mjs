/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@galatabaker/sdk'],
  // Beacon SDK browser-only paketleri server bundle'a girmesin.
  serverComponentsExternalPackages: [
    '@taquito/beacon-wallet',
    '@airgap/beacon-sdk',
    '@airgap/beacon-dapp',
    '@airgap/beacon-ui',
    'bls-signatures',
  ],
};

export default nextConfig;
