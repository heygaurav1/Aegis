import { SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, ATA_PROGRAM_ID } from './constants';
import { Account } from './utils';
import { EventEmitter } from 'events';

export class AccountStore extends EventEmitter {
  accounts: Map<string, Account>;

  constructor() {
    super();
    this.accounts = new Map();
    this._seedSystemAccounts();
  }

  private _seedSystemAccounts(): void {
    const programs = [SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, ATA_PROGRAM_ID];
    for (const pubkey of programs) {
      this.accounts.set(pubkey, {
        pubkey,
        lamports: 1n,
        owner: 'NativeLoader1111111111111111111111111111111',
        data: Buffer.alloc(0),
        executable: true,
        rentEpoch: 0n,
      });
    }
  }

  get(pubkey: string): Account | null {
    return this.accounts.get(pubkey) || null;
  }

  getOrCreate(pubkey: string): Account {
    if (!this.accounts.has(pubkey)) {
      return {
        pubkey,
        lamports: 0n,
        owner: SYSTEM_PROGRAM_ID,
        data: Buffer.alloc(0),
        executable: false,
        rentEpoch: 0n,
      };
    }
    return this.accounts.get(pubkey)!;
  }

  set(pubkey: string, account: Account): void {
    this.accounts.set(pubkey, account);
    this.emit('accountChange', account);
  }

  delete(pubkey: string): void {
    this.accounts.delete(pubkey);
  }

  createScratch(pubkeys: string[]): Map<string, Account> {
    const scratch = new Map<string, Account>();
    for (const pk of pubkeys) {
      const acc = this.getOrCreate(pk);
      scratch.set(pk, {
        ...acc,
        data: Buffer.from(acc.data),
      });
    }
    return scratch;
  }

  commitScratch(scratch: Map<string, Account>): void {
    for (const [pk, acc] of scratch) {
      if (acc.lamports === 0n && acc.data.length === 0) {
        this.accounts.delete(pk);
      } else {
        this.accounts.set(pk, acc);
      }
      this.emit('accountChange', acc);
    }
  }

  findAll(predicate: (acc: Account) => boolean): Account[] {
    return [...this.accounts.values()].filter(predicate);
  }

  snapshot(): Map<string, Account> {
    const snap = new Map<string, Account>();
    for (const [k, v] of this.accounts) {
      snap.set(k, { ...v, data: Buffer.from(v.data) });
    }
    return snap;
  }

  restore(snap: Map<string, Account>): void {
    this.accounts.clear();
    for (const [k, v] of snap) {
      this.accounts.set(k, v);
    }
  }
}
