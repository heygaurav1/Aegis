import express, { Request, Response } from 'express';
import { AccountStore } from './accountStore';
import { Ledger } from './ledger';
import { handlers, HandlerContext } from './rpc/handlers';
import { RpcError } from './utils';
import path from 'path';
import fs from 'fs';

const app = express();

app.use((req: Request, res: Response, next) => {
  express.json({ limit: '10mb' })(req, res, (err) => {
    if (err) {
      res.status(200).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid request: malformed JSON' },
      });
      return;
    }
    next();
  });
});

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Content-Type', 'application/json');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const accountStore = new AccountStore();
const ledger = new Ledger();
const ctx: HandlerContext = { accountStore, ledger };

function ok(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function err(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function bigIntReplacer(_key: string, value: any): any {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value;
}

function sanitize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, bigIntReplacer));
}

function handleSingleRequest(body: any): any {
  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== '2.0' || id === undefined || !method) {
    return err(id ?? null, -32600, 'Invalid request');
  }

  const handler = handlers[method];
  if (!handler) {
    return err(id, -32601, `Method not found: ${method}`);
  }

  try {
    const result = handler(params || [], ctx);
    return ok(id, result);
  } catch (e: any) {
    const code = (e as RpcError).code || -32003;
    return err(id, code, e.message);
  }
}

app.post('/', (req: Request, res: Response) => {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    res.json(err(null, -32600, 'Invalid request'));
    return;
  }

  if (Array.isArray(body)) {
    const results = body.map((item: any) => handleSingleRequest(item));
    res.json(sanitize(results));
    return;
  }

  res.json(sanitize(handleSingleRequest(body)));
});

app.get('/', (_req, res) => {
  const dashboardPath = path.join(__dirname, '../dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Dashboard not found. Please ensure dashboard.html exists in the project root.');
  }
});

import http from 'http';
import { attachWsServer } from './ws';

const PORT = 3000;
const server = http.createServer(app);
attachWsServer(server, accountStore, ledger);

server.listen(PORT, () => {
  console.log(`Mini Solana Validator running on port ${PORT}`);
});
