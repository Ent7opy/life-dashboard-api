require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errors');
const v1Router = require('./routes/v1');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ name: 'Canopy API', version: '1.0.0', status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/v1', v1Router);

app.use(errorHandler);

app.listen(PORT, () => console.log(`Canopy API running on :${PORT}`));
