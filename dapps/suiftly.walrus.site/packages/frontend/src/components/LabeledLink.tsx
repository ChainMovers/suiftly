import React from 'react'
import { Flex, Text, Link } from '@radix-ui/themes'

interface LabeledLinkProps {
  label: string
  url: string
  minWidthLabel?: string
}

const LabeledLink: React.FC<LabeledLinkProps> = ({
  label,
  url,
  minWidthLabel = '110px',
}) => {
  return (
    <Flex direction="row" align="center" gap="1">
      <Text style={{ minWidth: minWidthLabel }}>{label} : </Text>
      <Link href={url} underline="hover">
        {url}
      </Link>
    </Flex>
  )
}

export default LabeledLink
