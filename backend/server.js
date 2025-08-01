// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routers
const participantsRouter = require('./routes/participants');
const staffRouter        = require('./routes/staff');
const vehiclesRouter     = require('./routes/vehicles');
const venuesRouter       = require('./routes/venues');
const programsRouter     = require('./routes/programs');
const scheduleRouter     = require('./routes/schedule');
const plannerRouter      = require('./routes/planner');
const rosterRouter       = require('./routes/roster');
// API v1 routers (cards & dashboard live inside routes/api/v1)
const cardsRouter        = require('./routes/api/v1/cards');
const dashboardRouter    = require('./routes/api/v1/dashboard');
const financeRouter      = require('./routes/finance');
const ratesRouter        = require('./routes/rates');
const systemRouter       = require('./routes/system');
const changelogRouter    = require('./routes/changelog');
const cancellationsRouter = require('./routes/cancellations');
const recalculationRouter = require('./routes/recalculation'); // <-- NEW
const staffAssignmentsRouter = require('./routes/staffAssignments'); // <-- NEW
// Dynamic resource allocation (auto-staffing, vehicle & route engine) router
const dynamicResourcesRouter = require('./routes/dynamicResources'); // <-- NEW
// Loom system (dynamic scheduling & resource allocation) router
const loomRouter           = require('./routes/loom'); // <-- NEW

// Initialize Express app
const app = express();

// Define allowed origins for CORS
const whitelist = [
  'http://localhost:3008',
  'http://localhost:3009',
  'http://127.0.0.1:3008',
  'http://127.0.0.1:3009',
  'http://192.168.77.8:3008',
  'http://192.168.77.8:3009',
  'https://rabspoc.codexdiz.com',
  'https://rabspoc.codexdiz.com/api/v1/',
  'https://www.rabs.ai'
];

// Configure CORS middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define a welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the RABS-POC API',
    version: '1.0.0',
    documentation: '/api/v1/docs'
  });
});

// Define the main API route
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'RABS-POC API v1',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Mount participant routes
app.use('/api/v1/participants', participantsRouter);
app.use('/api/v1/staff',        staffRouter);
app.use('/api/v1/vehicles',     vehiclesRouter);
app.use('/api/v1/venues',       venuesRouter);
app.use('/api/v1/programs',     programsRouter);
app.use('/api/v1/schedule',     scheduleRouter);
app.use('/api/v1/planner',      plannerRouter);
app.use('/api/v1/roster',       rosterRouter);
// v1 specialised routers
app.use('/api/v1/cards',        cardsRouter);
app.use('/api/v1/dashboard',    dashboardRouter);
app.use('/api/v1/finance',      financeRouter);
app.use('/api/v1/rates',        ratesRouter);
app.use('/api/v1/system',       systemRouter);
app.use('/api/v1/changelog',    changelogRouter);
app.use('/api/v1/cancellations', cancellationsRouter);
app.use('/api/v1/staff-assignments', staffAssignmentsRouter); // <-- NEW
// Mount the recalculation routes (e.g., POST /api/v1/recalculate/process)
app.use('/api/v1/recalculate',  recalculationRouter);
// Dynamic resources (rebalance, route optimisation, etc.)
app.use('/api/v1/dynamic-resources', dynamicResourcesRouter); // <-- NEW
// Loom endpoints (window management, instances, allocations …)
app.use('/api/v1/loom',         loomRouter); // <-- NEW

// Set up the server to listen on the specified port
const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/v1`);
});

// Export the app for testing
module.exports = app;
