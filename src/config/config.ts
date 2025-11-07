// src/config/config.ts
// Bot configuration

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  },
  slyde: {
    apiUrl: process.env.SLYDE_API_URL || 'http://localhost:3000',
    apiKey: process.env.SLYDE_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
};

// Validate required config
export function validateConfig(): boolean {
  const required = ['telegram.botToken', 'telegram.botUsername'];
  let valid = true;

  required.forEach(key => {
    const [section, field] = key.split('.');
    const value = (config as any)[section]?.[field];

    if (!value) {
      console.error(`❌ Missing required config: ${key}`);
      valid = false;
    }
  });

  return valid;
}

export default config;
