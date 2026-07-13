import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT!, 10),
  corsOrigin: process.env.CORS_ORIGIN,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  nodeEnv: process.env.NODE_ENV,
  superAdminUsername: process.env.SUPER_ADMIN_USERNAME,
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
  superAdminName: process.env.SUPER_ADMIN_NAME,
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
}));
