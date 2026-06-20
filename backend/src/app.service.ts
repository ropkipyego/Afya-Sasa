import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      service: 'AfyaSasa Clinical Management System',
      scope: 'Phase 1 foundation',
    };
  }
}
