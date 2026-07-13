import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

function translateValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const err of errors) {
    if (err.constraints) {
      for (const [key, msg] of Object.entries(err.constraints)) {
        messages.push(translateMessage(msg, err.property));
      }
    }
    if (err.children?.length) {
      messages.push(...translateValidationErrors(err.children));
    }
  }

  return messages;
}

function translateMessage(msg: string, property: string): string {
  const fieldNames: Record<string, string> = {
    plate: 'placa',
    model: 'modelo',
    name: 'nombre',
    username: 'usuario',
    password: 'contraseña',
    address: 'dirección',
    phone: 'teléfono',
    description: 'descripción',
    latitude: 'latitud',
    longitude: 'longitud',
    hospitalId: 'hospital',
    ambulanceId: 'ambulancia',
    driverId: 'conductor',
    callerName: 'nombre del llamante',
    callerPhone: 'teléfono del llamante',
    currentPassword: 'contraseña actual',
    newPassword: 'nueva contraseña',
    platePhoto: 'foto de placa',
    role: 'rol',
    status: 'estado',
  };

  const fieldName = fieldNames[property] || property
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();

  if (msg.includes('must be longer than or equal to')) {
    const match = msg.match(/(\d+)/);
    return match
      ? `${fieldName} debe tener al menos ${match[1]} caracteres`
      : `${fieldName} es demasiado corto`;
  }

  if (msg.includes('must not be empty')) {
    return `${fieldName} no debe estar vacío`;
  }

  if (msg.includes('must be a string')) {
    return `${fieldName} debe ser un texto`;
  }

  if (
    msg.includes('must be a number conforming to the specified constraints') ||
    msg.includes('must be an integer number')
  ) {
    return `${fieldName} debe ser un número`;
  }

  if (msg.includes('must be a boolean value')) {
    return `${fieldName} debe ser un valor booleano`;
  }

  if (msg.includes('must be a valid enum value')) {
    return `${fieldName} no es un valor válido`;
  }

  if (msg.includes('must be a UUID')) {
    return `${fieldName} debe ser un UUID válido`;
  }

  if (msg.includes('must be an email')) {
    return `${fieldName} debe ser un email válido`;
  }

  if (msg.includes('should not exist')) {
    const match = msg.match(/property (\w+)/);
    return match
      ? `el campo "${match[1]}" no está permitido`
      : `campo no permitido`;
  }

  return `${fieldName}: ${msg}`;
}

async function bootstrap() {
  const uploadDir = join(process.cwd(), 'uploads', 'ambulance-plates');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  app.enableCors({
    origin: configService.get('app.corsOrigin'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          statusCode: 400,
          message: translateValidationErrors(errors),
          error: 'Bad Request',
        }),
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ambulance Routing API')
    .setDescription('API para el sistema de simulación y optimización de asignación de ambulancias')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('app.port');
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
