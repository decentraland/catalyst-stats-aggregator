import { HandlerContextWithPath, RealmInfo, ParcelCoord } from '../../types'

// handlers arguments only type what they need, to make unit testing easier
export async function realmsHandler(
  context: Pick<HandlerContextWithPath<'catalystStatus' | 'content', '/hot-scenes'>, 'url' | 'components'>
) {
  const {
    components: { catalystStatus }
  } = context

  const [time, info] = await catalystStatus.getParcels()
  const realms: RealmInfo[] = []
  for (const catalystParcelInfo of info) {
    if (!catalystParcelInfo) {
      continue
    }

    const { url, realmName } = catalystParcelInfo

    const userParcels: ParcelCoord[] = []
    let usersCount = 0
    for (const {
      peersCount,
      parcel: { x, y }
    } of catalystParcelInfo.parcels) {
      usersCount += peersCount
      for (let i = 0; i < peersCount; i++) {
        userParcels.push([x, y])
      }
    }

    realms.push({ serverName: realmName, url, userParcels, usersCount })
  }

  return {
    headers: {
      'Last-Modified': new Date(time).toUTCString()
    },
    body: realms
  }
}
