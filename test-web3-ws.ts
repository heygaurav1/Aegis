import { Connection, Keypair } from '@solana/web3.js';

async function main() {
  const connection = new Connection('http://127.0.0.1:3000', {
    commitment: 'confirmed',
    wsEndpoint: 'ws://127.0.0.1:3000'
  });
  
  const payer = Keypair.generate();
  console.log('Connecting with explicit wsEndpoint...');
  
  const id = connection.onAccountChange(payer.publicKey, () => {});
  console.log('Subscribed with id', id);
  
  setTimeout(() => process.exit(0), 3000);
}

main().catch(console.error);
