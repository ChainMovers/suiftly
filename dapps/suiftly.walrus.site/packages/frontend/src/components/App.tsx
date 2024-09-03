import { FC, useState } from 'react'
import Layout from '~~/components/layout/Layout'
{
  /*import NetworkSupportChecker from './NetworkSupportChecker'*/
}
import { fetchBlob } from '@suiftly/core'
import DemoImage from './DemoImage'
import { Link, Text } from '@radix-ui/themes'
import LabeledLinkSuiftly from './LabeledLinkSuiftly'
import BlobIdInput from './BlobIdInput'
import LabeledLink from './LabeledLink'

const App: FC = () => {
  const defaultBlobId = 'fK7v0bft1JqVbxQaM_KJAYkejbY9FgU9doqZwg7smw8'
  const [blobId, setBlobId] = useState(defaultBlobId)

  const handleRunCode = () => {
    const imageContainer = document.getElementById('image-container')
    if (imageContainer) {
      fetchBlob(blobId)
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          const img = document.createElement('img')
          img.src = url
          img.alt = 'Fetched Blob'

          imageContainer.innerHTML = ''
          imageContainer.appendChild(img)
        })
        .catch((error) => {
          console.error('Error fetching walrus blob:', blobId, error)
          if (imageContainer) {
            imageContainer.innerHTML = '<p>Error loading walrus image</p>'
          }
        })
    }
  }

  const codeSnippet = `
    const imageContainer = document.getElementById('image-container')
    if (imageContainer) {
      const blobId = '${blobId}'
      fetchBlob(blobId)
        .then((blob) => {
          const img = document.createElement('img')
          img.src = URL.createObjectURL(blob)
          img.alt = 'Fetched Blob'
          imageContainer.appendChild(img)
        })
        .catch((error) => {
          console.error('Error fetching:', blobId, error)
        })
    }
  `

  return (
    <Layout>
      {/*<NetworkSupportChecker />*/}
      <div className="justify-content flex flex-grow flex-col rounded-md p-3">
        <div className="align-center flex flex-row items-center justify-center">
          <h1 className="text-3xl font-bold">
            <Text>Suiftly Demo</Text>
          </h1>
        </div>
        <br />
        <Text>Optionally customize this demo with any image blob ID:</Text>
        <BlobIdInput
          blobId={blobId}
          defaultBlobId={defaultBlobId}
          setBlobId={setBlobId}
        />
        <br />
        <br />
        <h2 className="text-xl font-semibold">
          <Text>Direct Links (Trust your CDN)</Text>
        </h2>
        <LabeledLinkSuiftly label="blob" blobId={blobId} />
        <LabeledLinkSuiftly label="metrics" blobId={blobId} />
        <LabeledLinkSuiftly label="view" blobId={blobId} />
        <br />
        <h2 className="text-xl font-semibold">
          <Text>NPM Package (Trust your CDN... but verify)</Text>
        </h2>
        <Text>
          Install
          <Link href="https://www.npmjs.com/package/@suiftly/core">
            @suiftly/core
          </Link>{' '}
          to fetch blobs with Suiftly to Walrus failover and blob integrity
          checks.
        </Text>
        <DemoImage code={codeSnippet} onRunCode={handleRunCode} />
        <Text style={{ fontSize: 20 }}>
          <br />
          Coming soon: Simpler react components like{' '}
          <b>&lt;ImageBlob blobId="..."&gt;</b>
        </Text>
        <br />
        <LabeledLink label="More info" url="https://suiftly.io" />
        <LabeledLink
          label="NPM Package"
          url="https://www.npmjs.com/package/@suiftly/core"
        />
        <LabeledLink
          label="GitHub"
          url="https://github.com/chainmovers/suiftly"
        />
        <LabeledLink
          label="Discord"
          url="https://discord.com/invite/Erb6SwsVbH"
        />
      </div>
    </Layout>
  )
}

export default App
