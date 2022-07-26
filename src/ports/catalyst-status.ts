import { IBaseComponent } from '@well-known-components/interfaces'
import { BaseComponents } from '../types'

export type CatalystStatus = {
  name: string
  baseUrl: string
}

export type CatalystParcelsInfo = {
  realmName: string
  url: string
  usersCount: number
  parcels: Map<string, number>
}

export type GlobalParcelsInfo = {
  tiles: string[]
  parcelsByCatalyst: CatalystParcelsInfo[]
}

export type ICatalystStatusComponent = IBaseComponent & {
  getGlobalCatalystsStatus: () => Promise<CatalystStatus[]>
  getGlobalParcelStatus: (status: CatalystStatus[]) => Promise<GlobalParcelsInfo>
}

export async function createCatalystStatusComponent(
  components: Pick<BaseComponents, 'config' | 'logs' | 'fetch' | 'contract'>
): Promise<ICatalystStatusComponent> {
  const { logs, fetch, contract } = components

  const logger = logs.getLogger('catalyst-status-component')

  async function getGlobalCatalystsStatus(): Promise<CatalystStatus[]> {
    const count = (await contract.catalystCount()).toNumber()

    const result: CatalystStatus[] = []

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

      try {
        const statusResponse = await fetch.fetch(`${baseUrl}/about`)
        const data = await statusResponse.json()

        if (data && data.configurations) {
          result.push({ baseUrl, name: data.configurations.realmName })
        }
      } catch (e: any) {
        logger.warn(`Error fetching ${baseUrl}/about: ${e.toString()}`)
      }
    }

    return result
  }

  async function getGlobalParcelStatus(status: CatalystStatus[]): Promise<GlobalParcelsInfo> {
    const tiles = new Set<string>()
    const parcelsByCatalyst: CatalystParcelsInfo[] = []
    for (const { baseUrl, name } of status) {
      try {
        const response = await fetch.fetch(`${baseUrl}/stats/parcel`)
        const data = await response.json()

        if (!data || !data.parcels) {
          continue
        }

        const parcels = new Map<string, number>()
        let usersCount = 0
        for (const {
          peersCount,
          parcel: { x, y }
        } of data.parcels) {
          usersCount += peersCount
          const tile = `${x},${y}`
          tiles.add(tile)
          parcels.set(tile, peersCount)
        }
        parcelsByCatalyst.push({ realmName: name, parcels, url: baseUrl, usersCount })
      } catch (e: any) {
        logger.warn(`Error fetching ${baseUrl}/stats/parcel: ${e.toString()}`)
      }
    }

    return {
      tiles: Array.from(tiles),
      parcelsByCatalyst
    }
  }

  return {
    getGlobalCatalystsStatus,
    getGlobalParcelStatus
  }
}
