import { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { Account, readU64LE, requireSigner } from '../utils';

export function executeSystemInstruction(
  ix: { data: Buffer; keys: { pubkey: { toBase58(): string } }[] },
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const data = ix.data;
  if (data.length < 4) throw new Error('System: instruction data too short');

  const disc = data.readUInt32LE(0);
  const keys = ix.keys.map((k) => k.pubkey.toBase58());

  switch (disc) {
    case 0:
      return sysCreateAccount(data, keys, tx, scratch);
    case 1:
      return sysAssign(data, keys, tx, scratch);
    case 2:
      return sysTransfer(data, keys, tx, scratch);
    case 3:
      return sysCreateAccountWithSeed(data, keys, tx, scratch);
    case 8:
      return sysAllocate(data, keys, tx, scratch);
    default:
      break;
  }
}

function sysCreateAccount(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 52) throw new Error('CreateAccount: data too short');

  const payer = keys[0];
  const newAccount = keys[1];

  const lamports = readU64LE(data, 4);
  const space = readU64LE(data, 12);
  const owner = bs58.encode(data.slice(20, 52));

  requireSigner(tx, payer, 'CreateAccount payer');
  requireSigner(tx, newAccount, 'CreateAccount new account');

  const payerAcc = scratch.get(payer)!;
  const newAcc = scratch.get(newAccount)!;

  if (newAcc.lamports > 0n || newAcc.data.length > 0) {
    throw new Error('CreateAccount: account already exists');
  }

  if (payerAcc.lamports < lamports) {
    throw new Error('CreateAccount: insufficient funds');
  }

  payerAcc.lamports -= lamports;
  newAcc.lamports = lamports;
  newAcc.owner = owner;
  newAcc.data = Buffer.alloc(Number(space));

  scratch.set(payer, payerAcc);
  scratch.set(newAccount, newAcc);
}

function sysAssign(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const ownerPubkey = bs58.encode(data.slice(4, 36));
  const accountKey = keys[0];

  requireSigner(tx, accountKey, 'Assign account');

  const acc = scratch.get(accountKey)!;
  acc.owner = ownerPubkey;
  scratch.set(accountKey, acc);
}

function sysTransfer(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 12) throw new Error('Transfer: data too short');

  const source = keys[0];
  const dest = keys[1];
  const lamports = readU64LE(data, 4);

  requireSigner(tx, source, 'Transfer source');

  if (source === dest || lamports === 0n) return;

  const sourceAcc = scratch.get(source)!;
  const destAcc = scratch.get(dest)!;

  if (sourceAcc.lamports < lamports) {
    throw new Error('Transfer: insufficient balance');
  }

  sourceAcc.lamports -= lamports;
  destAcc.lamports += lamports;

  scratch.set(source, sourceAcc);
  scratch.set(dest, destAcc);
}

function sysCreateAccountWithSeed(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const payerKey = keys[0];
  const newAccountKey = keys[1];

  requireSigner(tx, payerKey, 'CreateAccountWithSeed payer');

  const seedLen = Number(data.readBigUInt64LE(36));
  const seedEnd = 44 + seedLen;
  const lamports = readU64LE(data, seedEnd);
  const space = readU64LE(data, seedEnd + 8);
  const ownerPubkey = bs58.encode(data.slice(seedEnd + 16, seedEnd + 48));

  const existing = scratch.get(newAccountKey)!;
  if (existing.lamports > 0n || existing.data.length > 0) {
    throw new Error('CreateAccountWithSeed: account already exists');
  }

  const payer = scratch.get(payerKey)!;
  if (payer.lamports < lamports) {
    throw new Error('CreateAccountWithSeed: insufficient funds');
  }

  payer.lamports -= lamports;
  existing.lamports = lamports;
  existing.owner = ownerPubkey;
  existing.data = Buffer.alloc(Number(space));

  scratch.set(payerKey, payer);
  scratch.set(newAccountKey, existing);
}

function sysAllocate(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const space = readU64LE(data, 4);
  const accountKey = keys[0];

  requireSigner(tx, accountKey, 'Allocate account');

  const acc = scratch.get(accountKey)!;
  acc.data = Buffer.alloc(Number(space));
  scratch.set(accountKey, acc);
}
