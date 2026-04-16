import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import mediaRoutes from './routes/media.js';
import contactRoutes from './routes/contacts.js';
import businessRoutes from './routes/businesses.js';
import workerRoutes from './routes/workers.js';
import farmRoutes from './routes/farms.js';
import houseRoutes from './routes/houses.js';
import batchRoutes from './routes/batches.js';
import sourceRoutes from './routes/sources.js';
import expenseRoutes from './routes/expenses.js';
import feedItemRoutes from './routes/feedItems.js';
import feedOrderRoutes from './routes/feedOrders.js';
import saleOrderRoutes from './routes/saleOrders.js';
import transferRoutes from './routes/transfers.js';
import dailyLogRoutes from './routes/dailyLogs.js';
import syncRoutes from './routes/sync.js';
import devRoutes from './routes/dev.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/feed-items', feedItemRoutes);
app.use('/api/feed-orders', feedOrderRoutes);
app.use('/api/sale-orders', saleOrderRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/dev', devRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

export default app;
