import { Connection, Keypair, SystemProgram, Transaction } from '@solana/web3.js';

async function main() {
  const connection = new Connection('http://localhost:3000', 'confirmed');
  
  const payer = Keypair.generate();
  const receiver = Keypair.generate();
  
  console.log('Payer:', payer.publicKey.toBase58());
  console.log('Receiver:', receiver.publicKey.toBase58());
  
  console.log('Requesting airdrop...');
  try {
    const airdropSig = await connection.requestAirdrop(payer.publicKey, 1000000000);
    console.log('Airdrop signature:', airdropSig);
  } catch (e: any) {
    console.error('Airdrop failed:', e.message);
  }
  
  let balance = await connection.getBalance(payer.publicKey);
  console.log('Payer balance:', balance);
  
  console.log('Creating transfer transaction...');
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: receiver.publicKey,
      lamports: 100000,
    })
  );
  
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('Got blockhash:', blockhash);
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    
    console.log('Sending transaction...');
    const txSig = await connection.sendTransaction(tx, [payer]);
    console.log('Transaction signature:', txSig);
    
    balance = await connection.getBalance(receiver.publicKey);
    console.log('Receiver balance:', balance);
  } catch (e: any) {
    console.error('Tx failed:', e.message);
  }
}

main().catch(console.error);
