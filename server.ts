import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { spawn, ChildProcess, execSync } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { serverLogger, LogSource, LogLevel } from './src/server-logger';
import { UsersDatabase } from './src/db/users-db';

const PORT = 3000;
const GO_PORT = process.env.GO_PORT || '8089';

let goProcess: ChildProcess | null = null;
let isIntentionallyStopping = false;
let goRestartCount = 0;
let goStatus: 'running' | 'starting' | 'stopped' | 'crashed' = 'stopped';
let lastGoExit: { code: number | null; signal: string | null; time: string } | null = null;

function killExistingGoServer() {
  try {
    execSync(`fuser -k ${GO_PORT}/tcp || pkill -9 -f dist/go-server || true`, { stdio: 'ignore' });
  } catch (e) {
    // ignore
  }
}

function ensureGoBinaryExists(): boolean {
  const goBinPath = path.join(process.cwd(), 'dist', 'go-server');
  if (!fs.existsSync(goBinPath)) {
    serverLogger.warn('Go', 'Go binary dist/go-server not found. Executing ensure-go.sh build script...');
    try {
      execSync('bash ./scripts/ensure-go.sh', { stdio: 'inherit' });
      serverLogger.info('Go', 'Go server binary built successfully.');
      return fs.existsSync(goBinPath);
    } catch (err: any) {
      serverLogger.error('Go', 'Failed to build Go binary via ensure-go.sh', err.stack);
      return false;
    }
  }
  return true;
}

function startGoBackend() {
  if (isIntentionallyStopping) return;

  killExistingGoServer();

  if (!ensureGoBinaryExists()) {
    goStatus = 'crashed';
    serverLogger.fatal('Go', 'Cannot launch Go backend: binary is missing and build failed.');
    return;
  }

  const goBinPath = path.join(process.cwd(), 'dist', 'go-server');
  goStatus = 'starting';
  serverLogger.info('Node', `Launching Go Backend process from ${goBinPath} on port ${GO_PORT}...`);

  goProcess = spawn(goBinPath, [], {
    env: { ...process.env, GO_PORT: String(GO_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (goProcess.pid) {
    goStatus = 'running';
    serverLogger.info('Go', `Go backend started successfully (PID: ${goProcess.pid})`);
  }

  const handleGoLogChunk = (chunk: Buffer) => {
    const text = chunk.toString();
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (
        trimmed.includes('[PANIC RECOVERY]') ||
        trimmed.includes('panic:') ||
        trimmed.includes('fatal error:') ||
        trimmed.includes('[ERROR]')
      ) {
        serverLogger.error('Go', trimmed);
      } else if (trimmed.includes('[WS WARN]') || trimmed.includes('[WARN]')) {
        serverLogger.warn('Go', trimmed);
      } else if (trimmed.includes('[WS INFO]') || trimmed.includes('[INFO]')) {
        serverLogger.info('Go', trimmed);
      } else {
        serverLogger.info('Go', trimmed);
      }
    }
  };

  // Handle stdout from Go
  goProcess.stdout?.on('data', (chunk) => handleGoLogChunk(chunk));

  // Handle stderr from Go
  goProcess.stderr?.on('data', (chunk) => handleGoLogChunk(chunk));

  goProcess.on('error', (err) => {
    goStatus = 'crashed';
    serverLogger.error('Node', 'Failed to spawn Go process', err.stack);
  });

  goProcess.on('exit', (code, signal) => {
    goStatus = 'crashed';
    lastGoExit = { code, signal, time: new Date().toISOString() };
    serverLogger.error('Go', `Go process exited with code ${code}, signal ${signal}`);

    if (!isIntentionallyStopping) {
      goRestartCount++;
      serverLogger.warn('Node', `Auto-restarting Go backend in 1.5 seconds (Restart count: ${goRestartCount})...`);
      setTimeout(() => {
        startGoBackend();
      }, 1500);
    }
  });
}

// Global process error handling
process.on('uncaughtException', (err) => {
  serverLogger.fatal('Node', `Uncaught Exception: ${err.message}`, err.stack);
});

process.on('unhandledRejection', (reason) => {
  serverLogger.error('Node', `Unhandled Rejection: ${String(reason)}`);
});

// Terminate child processes when Node exits
function cleanupAndExit(code = 0) {
  isIntentionallyStopping = true;
  if (goProcess) {
    try { goProcess.kill('SIGKILL'); } catch (e) {}
  }
  killExistingGoServer();
  process.exit(code);
}

process.on('exit', () => {
  isIntentionallyStopping = true;
  if (goProcess) {
    try { goProcess.kill('SIGKILL'); } catch (e) {}
  }
});
process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));

async function startServer() {
  serverLogger.info('Node', 'Starting Unified Express + Go Grid Creatures Server...');

  // Start Go Server executable
  startGoBackend();

  // Initialize MySQL Database
  UsersDatabase.initTables();

  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // --- Auth & User Creatures API Endpoints ---
  const getAuthUser = (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Требуется авторизация');
    }
    const token = authHeader.split(' ')[1];
    return UsersDatabase.verifyToken(token);
  };

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await UsersDatabase.registerUser(username, password);
      res.json({ status: 'ok', ...result });
    } catch (err: any) {
      res.status(400).json({ status: 'error', message: err.message || 'Ошибка регистрации' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await UsersDatabase.loginUser(username, password);
      res.json({ status: 'ok', ...result });
    } catch (err: any) {
      res.status(400).json({ status: 'error', message: err.message || 'Ошибка входа' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const user = getAuthUser(req);
      const food = UsersDatabase.getUserFood(user.id);
      res.json({ status: 'ok', user: { ...user, food, bankFood: food } });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  // User Food endpoints (spend & deposit)
  const handleFoodDeposit = (req: any, res: any) => {
    try {
      const user = getAuthUser(req);
      const amount = Math.max(0, parseInt(req.body.amount, 10) || 0);
      if (amount <= 0) {
        res.status(400).json({ status: 'error', message: 'Некорректная сумма' });
        return;
      }
      const newBalance = UsersDatabase.updateUserFood(user.id, amount);
      res.json({ status: 'ok', food: newBalance, bankFood: newBalance });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  };

  const handleFoodSpend = (req: any, res: any) => {
    try {
      const user = getAuthUser(req);
      const amount = Math.max(0, parseInt(req.body.amount, 10) || 0);
      if (amount <= 0) {
        res.status(400).json({ status: 'error', message: 'Некорректная сумма' });
        return;
      }
      const current = UsersDatabase.getUserFood(user.id);
      if (current < amount) {
        res.status(400).json({ status: 'error', message: `Недостаточно еды для апгрейда (${current}/${amount})` });
        return;
      }
      const newBalance = UsersDatabase.updateUserFood(user.id, -amount);
      res.json({ status: 'ok', food: newBalance, bankFood: newBalance });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  };

  app.get('/api/user/food', (req, res) => {
    try {
      const user = getAuthUser(req);
      const food = UsersDatabase.getUserFood(user.id);
      res.json({ status: 'ok', food, bankFood: food });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/user/food/deposit', handleFoodDeposit);
  app.post('/api/user/food/spend', handleFoodSpend);
  app.get('/api/user/bank', (req, res) => {
    try {
      const user = getAuthUser(req);
      const food = UsersDatabase.getUserFood(user.id);
      res.json({ status: 'ok', food, bankFood: food });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });
  app.post('/api/user/bank/deposit', handleFoodDeposit);
  app.post('/api/user/bank/spend', handleFoodSpend);

  app.get('/api/user/creatures', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const creatures = await UsersDatabase.getUserCreatures(user.id);
      res.json({ status: 'ok', creatures });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/user/creatures', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const { name, color, elements, id } = req.body;
      if (!elements || !Array.isArray(elements)) {
        res.status(400).json({ status: 'error', message: 'Некорректная структура элементов чудика' });
        return;
      }
      const saved = await UsersDatabase.saveUserCreature(user.id, { name, color, elements, id });
      res.json({ status: 'ok', creature: saved });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  app.delete('/api/user/creatures/:id', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const { id } = req.params;
      const success = await UsersDatabase.deleteUserCreature(user.id, id);
      if (success) {
        res.json({ status: 'ok', message: 'Чудик удален из вашей коллекции' });
      } else {
        res.status(404).json({ status: 'error', message: 'Чудик не найден в вашей коллекции' });
      }
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  // Admin: Get all saved creatures from all users
  app.get('/api/admin/creatures', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user.isAdmin) {
        res.status(403).json({ status: 'error', message: 'Доступ разрешен только администратору' });
        return;
      }
      const creatures = await UsersDatabase.getAllUserCreatures();
      res.json({ status: 'ok', creatures });
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  // Admin: Delete any creature by ID
  app.delete('/api/admin/creatures/:id', async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (!user.isAdmin) {
        res.status(403).json({ status: 'error', message: 'Доступ разрешен только администратору' });
        return;
      }
      const { id } = req.params;
      const success = await UsersDatabase.adminDeleteCreature(id);
      if (success) {
        res.json({ status: 'ok', message: 'Чудик успешно удален администратором из БД' });
      } else {
        res.status(404).json({ status: 'error', message: 'Чудик не найден в базе данных' });
      }
    } catch (err: any) {
      res.status(401).json({ status: 'error', message: err.message });
    }
  });

  // Express HTTP Logging Middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const logMsg = `${req.method} ${req.originalUrl} -> ${statusCode} (${duration}ms)`;

      if (statusCode >= 500) {
        serverLogger.error('HTTP', logMsg, undefined, { method: req.method, url: req.originalUrl, status: statusCode });
      } else if (statusCode >= 400) {
        serverLogger.warn('HTTP', logMsg, { method: req.method, url: req.originalUrl, status: statusCode });
      } else {
        // Only log non-static API calls or health requests
        if (req.originalUrl.startsWith('/api') && !req.originalUrl.includes('/api/logs') && !req.originalUrl.includes('/api/health')) {
          serverLogger.info('HTTP', logMsg);
        }
      }
    });
    next();
  });

  // Diagnostics & Logging Endpoints
  app.get('/api/logs', (req, res) => {
    const level = req.query.level as string | undefined;
    const source = req.query.source as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;

    const logs = serverLogger.getLogs({ level, source, search, limit });
    const summary = serverLogger.getSummary();

    res.json({
      status: 'ok',
      count: logs.length,
      total: summary.total,
      errors: summary.errors,
      warnings: summary.warnings,
      logs,
    });
  });

  app.post('/api/logs/clear', (req, res) => {
    serverLogger.clearLogs();
    serverLogger.info('System', 'Server logs buffer and file cleared by user request.');
    res.json({ status: 'ok', message: 'Server logs cleared' });
  });

  app.get('/api/logs/download', (req, res) => {
    const filePath = serverLogger.getLogFilePath();
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'server.log');
    } else {
      res.status(440).send('Log file does not exist yet');
    }
  });

  app.get('/api/system/status', (req, res) => {
    const mem = process.memoryUsage();
    const summary = serverLogger.getSummary();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      node: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryMB: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        },
        nodeVersion: process.version,
      },
      goBackend: {
        status: goStatus,
        pid: goProcess?.pid || null,
        port: GO_PORT,
        restartCount: goRestartCount,
        lastExit: lastGoExit,
      },
      logsSummary: {
        total: summary.total,
        errors: summary.errors,
        warnings: summary.warnings,
      },
    });
  });

  // World Rules & Dynamic Physics Configuration (Phase 5)
  app.get('/api/rules', (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'world_rules.json');
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        res.json(JSON.parse(data));
      } else {
        res.json({
          world: { worldBoundsX: 2000.0, worldBoundsY: 2000.0, tickRate: 100, enableCannibalism: true },
          physics: { restitutionCoefficient: 0.5, dashMultiplier: 1.6, dashFoodCostPerSecond: 2.0, dragLinear: 0.01, dragAngular: 0.005, muscleStiffness: 50.0, muscleDamping: 5.0, sleepVelocityThreshold: 0.05 },
          elementMasses: { massHead: 1.0, massBone: 1.0, massJoint: 0.0, massMuscle: 0.0, massEye: 0.2, massMouth: 0.5 }
        });
      }
    } catch (err: any) {
      serverLogger.error('HTTP', `Error reading world_rules.json: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/rules', (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'world_rules.json');
      const newConfig = req.body;
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
      serverLogger.info('System', `Updated world_rules.json via Admin API (TickRate: ${newConfig?.world?.tickRate}, Restitution: ${newConfig?.physics?.restitutionCoefficient}, Stiffness: ${newConfig?.physics?.muscleStiffness})`);
      res.json({ status: 'ok', config: newConfig });
    } catch (err: any) {
      serverLogger.error('HTTP', `Error writing world_rules.json: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      nodeServer: 'running',
      goBackendStatus: goStatus,
      goPort: GO_PORT,
      uptime: process.uptime(),
    });
  });

  // Proxy /api/go to Go backend
  const apiProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${GO_PORT}`,
    changeOrigin: true,
    pathRewrite: { '^/api/go': '' },
  });

  app.use('/api/go', apiProxy);

  // Vite development middleware vs Static Production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Handle WebSockets with ws WebSocketServer
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const goUrl = `ws://127.0.0.1:${GO_PORT}${req.url}`;
        const goWs = new WebSocket(goUrl);

        const pendingMessages: Array<{ data: any; isBinary: boolean }> = [];

        clientWs.on('message', (data, isBinary) => {
          if (goWs.readyState === WebSocket.OPEN) {
            goWs.send(data, { binary: isBinary });
          } else if (goWs.readyState === WebSocket.CONNECTING) {
            pendingMessages.push({ data, isBinary });
          }
        });

        goWs.on('open', () => {
          while (pendingMessages.length > 0) {
            const msg = pendingMessages.shift();
            if (msg && goWs.readyState === WebSocket.OPEN) {
              goWs.send(msg.data, { binary: msg.isBinary });
            }
          }
        });

        goWs.on('message', (data, isBinary) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
          }
        });

        clientWs.on('close', () => {
          if (goWs.readyState === WebSocket.OPEN || goWs.readyState === WebSocket.CONNECTING) {
            try { goWs.close(); } catch (e) {}
          }
        });

        goWs.on('close', () => {
          if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
            try { clientWs.close(); } catch (e) {}
          }
        });

        clientWs.on('error', (err) => {
          serverLogger.warn('WS', `Client WS error: ${err.message}`);
          try { goWs.close(); } catch (e) {}
        });

        goWs.on('error', (err) => {
          serverLogger.warn('WS', `Go Backend WS error: ${err.message}`);
          try { clientWs.close(); } catch (e) {}
        });
      });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    serverLogger.info('Node', `🚀 Unified App Server listening on http://0.0.0.0:${PORT}`);
    serverLogger.info('Node', `🔗 WebSockets proxied to Go backend at ws://127.0.0.1:${GO_PORT}/ws`);
  });
}

startServer().catch((err) => {
  serverLogger.fatal('Node', 'Fatal server startup error', err.stack);
});
