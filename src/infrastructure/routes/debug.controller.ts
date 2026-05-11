import { HttpService } from '@nestjs/axios'
import { Controller, Get } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { Public } from '../decorators/public.decorator'

@Controller()
export class DebugController {
  constructor(private readonly httpService: HttpService) {}

  @Public()
  @Get('debug/throw')
  throwForLogTest(): never {
    throw new Error('test errored log')
  }

  @Public()
  @Get('debug/slow')
  async slowForLogTest(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5000))
    return 'ok'
  }

  @Public()
  @Get('debug/external-api-success')
  async externalApiSuccess(): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get('https://httpbin.org/status/200', {
        headers: { Authorization: 'Bearer fake-secret-pour-test-redact' }
      })
    )
    return { status: response.status }
  }

  @Public()
  @Get('debug/external-api-4xx')
  async externalApi4xx(): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get('https://httpbin.org/status/401', {
        headers: { Authorization: 'Bearer fake-secret-pour-test-redact' }
      })
    )
    return { status: response.status }
  }

  @Public()
  @Get('debug/external-api-failure')
  async externalApiFailure(): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get(
        'https://this-domain-does-not-exist-123456789.invalid/x',
        {
          headers: { Authorization: 'Bearer fake-secret-pour-test-redact' }
        }
      )
    )
    return { status: response.status }
  }
}
