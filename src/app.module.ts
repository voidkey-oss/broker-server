import { Module } from '@nestjs/common';
import { CredentialsModule } from './credentials/credentials.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [CredentialsModule, HealthModule],
})
export class AppModule {}