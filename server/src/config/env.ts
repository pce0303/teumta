import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TOUR_API_KEY: z.string().optional().default(''),
  CONGESTION_API_KEY: z.string().optional().default(''),
  TMAP_API_KEY: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid server environment variables');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
