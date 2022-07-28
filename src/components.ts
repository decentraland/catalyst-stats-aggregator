import { HTTPProvider } from 'eth-connect'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createServerComponent, createStatusCheckComponent } from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { catalystRegistryForProvider } from '@dcl/catalyst-contracts'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createFetchComponent } from './ports/fetch'
import { AppComponents, GlobalContext } from './types'
import { metricDeclarations } from './metrics'
import { createCatalystStatusComponent } from './ports/catalyst-status'
import { createContentComponent } from './ports/content'
import 'isomorphic-fetch'

const DEFAULT_ETH_NETWORK = 'ropsten'

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: ['.env.default', '.env'] })

  const ethNetwork = (await config.getString('ETH_NETWORK')) ?? DEFAULT_ETH_NETWORK

  const logs = createLogComponent({})
  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const statusChecks = await createStatusCheckComponent({ server, config })
  const fetch = await createFetchComponent()
  const metrics = await createMetricsComponent(metricDeclarations, { server, config })

  const ethereumProvider = new HTTPProvider(
    `https://rpc.decentraland.org/${encodeURIComponent(ethNetwork)}?project=explorer-bff`
  )

  const contract = await catalystRegistryForProvider(ethereumProvider)
  const catalystStatus = await createCatalystStatusComponent({ logs, fetch, contract })
  const content = await createContentComponent({ config })

  return {
    config,
    logs,
    server,
    statusChecks,
    fetch,
    metrics,
    contract,
    catalystStatus,
    content
  }
}
