require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/sequelize');
const logger = require('./config/logger');
require('./models');

const PORT = process.env.PORT || 5000;
const apiVersion = process.env.API_VERSION || 'v1';

app.listen(PORT, () => {
  const apiUrl = (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN)
    ? `${process.env.CORS_ORIGIN}/api/${apiVersion}`
    : `http://localhost:${PORT}/api/${apiVersion}`;
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Database: PostgreSQL`);
  logger.info(`API: ${apiUrl}`);
});

sequelize.authenticate()
  .then(() => logger.info('Database connected'))
  .catch((err) => logger.error('Database connection failed:', err));

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});
