import { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, ATA_PROGRAM_ID } from './constants';
import { Account, rpcError } from './utils';
import { AccountStore } from './accountStore';
import { Ledger } from './ledger';
import { executeSystemInstruction } from './programs/system';
import { executeTokenInstruction } from './programs/token';
import { executeATAInstruction } from './programs/ata';

function verifySignatures(tx: Transaction): void {
  const messageBytes = tx.serializeMessage();

  for (const sig of tx.signatures) {
    if (!sig.signature || sig.signature.every((b: number) => b === 0)) {
      throw new Error(`Missing signature for ${sig.publicKey.toBase58()}`);
    }

    const valid = nacl.sign.detached.verify(
      messageBytes,
      sig.signature,
      sig.publicKey.toBuffer()
    );

    if (!valid) {
      throw new Error(`Invalid signature for ${sig.publicKey.toBase58()}`);
    }
  }
}

function executeInstruction(
  ix: any,
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const programId = ix.programId.toBase58();

  switch (programId) {
    case SYSTEM_PROGRAM_ID:
      return executeSystemInstruction(ix, tx, scratch);
    case TOKEN_PROGRAM_ID:
      return executeTokenInstruction(ix, tx, scratch);
    case ATA_PROGRAM_ID:
      return executeATAInstruction(ix, tx, scratch);
    default:
      break;
  }
}

function decodeTxBytes(encodedTx: string, opts: any): Buffer {
  const encoding: string = opts?.encoding || 'base58';
  if (encoding === 'base64') {
    return Buffer.from(encodedTx, 'base64');
  }
  try {
    return Buffer.from(bs58.decode(encodedTx));
  } catch {
    return Buffer.from(encodedTx, 'base64');
  }
}

export function processTransactionBytes(
  txBytes: Buffer,
  ctx: { accountStore: AccountStore; ledger: Ledger }
): string {
  let tx: Transaction;
  try {
    tx = Transaction.from(txBytes);
  } catch (e: any) {
    throw rpcError(-32602, `Failed to deserialize: ${e.message}`);
  }

  if (!ctx.ledger.isValidBlockhash(tx.recentBlockhash!)) {
    throw rpcError(-32003, 'Blockhash not found');
  }

  try {
    verifySignatures(tx);
  } catch (e: any) {
    throw rpcError(-32003, e.message);
  }

  const allPubkeys = tx.compileMessage().accountKeys.map((k) => k.toBase58());
  const scratch = ctx.accountStore.createScratch(allPubkeys);

  try {
    let ixIndex = 0;
    for (const ix of tx.instructions) {
      try {
        executeInstruction(ix, tx, scratch);
      } catch (ei: any) {
        throw { InstructionError: [ixIndex, { Custom: 1 }] };
      }
      ixIndex++;
    }
  } catch (e: any) {
    const sig = bs58.encode(tx.signature!);
    const errObj = e.InstructionError ? e : { InstructionError: [0, { Custom: 1 }] };
    ctx.ledger.recordSignature(sig, errObj);
    throw rpcError(-32003, JSON.stringify(errObj));
  }

  ctx.accountStore.commitScratch(scratch);
  ctx.ledger.incrementSlot();

  const sig = bs58.encode(tx.signature!);
  ctx.ledger.recordSignature(sig, null);

  return sig;
}

export function processSendTransaction(
  params: any[],
  ctx: { accountStore: AccountStore; ledger: Ledger }
): string {
  const [encodedTx, opts] = params;
  const txBytes = decodeTxBytes(encodedTx, opts);
  return processTransactionBytes(txBytes, ctx);
}

function simulateTransactionBytes(
  txBytes: Buffer,
  ctx: { accountStore: AccountStore; ledger: Ledger },
  opts: any
): { err: any; logs: string[]; accounts: null; unitsConsumed: number } {
  let tx: Transaction;
  try {
    tx = Transaction.from(txBytes);
  } catch (e: any) {
    return { err: { InstructionError: [0, { Custom: 0 }] }, logs: [e.message], accounts: null, unitsConsumed: 0 };
  }

  const sigVerify = opts?.sigVerify ?? false;
  const replaceBlockhash = opts?.replaceRecentBlockhash ?? false;

  if (!replaceBlockhash && !ctx.ledger.isValidBlockhash(tx.recentBlockhash!)) {
    return { err: { InstructionError: [0, { Custom: 0 }] }, logs: ['Blockhash not found'], accounts: null, unitsConsumed: 0 };
  }

  if (sigVerify) {
    try {
      verifySignatures(tx);
    } catch (e: any) {
      return { err: { InstructionError: [0, { Custom: 0 }] }, logs: [e.message], accounts: null, unitsConsumed: 0 };
    }
  }

  const allPubkeys = tx.compileMessage().accountKeys.map((k) => k.toBase58());
  const scratch = ctx.accountStore.createScratch(allPubkeys);

  try {
    let ixIndex = 0;
    for (const ix of tx.instructions) {
      try {
        executeInstruction(ix, tx, scratch);
      } catch (ei: any) {
        throw { InstructionError: [ixIndex, { Custom: 1 }] };
      }
      ixIndex++;
    }
  } catch (e: any) {
    const errObj = e.InstructionError ? e : { InstructionError: [0, { Custom: 1 }] };
    return { err: errObj, logs: [], accounts: null, unitsConsumed: 0 };
  }

  return { err: null, logs: [], accounts: null, unitsConsumed: 0 };
}

export function processSimulateTransaction(
  params: any[],
  ctx: { accountStore: AccountStore; ledger: Ledger }
): any {
  const [encodedTx, opts] = params;
  const txBytes = decodeTxBytes(encodedTx, opts);
  const slot = ctx.ledger.getSlot();

  const result = simulateTransactionBytes(txBytes, ctx, opts);

  return {
    context: { slot: Number(slot) },
    value: result,
  };
}
