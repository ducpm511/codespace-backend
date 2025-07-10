import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //   }),
  // );

  app.enableCors({
    origin: ['http://localhost:4000', 'http://localhost:3001'], // Hoặc một mảng các origin nếu cần
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Nếu bạn cần xử lý cookies hoặc authorization headers
  });

  app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));
  await app.listen(3000);
}
bootstrap();
