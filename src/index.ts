import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { coachRouter } from './routes/coach.js';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const origins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({ origin: origins.length ? origins : '*' }));
app.use(morgan('dev'));

app.get('/api/health', (_: any, res: any) => res.json({ 
  ok: true, 
  service: 'soberstride-api', 
  ts: new Date().toISOString() 
}));

app.use('/api/coach', coachRouter);

app.use((req: any, res: any) => res.status(404).json({ 
  error: 'Not Found', 
  path: req.path 
}));

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  const code = err?.status || 500;
  res.status(code).json({ error: err?.message || 'Internal Server Error' });
});

const port = Number(process.env.PORT) || 8080;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

export default app;
