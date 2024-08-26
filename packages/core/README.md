
[![Discord chat](https://img.shields.io/discord/1038616996062953554.svg?logo=discord&style=flat-square)](https://discord.gg/Erb6SwsVbH) [![Active Development](https://img.shields.io/badge/Maintenance%20Level-Actively%20Developed-brightgreen.svg)](https://gist.github.com/cheerfulstoic/d107229326a01ff0f333a1d3476e068d)

# Suiftly - CDN Optimizations for Sui Walrus

Important: Project in alpha development. Not working yet!!!

More info: [https://suiftly.io](https://suiftly.io/)


# Functions

Retrieve a Walrus blob for a given blob ID.

Attempts first to download and verify integrity from the CDN.

On failure, try next with a direct download from the Walrus network. This fallback is possible only for webapp published at <your_site>.walrus.site.

Returns a standard JS Blob with its mime-type properly defined.

The blob can be further converted to a URL object. Example with an 'image/png':
```js
import { fetchBlob } from '@suiftly/core';

async function loadImage() {
    const blob = await fetchBlob({blobId:"AqizY7o7lAAB_DdqQ_4x1Ldg-yOWZRWrWterJZoKHZc"});

    // Create a URL object from the blob
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById("imageDisplay").src = imageUrl;
}

loadImage();
```