import express from 'express';
import bodyParser from 'body-parser';
import { router as templatesRouter } from './routes/templates.js';
import { router as calendarRouter } from './routes/calendar.js';
import { router as readRouter } from './routes/read.js';

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

app.use('/api/templates', templatesRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api', readRouter);

const port = process.env.PORT || 3009;
app.listen(port, () => console.log(`[api] listening on :${port}`));
