const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();


const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const promotionRoutes = require('./routes/promotion.routes');
const projectRoutes = require('./routes/project.routes');
const groupRoutes = require('./routes/group.routes');
const deliverableRoutes = require('./routes/deliverable.routes');
const reportRoutes = require('./routes/report.routes');
const evaluationRoutes = require('./routes/evaluation.routes');
const notificationRoutes = require('./routes/notification.routes');


const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Student Project Manager API is running' });
});

app.use(errorHandler);

/*app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});*/

module.exports = app;