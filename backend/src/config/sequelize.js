const { Sequelize } = require('sequelize');
const config = require('./database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;

if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
  );
}

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log('✅ PostgreSQL connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to PostgreSQL database:', err);
  });

module.exports = sequelize;
