import { Controller, Get, Post } from '@nestjs/common'
import { Public } from '../../../src/infrastructure/decorators/public.decorator'
import { RouteCouteuse } from '../../../src/infrastructure/decorators/route-couteuse.decorator'
import {
  OidcQueryToken,
  SkipOidcAuth
} from '../../../src/infrastructure/decorators/skip-oidc-auth.decorator'

@Controller('/rate-limit')
export class FakeRateLimitController {
  @Get('/a')
  async getA(): Promise<string> {
    return '👌'
  }

  @Get('/b')
  async getB(): Promise<string> {
    return '👌'
  }

  @OidcQueryToken()
  @Get('/oidc-query-token')
  async getOidcQueryToken(): Promise<string> {
    return '👌'
  }

  @Public()
  @Get('/public')
  async getPublic(): Promise<string> {
    return '👌'
  }

  @SkipOidcAuth()
  @Get('/skip-oidc-auth')
  async getSkipOidcAuth(): Promise<string> {
    return '👌'
  }

  @RouteCouteuse()
  @Post('/couteuse')
  async postCouteuse(): Promise<string> {
    return '👌'
  }
}
