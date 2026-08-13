import { SetMetadata } from '@nestjs/common'

export const USER_JOURNEY_METADATA = 'user_journey'

export const UserJourney = (journey: string): MethodDecorator =>
  SetMetadata(USER_JOURNEY_METADATA, journey)
