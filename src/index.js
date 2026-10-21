require('dotenv').config();

const app = require('./app');
const { createServer } = require('http');
const { initializeSocket } = require('./sockets/socketManager');

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`FieldTrack API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
