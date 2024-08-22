import { useCurrentAccount } from '@mysten/dapp-kit'
import { Link } from '@radix-ui/themes'
import { HeartIcon, SearchIcon } from 'lucide-react'
import Faucet from '~~/components/Faucet'
import ThemeSwitcher from '~~/components/ThemeSwitcher'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/networks'
import { packageUrl } from '~~/helpers/networks'
import useNetworkConfig from '~~/hooks/useNetworkConfig'

const Footer = () => {
  const { useNetworkVariables } = useNetworkConfig()
  const networkVariables = useNetworkVariables()
  const explorerUrl = networkVariables[EXPLORER_URL_VARIABLE_NAME]
  const packageId = networkVariables[CONTRACT_PACKAGE_VARIABLE_NAME]
  const currentAccount = useCurrentAccount()

  return (
    <footer className="flex w-full flex-col items-center justify-between gap-3 p-3 sm:flex-row sm:items-end">
      <div className="flex flex-row gap-3 lg:w-1/3">
        {currentAccount != null && (
          <>
            <Faucet />
            <Link
              href={packageUrl(explorerUrl, packageId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-row items-center gap-1"
              highContrast={true}
            >
              <SearchIcon className="h-4 w-4" />
              <span>Block Explorer</span>
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-grow flex-col items-center justify-center gap-1">
        <div className="flex flex-row items-center justify-center gap-1">
          <span>Built with</span>
          <HeartIcon className="h-4 w-4" />
          <span>by</span>
          <Link
            href="https://github.com/kkomelin"
            target="_blank"
            rel="noopener noreferrer"
            highContrast={true}
          >
            @kkomelin
          </Link>
          <span>·</span>
          <Link
            href="https://github.com/kkomelin/sui-dapp-starter/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            highContrast={true}
          >
            Support
          </Link>
        </div>
        <div className="text-center text-sm opacity-70">
          SVG graphics, used in NFTs, have been borrowed from{' '}
          <Link
            href="https://github.com/twitter/twemoji"
            target="_blank"
            rel="noopener noreferrer"
            highContrast={true}
          >
            twitter/twemoji
          </Link><br/>and licensed under{' '}
          <Link
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            highContrast={true}
          >
            CC-BY 4.0
          </Link>
        </div>
      </div>

      <div className="flex flex-row justify-end lg:w-1/3">
        <ThemeSwitcher />
      </div>
    </footer>
  )
}
export default Footer
