import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Parsers
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Listen to Azure-provided port
  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();
