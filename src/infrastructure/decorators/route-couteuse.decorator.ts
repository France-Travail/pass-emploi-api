import { CustomDecorator, SetMetadata } from '@nestjs/common'

export const ROUTE_COUTEUSE_KEY = 'routeCouteuse'
export const RouteCouteuse = (): CustomDecorator<string> =>
  SetMetadata(ROUTE_COUTEUSE_KEY, true)
