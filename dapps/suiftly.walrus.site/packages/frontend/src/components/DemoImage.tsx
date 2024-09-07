import React, { useState } from 'react'
import { Button, Flex, Text } from '@radix-ui/themes'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
// For styles see:
//  https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_PRISM.MD

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
        <SyntaxHighlighter
          language="typescript"
          style={a11yDark}
          customStyle={{ fontSize: '1.1em', margin: 0, padding: '0 20px 0 0' }}
        >
          {code}
        </SyntaxHighlighter>
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
