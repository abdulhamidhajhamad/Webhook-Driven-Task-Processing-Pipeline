import dotenv from 'dotenv';
dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
};