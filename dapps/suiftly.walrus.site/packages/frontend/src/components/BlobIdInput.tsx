import React from 'react'
import { TextField, Button, Flex } from '@radix-ui/themes'

interface BlobIdInputProps {
  blobId: string
  defaultBlobId: string
  setBlobId: (blobId: string) => void
}

const BlobIdInput: React.FC<BlobIdInputProps> = ({
  blobId,
  defaultBlobId,
  setBlobId,
}) => {
  const handleReset = () => {
    setBlobId(defaultBlobId)
  }

  return (
    <Flex direction="row" gap="2" width="400" align="center">
      {/*<label htmlFor="blobIdInput">
        <Text>Blob ID:</Text>
      </label>*/}
      <TextField.Root
        size="2"
        color="green"
        radius="large"
        value={blobId}
        variant="soft"
        onChange={(e) => setBlobId(e.target.value)}
        placeholder={defaultBlobId}
        style={{ width: '400px' }} // Set the width here
      />
      {blobId !== defaultBlobId && (
        <Button onClick={handleReset}>Reset to default</Button>
      )}
    </Flex>
  )
}

export default BlobIdInput
