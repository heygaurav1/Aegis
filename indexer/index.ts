import { Connection } from '@solana/web3.js';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

// Postgres configuration
// By default, it looks for the PG_URI in an .env file or connects to localhost.
const pool = new Pool({
  connectionString: process.env.PG_URI || 'postgresql://localhost:5432/solana_indexer',
});

// Setup schema
async function setupDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_activity (
        id SERIAL PRIMARY KEY,
        signature VARCHAR(100) UNIQUE NOT NULL,
        slot BIGINT NOT NULL,
        wallet_address VARCHAR(50) NOT NULL,
        fee BIGINT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[PostgreSQL] Database schema verified.');
  } finally {
    client.release();
  }
}

async function runIndexer() {
  console.log('🚀 Starting Lightweight Solana Indexer');
  await setupDatabase();

  const connection = new Connection('http://localhost:8899', 'confirmed');
  console.log('[Solana] Connected to test-validator at http://localhost:8899\n');

  // Continually listen for newly processed roots (blocks)
  connection.onRootChange(async (rootSlot) => {
    try {
      const block = await connection.getBlock(rootSlot, {
        maxSupportedTransactionVersion: 0,
      });

      if (!block || !block.transactions) return;

      const client = await pool.connect();
      try {
        console.log(`[Indexer] Processing Block ${rootSlot} (${block.transactions.length} txs)`);
        
        for (const tx of block.transactions) {
          if (!tx.meta || tx.meta.err !== null) continue; // skip failed txs
          
          const signature = tx.transaction.signatures[0];
          // Get fee payer / primary wallet
          const feePayerIndex = tx.transaction.message.header.numRequiredSignatures > 0 ? 0 : null;
          if (feePayerIndex === null) continue;
          
          const walletAddress = tx.transaction.message.accountKeys[feePayerIndex].toBase58();
          const fee = tx.meta.fee;

          // Ignore system voting transactions to keep index lightweight
          if (tx.transaction.message.instructions.some((ix: any) => 
            tx.transaction.message.accountKeys[ix.programIdIndex]?.toBase58() === 'Vote111111111111111111111111111111111111111'
          )) {
            continue;
          }

          // Insert into Postgres
          await client.query(
            `INSERT INTO wallet_activity (signature, slot, wallet_address, fee)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (signature) DO NOTHING`,
            [signature, rootSlot, walletAddress, fee]
          );

          console.log(`  -> Tracked tx ${signature.substring(0, 16)}... for wallet ${walletAddress.substring(0,6)}...`);
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`[Indexer Error on slot ${rootSlot}]:`, err);
    }
  });
}

runIndexer().catch((e) => {
  console.error("Critical Failure:", e);
  process.exit(1);
});
