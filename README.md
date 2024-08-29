# Suiftly - CDN Optimizations for Sui Walrus

Load most Walrus blobs in less than 100 milliseconds!

Join the discussion on [Discord](https://discord.com/invite/Erb6SwsVbH)

# Direct Links

You can load any blob with a direct link:
https://cdn.suiftly.io/blob/{blobID}

Example:
https://cdn.suiftly.io/blob/fK7v0bft1JqVbxQaM_KJAYkejbY9FgU9doqZwg7smw8

First click is slower to perform one-time aggregation and caching for subsequent fast requests.

Suiftly returns proper MIME Content-Type header (e.g. image/png).

# NPM Packages

See [@suiftly/core](https://www.npmjs.com/package/@suiftly/core)

Works for any Web2/Web3 browser and NodeJS apps.

As simple as `fetchBlob(blobID)`

Features:

-   Try CDN first, failover to Walrus
-   Blob integrity check.
-   Returns standard JS Blob object with proper MIME type.

Installation:
`npm install @suiftly/core`

# Thank you!

-   [Mysten Labs](https://mystenlabs.com) and the [Sui foundation](https://sui.io) for their innovations and financial support.
-   [kkomelin/sui-dapp-starter](https://github.com/kkomelin/sui-dapp-starter) time saver template
-   [Solana](https://github.com/solana-labs/solana-web3.js) inspiring monorepo scoped packages structure, which is mostly re-used for this project.
