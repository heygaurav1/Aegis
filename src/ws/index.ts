import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { AccountStore } from '../accountStore';
import { Ledger } from '../ledger';

export function attachWsServer(server: Server, accountStore: AccountStore, ledger: Ledger) {
  const wss = new WebSocketServer({ server });
  
  let nextSubId = 1;
  const subscriptions = new Map<number, { ws: WebSocket, type: string, target: string }>();

  wss.on('connection', (ws, req) => {
    console.log('WS CONNECTED', req.url);
    ws.on('message', (message) => {
      console.log('WS MSG IN:', message.toString());
      try {
        const parsed = JSON.parse(message.toString());
        if (!parsed.method) return;

        if (parsed.method === 'signatureSubscribe') {
          const sig = parsed.params[0];
          const subId = nextSubId++;
          subscriptions.set(subId, { ws, type: 'signature', target: sig });
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: subId }));
          
          // Check if already confirmed
          const existing = ledger.getSignatureStatus(sig);
          if (existing) {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              method: 'signatureNotification',
              params: {
                subscription: subId,
                result: { context: { slot: Number(existing.slot) }, value: { err: existing.err } }
              }
            }));
          }
        } else if (parsed.method === 'signatureUnsubscribe') {
          const subId = parsed.params[0];
          subscriptions.delete(subId);
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: true }));
        } else if (parsed.method === 'accountSubscribe') {
          const pubkey = parsed.params[0];
          const subId = nextSubId++;
          subscriptions.set(subId, { ws, type: 'account', target: pubkey });
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: subId }));
        } else if (parsed.method === 'accountUnsubscribe') {
          const subId = parsed.params[0];
          subscriptions.delete(subId);
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: true }));
        }
      } catch (err) {
        console.error('WS MSG ERR:', err);
      }
    });

    ws.on('close', () => {
      console.log('WS CLOSED');
      for (const [subId, sub] of subscriptions.entries()) {
        if (sub.ws === ws) {
          subscriptions.delete(subId);
        }
      }
    });
    
    ws.on('error', (err) => {
      console.error('WS ERROR EVENT:', err);
    });
  });

  ledger.on('signature', ({ signature, status }) => {
    for (const [subId, sub] of subscriptions.entries()) {
      if (sub.type === 'signature' && sub.target === signature) {
        if (sub.ws.readyState === WebSocket.OPEN) {
          sub.ws.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'signatureNotification',
            params: {
              subscription: subId,
              result: { context: { slot: Number(status.slot) }, value: { err: status.err } }
            }
          }));
        }
      }
    }
  });

  accountStore.on('accountChange', (account) => {
    for (const [subId, sub] of subscriptions.entries()) {
      if (sub.type === 'account' && sub.target === account.pubkey) {
        if (sub.ws.readyState === WebSocket.OPEN) {
          sub.ws.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'accountNotification',
            params: {
              subscription: subId,
              result: {
                context: { slot: Number(ledger.getSlot()) },
                value: {
                  data: [account.data.toString('base64'), 'base64'],
                  executable: account.executable,
                  lamports: Number(account.lamports),
                  owner: account.owner,
                  rentEpoch: Number(account.rentEpoch),
                  space: account.data.length,
                }
              }
            }
          }));
        }
      }
    }
  });
}
