import { Transaction } from '@solana/web3.js';

export interface Account {
  pubkey: string;
  lamports: bigint;
  owner: string;
  data: Buffer;
  executable: boolean;
  rentEpoch: bigint;
}

export interface RpcError extends Error {
  code: number;
}

export function readU64LE(buffer: Buffer, offset: number): bigint {
  const lo = buffer.readUInt32LE(offset);
  const hi = buffer.readUInt32LE(offset + 4);
  return BigInt(lo) + (BigInt(hi) << 32n);
}

export function writeU64LE(buffer: Buffer, value: bigint, offset: number): void {
  const bigValue = BigInt(value);
  buffer.writeUInt32LE(Number(bigValue & 0xFFFFFFFFn), offset);
  buffer.writeUInt32LE(Number((bigValue >> 32n) & 0xFFFFFFFFn), offset + 4);
}

export function rpcError(code: number, message: string): RpcError {
  const err = new Error(message) as RpcError;
  err.code = code;
  return err;
}

export function isSigner(tx: Transaction, pubkeyBase58: string): boolean {
  const keys = tx.compileMessage().accountKeys;
  const numRequired = tx.compileMessage().header.numRequiredSignatures;

  for (let i = 0; i < numRequired; i++) {
    if (keys[i].toBase58() === pubkeyBase58) {
      return true;
    }
  }
  return false;
}

export function requireSigner(tx: Transaction, pubkeyBase58: string, context: string): void {
  if (!isSigner(tx, pubkeyBase58)) {
    throw new Error(`${context}: ${pubkeyBase58} must be a signer`);
  }
}
