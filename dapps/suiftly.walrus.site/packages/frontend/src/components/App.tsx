import { FC, useEffect, useRef } from 'react'
{
  /*import GreetingForm from '~~/components/GreetingForm'*/
}
import Layout from '~~/components/layout/Layout'
import NetworkSupportChecker from './NetworkSupportChecker'
import { fetchBlob } from '@suiftly/core'

// A fetchBlob() async function that take a single "blobID" string argument.
// It should return a promise that resolves to the blob data (a standard JS
// Blob interface).
//
// The blob data is first retreived with a CDN URL like this:
//    https://cdn.suiftly.io/blobs/{blobID}
//
// The function should extract the Content-Type header and use it
// to build the JS Blob object.
//
// The function should throw an error if the response status is not 200.
//
// Example usage:
//    const blob = await fetchBlob('some-blob-id')

const App: FC = () => {
  // TODO Just proof-of-concept... need to design this way better!!!!
  const fetchInitiated1 = useRef(false)
  const fetchInitiated2 = useRef(false)

  useEffect(() => {
    const blobID = 'fK7v0bft1JqVbxQaM_KJAYkejbY9FgU9doqZwg7smw8'
    const imageContainer1 = document.getElementById('image-container-walrus')
    const imageContainer2 = document.getElementById('image-container-suiftly')

    if (imageContainer1 && !fetchInitiated1.current) {
      fetchInitiated1.current = true
      fetchBlob(blobID, { allowSuiftly: false })
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          const img = document.createElement('img')
          img.src = url
          img.alt = 'Fetched Blob'

          // Clear the loading message and append the image
          if (imageContainer1) {
            imageContainer1.innerHTML = ''
            imageContainer1.appendChild(img)
          }
        })
        .catch((error) => {
          console.error('Error fetching walrus blob:', error)
          if (imageContainer1) {
            imageContainer1.innerHTML = '<p>Error loading walrus image</p>'
          }
        })
    }

    if (imageContainer2 && !fetchInitiated2.current) {
      fetchInitiated2.current = true
      fetchBlob(blobID, { allowSuiftly: true })
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          const img = document.createElement('img')
          img.src = url
          img.alt = 'Fetched Blob'

          // Clear the loading message and append the image
          if (imageContainer2) {
            imageContainer2.innerHTML = ''
            imageContainer2.appendChild(img)
          }
        })
        .catch((error) => {
          console.error('Error fetching suiftly blob:', error)
          if (imageContainer2) {
            imageContainer2.innerHTML = '<p>Error loading suiftly image</p>'
          }
        })
    }

    // Cleanup URL object when component unmounts
    return () => {
      if (imageContainer1) {
        const img = imageContainer1.querySelector('img')
        if (img) {
          URL.revokeObjectURL(img.src)
        }
      }
      if (imageContainer2) {
        const img = imageContainer2.querySelector('img')
        if (img) {
          URL.revokeObjectURL(img.src)
        }
      }
    }
  })

  return (
    <Layout>
      <NetworkSupportChecker />
      <div className="justify-content flex flex-grow flex-col items-center justify-center rounded-md p-3">
        {/*<GreetingForm />*/}

        <div
          id="image-container-suiftly"
          style={{ width: '128px', height: '128px' }}
        >
          <p>Loading image...</p>
        </div>

        <div
          id="image-container-walrus"
          style={{ width: '128px', height: '128px' }}
        >
          <p>Loading image...</p>
        </div>
      </div>
    </Layout>
  )
}

export default App
