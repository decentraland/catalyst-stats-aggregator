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
  getGlobalCatalystsStatus: () => Promise<CatalystStatus[]>
  getParcels: (status: CatalystStatus[]) => Promise<CatalystParcelsInfo[]>
}

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

  async function getParcels(status: CatalystStatus[]): Promise<CatalystParcelsInfo[]> {
    const result: CatalystParcelsInfo[] = []

    await Promise.all(
      status.map(async ({ baseUrl, name }) => {
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

  return {
    getGlobalCatalystsStatus,
    getParcels
  }
}
