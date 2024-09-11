
# Try it!     (No account required)

You can load any Blob ID with the following URL pattern:

`https://cdn.suiftly.io/blob/{Any Blob ID}`

Example: https://cdn.suiftly.io/blob/fK7v0bft1JqVbxQaM_KJAYkejbY9FgU9doqZwg7smw8

Check also the Walrus demo for more tricks:<br/>
https://suiftly.walrus.site

**Features**
  - 123 edge servers spread globally. DDoS protected.
  - CDN response with valid Content-Type header (e.g. image/png)
  - Backend caching to minimize re-aggregation from Walrus.

**Notes**
  - First click is slower because the blob is being retrieved from Walrus and then cached.
  - Blob size limited to 200 MiB (for devnet).


See [documentation](intro.md) for more features!

# How to measure CDN performances?
(1) Open Chrome incognito and the dev tools ( Ctrl-Shift-I ).
(2) Select Network and "Disable cache".
(3) Refresh page to measure load time.
(4) You can observe the CDN headers.


![Chrome Dev Tools](./.vuepress/public/assets/chrome-dev-tool-2.png)