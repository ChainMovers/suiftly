import React from 'react'
import { Flex, Text, Link } from '@radix-ui/themes'

interface LabeledLinkProps {
  label: string
  blobId: string
}

const LabeledLinkSuiftly: React.FC<LabeledLinkProps> = ({ label, blobId }) => {
  const url = `https://cdn.suiftly.io/${label}/${blobId}`
  return (
    <Flex direction="row" align="center" gap="1">
      <Text>{label} : </Text>
      <Link href={url} underline="hover">
        https://cdn.suiftly.io/<b>{label}</b>/{blobId}
      </Link>
    </Flex>
  )
}

export default LabeledLinkSuiftly
