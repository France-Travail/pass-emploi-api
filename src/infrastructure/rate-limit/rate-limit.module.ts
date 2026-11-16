import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'
import { lireRateLimitConfig, RateLimitConfig } from './rate-limit.config'
import { RateLimitRedisStorage } from './rate-limit-redis.storage'
import { creerThrottlers } from './rate-limit.throttlers'

export const RATE_LIMIT_CONFIG = 'RATE_LIMIT_CONFIG'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_CONFIG,
      inject: [ConfigService],
      useFactory: lireRateLimitConfig
    }
  ],
  exports: [RATE_LIMIT_CONFIG]
})
class RateLimitConfigModule {}

@Module({
  imports: [
    RateLimitConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RateLimitConfigModule],
      inject: [RATE_LIMIT_CONFIG],
      useFactory: (
        config: RateLimitConfig | undefined
      ): ThrottlerModuleOptions =>
        config
          ? {
              throttlers: creerThrottlers(config),
              setHeaders: false,
              storage: new RateLimitRedisStorage(config.redisUrl)
            }
          : { throttlers: [] }
    })
  ],
  exports: [RateLimitConfigModule]
})
export class RateLimitModule {}
