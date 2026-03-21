import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => {
  console.log('Connected natively to ws://localhost:3000');
  ws.send(JSON.stringify({ method: 'test' }));
  setTimeout(() => ws.close(), 100);
});
ws.on('error', (err) => console.log('Raw WS ERROR:', err));
ws.on('close', () => console.log('Raw WS CLOSE'));
