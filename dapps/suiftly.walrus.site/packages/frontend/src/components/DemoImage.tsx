import React, { useState } from 'react'
import { Button, Flex, Text } from '@radix-ui/themes'

interface DemoImageProps {
  code: string
  onRunCode: () => void
}

const DemoImage: React.FC<DemoImageProps> = ({ code, onRunCode }) => {
  const [imageDisplayed, setImageDisplayed] = useState(false)

  const handleRunCode = () => {
    setImageDisplayed(true)
    onRunCode()
  }

  const handleClearImage = () => {
    const imageContainer = document.getElementById('image-container')
    if (imageContainer) {
      const existing_img = imageContainer.querySelector('img')
      if (existing_img) {
        imageContainer.removeChild(existing_img)
      }
    }
    setImageDisplayed(false)
  }

  return (
    <Flex
      className="demo-image-container"
      direction="row"
      gap="2"
      align="center"
    >
      <Flex className="code-section" direction="column" gap="1" p="3">
        <pre
          className="code-block"
          style={{
            backgroundColor: '#f3f4f6',
            padding: '3px',
            borderRadius: '10px',
          }}
        >
          <code>{code}</code>
        </pre>
      </Flex>
      <Flex direction="column" gap="2" align="center">
        <Flex
          id="image-container"
          className="image-container"
          style={{
            width: '128px',
            height: '128px',
            border: '1px solid #ccc',
            flex: 'none',
          }}
          align="center"
          justify="center"
        >
          <Text>image-container</Text>
        </Flex>

        <Flex>
          {imageDisplayed ? (
            <Button
              className="clear-image-button"
              variant="solid"
              color="red"
              onClick={handleClearImage}
            >
              Clear Image
            </Button>
          ) : (
            <Button
              className="run-code-button"
              variant="solid"
              color="blue"
              onClick={handleRunCode}
            >
              Run Code
            </Button>
          )}
        </Flex>
      </Flex>
    </Flex>
  )
}

export default DemoImage
