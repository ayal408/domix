const app = require('./app');
const { migrateWithRetry } = require('./db');

const PORT = process.env.PORT || 5000;

migrateWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`auth-server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to run database migrations', err);
    process.exit(1);
  });
