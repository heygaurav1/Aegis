import crypto from 'crypto';
import bs58 from 'bs58';
import { EventEmitter } from 'events';
import { BLOCKHASH_CACHE_SIZE } from './constants';

export interface SignatureStatus {
  slot: bigint;
  err: any | null;
}

export class Ledger extends EventEmitter {
  currentSlot: bigint;
  validBlockhashes: Set<string>;
  blockhashOrder: string[];
  signatures: Map<string, SignatureStatus>;

  constructor() {
    super();
    this.currentSlot = 0n;
    this.validBlockhashes = new Set();
    this.blockhashOrder = [];
    this.signatures = new Map();
  }

  getSlot(): bigint {
    return this.currentSlot;
  }

  incrementSlot(): void {
    this.currentSlot++;
  }

  generateBlockhash(): string {
    const bytes = crypto.randomBytes(32);
    const hash = bs58.encode(bytes);

    this.validBlockhashes.add(hash);
    this.blockhashOrder.push(hash);

    while (this.blockhashOrder.length > BLOCKHASH_CACHE_SIZE) {
      const old = this.blockhashOrder.shift()!;
      this.validBlockhashes.delete(old);
    }

    return hash;
  }

  isValidBlockhash(hash: string): boolean {
    return this.validBlockhashes.has(hash);
  }

  recordSignature(sig: string, err: any | null): void {
    const status = { slot: this.currentSlot, err };
    this.signatures.set(sig, status);
    this.emit('signature', { signature: sig, status });
  }

  getSignatureStatus(sig: string): SignatureStatus | null {
    return this.signatures.get(sig) || null;
  }
}
