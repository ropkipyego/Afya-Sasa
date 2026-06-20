import { Controller, Get } from '@nestjs/common';
import { Public } from '../core/auth/auth.decorators';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'afyasasa-backend' };
  }
}
