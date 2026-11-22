// backend/src/server.ts
import { app } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`[MediFind Backend] Customer API listening on port ${ENV.PORT} (${ENV.NODE_ENV})`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
