import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // removies the prpoerties that arent part of the DTO
      forbidNonWhitelisted: true, // Instead of silently accepting extra fields , we reject the request.
      transform: true, // allows Nest/class-transformer to transform incoming values according to DTO metadata where appropriate.
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
