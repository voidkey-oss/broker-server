import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for development
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Voidkey broker server is running on: http://localhost:${port}`);
  console.log(`📡 Credentials endpoint: POST http://localhost:${port}/credentials/mint`);
}

bootstrap();