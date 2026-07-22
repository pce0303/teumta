import { prisma } from '../utils/prisma';

export async function getHealthStatus() {
  await prisma.$queryRaw`SELECT 1`;

  return {
    status: 'ok',
    service: 'teumta-server',
    database: 'connected',
  };
}
