import { app } from '../server/app.ts';

// Vercel's Node.js runtime accepts the Web Standard fetch export.
export default { fetch: app.fetch };
