import app from './app.js';
import { config } from './config/index.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[DevSentinel Backend] Server listening on http://localhost:${PORT}`);
  console.log(`[DevSentinel Backend] Auth endpoints available at http://localhost:${PORT}/api/v1/auth`);
  console.log(`[DevSentinel Backend] Health check available at http://localhost:${PORT}/health`);
});
