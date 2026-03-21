import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

async function main() {
  const connection = new Connection('http://127.0.0.1:3000', 'confirmed');
  
  const payer = Keypair.generate();
  const receiver = Keypair.generate();
  
  console.log('Payer:', payer.publicKey.toBase58());
  
  try {
    console.log('Requesting airdrop...');
    const airdropSig = await connection.requestAirdrop(payer.publicKey, 1000000000);
    console.log('Airdrop sig:', airdropSig);
    
    // confirmTransaction uses WS under the hood
    await connection.confirmTransaction(airdropSig);
    console.log('Airdrop confirmed via WS!');
    
    let balance = await connection.getBalance(payer.publicKey);
    console.log('Payer balance:', balance);
    
    console.log('Creating transfer...');
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: receiver.publicKey,
        lamports: 100000,
      })
    );
    
    console.log('Sending and confirming transaction via WS...');
    const txSig = await sendAndConfirmTransaction(connection, tx, [payer]);
    
    console.log('Transfer confirmed via WS! Signature:', txSig);
    
    balance = await connection.getBalance(receiver.publicKey);
    console.log('Receiver balance:', balance);
  } catch (e: any) {
    console.error('WS Test failed:', e);
  }
}

main().catch(console.error);
