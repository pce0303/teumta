import { app } from './app';
import { env } from './config/env';
import { prisma } from './utils/prisma';

async function bootstrap() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connected');

    app.listen(env.PORT, () => {
      console.log(`teumta-server listening on port ${env.PORT}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to start teumta-server because the database connection failed.');
    console.error(message);
    process.exit(1);
  }
}

void bootstrap();
