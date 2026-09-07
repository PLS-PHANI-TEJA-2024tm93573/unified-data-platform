import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);



  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'assetmodel',
      protoPath: join(__dirname,'../proto/asset-model.proto'),
      url: '0.0.0.0:50051'
    }
  })

  

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // removies the prpoerties that arent part of the DTO
      forbidNonWhitelisted: true, // Instead of silently accepting extra fields , we reject the request.
      transform: true, // allows Nest/class-transformer to transform incoming values according to DTO metadata where appropriate.
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Asset Model Service API')
    .setDescription('REST API for asset types, variables, assets, and relationships')
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    jsonDocumentUrl: 'api/docs-json',
  });



  await app.startAllMicroservices();

  await app.listen(process.env.PORT ?? 3000);

}
bootstrap();
