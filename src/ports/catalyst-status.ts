import { IBaseComponent } from '@well-known-components/interfaces'
import { BaseComponents } from '../types'

export type CatalystStatus = {
  name: string
  baseUrl: string
}

export type CatalystParcelsInfo = {
  realmName: string
  url: string
  parcels: {
    peersCount: number
    parcel: {
      x: number
      y: number
    }
  }[]
}

export type ICatalystStatusComponent = IBaseComponent & {
  start: () => Promise<void>
  stop: () => Promise<void>
  getParcels: () => Promise<[number, CatalystParcelsInfo[]]>
}

const CATALYST_STATUS_EXPIRATION_TIME = 1000 * 60 * 15 // 15 mins
const PARCELS_UPDATE_INTERVAL = 1000 * 60 // 1 min

export async function createCatalystStatusComponent(
  components: Pick<BaseComponents, 'config' | 'logs' | 'fetch' | 'contract'>
): Promise<ICatalystStatusComponent> {
  const { logs, fetch, contract } = components

  const logger = logs.getLogger('catalyst-status-component')

  async function getGlobalCatalystsStatus(): Promise<CatalystStatus[]> {
    const count = (await contract.catalystCount()).toNumber()

    const urls: string[] = []
    for (let ix = 0; ix < count; ix++) {
      const id = await contract.catalystIds(ix)
      const { domain } = await contract.catalystById(id)

      let baseUrl = domain.trim()

      if (baseUrl.startsWith('http://')) {
        logger.warn(`Catalyst node domain using http protocol, skipping ${baseUrl}`)
        continue
      }

      if (!baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl
      }

      urls.push(baseUrl)
    }

    const result: CatalystStatus[] = []
    await Promise.all(
      urls.map(async (baseUrl: string) => {
        try {
          const statusResponse = await fetch.fetch(`${baseUrl}/about`)
          const data = await statusResponse.json()

          if (data && data.configurations) {
            result.push({ baseUrl, name: data.configurations.realmName })
          }
        } catch (e: any) {
          logger.warn(`Error fetching ${baseUrl}/about: ${e.toString()}`)
        }
      })
    )

    return result
  }

  let lastGlobalCatalystStatus: CatalystStatus[] | undefined = undefined
  let lastGlobalCatalystStatusTime = 0

  async function fetchParcels(): Promise<CatalystParcelsInfo[]> {
    if (!lastGlobalCatalystStatus || Date.now() - lastGlobalCatalystStatusTime > CATALYST_STATUS_EXPIRATION_TIME) {
      lastGlobalCatalystStatus = await getGlobalCatalystsStatus()
      lastGlobalCatalystStatusTime = Date.now()
    }

    const result: CatalystParcelsInfo[] = []
    await Promise.all(
      lastGlobalCatalystStatus.map(async ({ baseUrl, name }) => {
        try {
          const response = await fetch.fetch(`${baseUrl}/stats/parcels`)
          const data = await response.json()
          if (data && data.parcels) {
            result.push({ url: baseUrl, realmName: name, parcels: data.parcels })
          }
        } catch (e: any) {
          logger.warn(`Error fetching ${baseUrl}/stats/parcel: ${e.toString()}`)
        }
      })
    )

    return result
  }

  let lastParcelsTime: number = 0
  let lastParcels: CatalystParcelsInfo[] | undefined = undefined

  async function getParcels(): Promise<[number, CatalystParcelsInfo[]]> {
    if (!lastParcels) {
      lastParcels = await fetchParcels()
      lastParcelsTime = Date.now()
    }

    return [lastParcelsTime, lastParcels]
  }

  let updateInterval: NodeJS.Timer | undefined = undefined

  async function start() {
    lastParcels = await fetchParcels()
    lastParcelsTime = Date.now()

    updateInterval = setInterval(async () => {
      lastParcels = await fetchParcels()
      lastParcelsTime = Date.now()
    }, PARCELS_UPDATE_INTERVAL)
  }

  async function stop() {
    if (updateInterval) {
      clearInterval(updateInterval)
    }
  }

  return {
    start,
    stop,
    getParcels
  }
}
