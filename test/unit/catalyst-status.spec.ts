import { createLogComponent } from '@well-known-components/logger'
import { createCatalystStatusComponent } from '../../src/ports/catalyst-status'
import { IFetchComponent } from '@well-known-components/http-server'
import { BigNumber } from 'eth-connect'
import * as node_fetch from 'node-fetch'

export type FetchTestResponse = {
  status: number
  body: Record<string, any>
}

export function createTestFetchComponent(handler: (url: string) => FetchTestResponse): IFetchComponent {
  const fetch: IFetchComponent = {
    async fetch(info: node_fetch.RequestInfo, _?: node_fetch.RequestInit): Promise<node_fetch.Response> {
      const url = info.toString()
      const { body, status } = handler(url)
      const response = new node_fetch.Response(JSON.stringify(body), {
        status,
        url
      })
      return response
    }
  }

  return fetch
}

describe('catalyst-status-unit', () => {
  const contracts = [
    { id: Buffer.from('0'), domain: 'https://catalyst-1', owner: '' },
    { id: Buffer.from('1'), domain: 'http://catalyst-2', owner: '' },
    { id: Buffer.from('2'), domain: 'catalyst-3', owner: '' }
  ]

  const contract = {
    catalystCount: () => Promise.resolve(new BigNumber(contracts.length)),
    catalystIds: (ix: number) => Promise.resolve(contracts[ix].id),
    catalystById: (id: Uint8Array) => Promise.resolve(contracts[Number.parseInt(id.toString())])
  }

  describe('fetchCatalystsStatus', () => {
    it('should return empty if the request fail', async () => {
      const handler = (_?: string): FetchTestResponse => {
        throw new Error('not implemnted')
      }
      const logs = await createLogComponent({})
      const fetch = createTestFetchComponent(handler)
      const stats = await createCatalystStatusComponent({ logs, fetch, contract })

      const catalysts = await stats.fetchCatalystsStatus()
      expect(catalysts).toEqual([])
    })

    it('should fetch data for valid domains', async () => {
      let fetchRequests = 0
      const handler = (url: string): FetchTestResponse => {
        fetchRequests++
        const realmName = new URL(url).hostname
        return {
          status: 200,
          body: {
            configurations: {
              realmName
            }
          }
        }
      }
      const logs = await createLogComponent({})
      const fetch = createTestFetchComponent(handler)
      const stats = await createCatalystStatusComponent({ logs, fetch, contract })

      const catalysts = await stats.fetchCatalystsStatus()
      expect(fetchRequests).toEqual(2)
      expect(catalysts).toHaveLength(2)
      expect(catalysts).toEqual(
        expect.arrayContaining([
          { baseUrl: 'https://catalyst-1', name: 'catalyst-1' },
          { baseUrl: 'https://catalyst-3', name: 'catalyst-3' }
        ])
      )
    })
  })

  describe('fetchParcels', () => {
    it('should fetch data', async () => {
      const catalysts = [
        { baseUrl: 'https://catalyst-1', name: 'catalyst-1' },
        { baseUrl: 'https://catalyst-2', name: 'catalyst-2' }
      ]

      const parcels = [
        {
          peersCount: 10,
          parcel: {
            x: 10,
            y: 10
          }
        }
      ]

      const handler = (url: string): FetchTestResponse => {
        if (url === 'https://catalyst-1/stats/parcels') {
          return {
            status: 200,
            body: { parcels }
          }
        }

        return { status: 500, body: {} }
      }

      const logs = await createLogComponent({})
      const fetch = createTestFetchComponent(handler)
      const stats = await createCatalystStatusComponent({ logs, fetch, contract })

      const result = await stats.fetchParcels(catalysts)
      expect(result).toHaveLength(1)
      expect(result).toEqual(expect.arrayContaining([{ url: 'https://catalyst-1', realmName: 'catalyst-1', parcels }]))
    })
  })
})
