import { realmsHandler } from '../../src/controllers/handlers/realms-handler'
import { CatalystParcelsInfo, ICatalystStatusComponent } from '../../src/ports/catalyst-status'
import { RealmInfo } from '../../src/types'

describe('hot-scenes-handler-unit', () => {
  it('ok', async () => {
    const parcels: CatalystParcelsInfo[] = [
      {
        realmName: 'catalyst-1',
        url: 'https://catalyst-1',
        parcels: [
          {
            peersCount: 10,
            parcel: {
              x: 10,
              y: 10
            }
          },
          {
            peersCount: 1,
            parcel: {
              x: 11,
              y: 10
            }
          }
        ]
      },
      {
        realmName: 'catalyst-2',
        url: 'https://catalyst-2',
        parcels: [
          {
            peersCount: 5,
            parcel: {
              x: 10,
              y: 10
            }
          }
        ]
      }
    ]

    const catalystStatus: ICatalystStatusComponent = {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      getParcels: (): Promise<[number, CatalystParcelsInfo[]]> => Promise.resolve([0, parcels])
    }

    const url = new URL('https://aggregator.com/realms')
    const { headers, body } = await realmsHandler({ url, components: { catalystStatus } })

    const result: RealmInfo[] = body
    expect(headers['Last-Modified']).toEqual('Thu, 01 Jan 1970 00:00:00 GMT')

    expect(result).toEqual([
      {
        serverName: 'catalyst-1',
        url: 'https://catalyst-1',
        usersCount: 11,
        userParcels: [
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [11, 10]
        ]
      },
      {
        serverName: 'catalyst-2',
        url: 'https://catalyst-2',
        usersCount: 5,
        userParcels: [
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10],
          [10, 10]
        ]
      }
    ])
  })
})
