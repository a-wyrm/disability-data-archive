import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';

autoStart();

function autoStart() {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Archive listening on http://localhost:${info.port}`);
  });
}
