import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for mobile app
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Aura API')
    .setDescription('Backend service for Aura mobile app - AI-powered image processing and aura generation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'Phone number + OTP authentication endpoints')
    .addTag('Users', 'User profile management endpoints')
    .addTag('Images', 'Image upload and processing endpoints')
    .addTag('Aura', 'AI-powered aura generation endpoints')
    .addTag('Social', 'Social features - follow/unfollow endpoints')
    .addTag('Leaderboard', 'User ranking and leaderboard endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
  
  console.log(`🚀 Aura API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
