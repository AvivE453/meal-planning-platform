import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'infra/prisma/schema.prisma',
  migrations: {
    path: 'infra/prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
