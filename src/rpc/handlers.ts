import crypto from 'crypto';
import bs58 from 'bs58';
import { SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID } from '../constants';
import { Account, rpcError } from '../utils';
import { readMint, readTokenAccount } from '../programs/token';
import { AccountStore } from '../accountStore';
import { Ledger } from '../ledger';
import { processSendTransaction, processSimulateTransaction } from '../transaction';

export interface HandlerContext {
  accountStore: AccountStore;
  ledger: Ledger;
}

type HandlerFn = (params: any[], ctx: HandlerContext) => any;

function context(slot: bigint) {
  return { slot: Number(slot) };
}

function accountInfoResponse(acc: Account | null) {
  if (!acc) return null;
  return {
    data: [acc.data.toString('base64'), 'base64'],
    executable: acc.executable,
    lamports: Number(acc.lamports),
    owner: acc.owner,
    rentEpoch: Number(acc.rentEpoch),
    space: acc.data.length,
  };
}

function getVersion(): { 'solana-core': string; 'feature-set': number } {
  return { 'solana-core': '1.18.0', 'feature-set': 1 };
}

function getHealth(): string {
  return 'ok';
}

function getSlot(_params: any[], ctx: HandlerContext): number {
  return Number(ctx.ledger.getSlot());
}

function getBlockHeight(_params: any[], ctx: HandlerContext): number {
  return Number(ctx.ledger.getSlot());
}

function getLatestBlockhash(_params: any[], ctx: HandlerContext) {
  const hash = ctx.ledger.generateBlockhash();
  const slot = ctx.ledger.getSlot();
  return {
    context: context(slot),
    value: {
      blockhash: hash,
      lastValidBlockHeight: Number(slot) + 150,
    },
  };
}

function getRecentBlockhash(_params: any[], ctx: HandlerContext) {
  const hash = ctx.ledger.generateBlockhash();
  const slot = ctx.ledger.getSlot();
  return {
    context: context(slot),
    value: {
      blockhash: hash,
      feeCalculator: { lamportsPerSignature: 5000 },
    },
  };
}

function isBlockhashValid(params: any[], ctx: HandlerContext) {
  const [blockhash] = params;
  return {
    context: context(ctx.ledger.getSlot()),
    value: ctx.ledger.isValidBlockhash(blockhash),
  };
}

function getBalance(params: any[], ctx: HandlerContext) {
  if (!params || params.length < 1) {
    throw rpcError(-32602, 'Missing pubkey parameter');
  }
  const pubkey = params[0] as string;
  const acc = ctx.accountStore.get(pubkey);
  return {
    context: context(ctx.ledger.getSlot()),
    value: acc ? Number(acc.lamports) : 0,
  };
}

function getAccountInfo(params: any[], ctx: HandlerContext) {
  if (!params || params.length < 1) {
    throw rpcError(-32602, 'Missing pubkey parameter');
  }
  const pubkey = params[0] as string;
  const acc = ctx.accountStore.get(pubkey);

  return {
    context: context(ctx.ledger.getSlot()),
    value: accountInfoResponse(acc),
  };
}

function getMultipleAccounts(params: any[], ctx: HandlerContext) {
  const pubkeys: string[] = params[0] || [];
  return {
    context: context(ctx.ledger.getSlot()),
    value: pubkeys.map((pk) => accountInfoResponse(ctx.accountStore.get(pk))),
  };
}

function getMinimumBalanceForRentExemption(params: any[]): number {
  if (!params || params.length < 1) {
    throw rpcError(-32602, 'Missing dataSize parameter');
  }
  const dataSize = params[0] as number;
  return (dataSize + 128) * 2;
}

function getTokenAccountBalance(params: any[], ctx: HandlerContext) {
  if (!params || params.length < 1) {
    throw rpcError(-32602, 'Missing pubkey parameter');
  }
  const pubkey = params[0] as string;
  const acc = ctx.accountStore.get(pubkey);

  if (!acc || acc.owner !== TOKEN_PROGRAM_ID || acc.data.length < 165) {
    throw rpcError(-32602, 'Not a token account');
  }

  const ta = readTokenAccount(acc.data);
  if (ta.state === 0) {
    throw rpcError(-32602, 'Token account not initialized');
  }

  const mintAcc = ctx.accountStore.get(ta.mint);
  let decimals = 0;
  if (mintAcc && mintAcc.data.length >= 82) {
    const mint = readMint(mintAcc.data);
    decimals = mint.decimals;
  }

  const amountStr = ta.amount.toString();
  const uiAmount = Number(ta.amount) / Math.pow(10, decimals);

  return {
    context: context(ctx.ledger.getSlot()),
    value: {
      amount: amountStr,
      decimals,
      uiAmount,
      uiAmountString: uiAmount.toString(),
    },
  };
}

function getTokenAccountsByOwner(params: any[], ctx: HandlerContext) {
  if (!params || params.length < 2) {
    throw rpcError(-32602, 'Missing parameters');
  }
  const ownerPubkey = params[0] as string;
  const filter = params[1] as { mint?: string; programId?: string };

  const result: any[] = [];

  for (const [pubkey, acc] of ctx.accountStore.accounts.entries()) {
    if (acc.owner !== TOKEN_PROGRAM_ID || acc.data.length < 165) continue;
    if (acc.data[108] === 0) continue;

    const tokenOwner = bs58.encode(acc.data.slice(32, 64));
    if (tokenOwner !== ownerPubkey) continue;

    if (filter.mint) {
      const tokenMint = bs58.encode(acc.data.slice(0, 32));
      if (tokenMint !== filter.mint) continue;
    } else if (filter.programId) {
      if (acc.owner !== filter.programId) continue;
    }

    result.push({
      pubkey,
      account: accountInfoResponse(acc),
    });
  }

  return {
    context: context(ctx.ledger.getSlot()),
    value: result,
  };
}

function getTokenSupply(params: any[], ctx: HandlerContext) {
  if (!params || params.length < 1) {
    throw rpcError(-32602, 'Missing pubkey parameter');
  }
  const mintPubkey = params[0] as string;
  const mintAcc = ctx.accountStore.get(mintPubkey);
  if (!mintAcc || mintAcc.data.length < 82) {
    throw rpcError(-32602, 'Not a mint');
  }
  const mint = readMint(mintAcc.data);
  const supply = Number(mint.supply);
  const uiAmount = supply / Math.pow(10, mint.decimals);
  return {
    context: context(ctx.ledger.getSlot()),
    value: {
      amount: mint.supply.toString(),
      decimals: mint.decimals,
      uiAmount,
      uiAmountString: uiAmount.toString(),
    },
  };
}

function requestAirdrop(params: any[], ctx: HandlerContext): string {
  if (!params || params.length < 2) {
    throw rpcError(-32602, 'Missing parameters');
  }
  const pubkey = params[0] as string;
  const lamports = BigInt(params[1]);

  let acc = ctx.accountStore.get(pubkey);
  if (!acc) {
    acc = {
      pubkey,
      lamports: 0n,
      owner: SYSTEM_PROGRAM_ID,
      data: Buffer.alloc(0),
      executable: false,
      rentEpoch: 0n,
    };
  }

  acc.lamports += lamports;
  ctx.accountStore.set(pubkey, acc);
  ctx.ledger.incrementSlot();

  const sigBytes = crypto.randomBytes(64);
  const sig = bs58.encode(sigBytes);
  ctx.ledger.recordSignature(sig, null);

  return sig;
}

function sendTransaction(params: any[], ctx: HandlerContext): string {
  if (!params || !params[0]) throw rpcError(-32602, 'Missing parameters');
  try {
    return processSendTransaction(params, ctx);
  } catch (err: any) {
    if (err.code) throw err;
    throw rpcError(-32003, err.message);
  }
}

function simulateTransaction(params: any[], ctx: HandlerContext) {
  if (!params || !params[0]) {
    return {
      context: context(ctx.ledger.getSlot()),
      value: { err: null, logs: [], accounts: null, unitsConsumed: 0 },
    };
  }
  return processSimulateTransaction(params, ctx);
}

function getSignatureStatuses(params: any[], ctx: HandlerContext) {
  if (!params || params.length < 1 || !Array.isArray(params[0])) {
    throw rpcError(-32602, 'Missing signatures array');
  }
  const sigs = params[0] as string[];

  const value = sigs.map((sig) => {
    const status = ctx.ledger.getSignatureStatus(sig);
    if (!status) return null;
    return {
      slot: Number(status.slot),
      confirmations: null,
      err: status.err,
      confirmationStatus: 'confirmed',
    };
  });

  return {
    context: context(ctx.ledger.getSlot()),
    value,
  };
}

function getFees(_params: any[], ctx: HandlerContext) {
  const bh = ctx.ledger.generateBlockhash();
  const slot = ctx.ledger.getSlot();
  return {
    context: context(slot),
    value: {
      blockhash: bh,
      feeCalculator: { lamportsPerSignature: 5000 },
      lastValidBlockHeight: Number(slot) + 150,
      lastValidSlot: Number(slot) + 150,
    },
  };
}

function getFeeForMessage(_params: any[], ctx: HandlerContext) {
  return { context: context(ctx.ledger.getSlot()), value: 5000 };
}

function getEpochInfo(_params: any[], ctx: HandlerContext) {
  const slot = Number(ctx.ledger.getSlot());
  return {
    absoluteSlot: slot,
    blockHeight: slot,
    epoch: 0,
    slotIndex: slot,
    slotsInEpoch: 432000,
    transactionCount: ctx.ledger.signatures.size,
  };
}

function getGenesisHash(): string {
  return bs58.encode(Buffer.alloc(32, 1));
}

function getIdentity() {
  return { identity: bs58.encode(Buffer.alloc(32, 2)) };
}

function getTransactionCount(_params: any[], ctx: HandlerContext): number {
  return ctx.ledger.signatures.size;
}

function getBlockCommitment() {
  return { commitment: null, totalStake: 42 };
}

export const handlers: Record<string, HandlerFn> = {
  getVersion: () => getVersion(),
  getHealth: () => getHealth(),
  getSlot,
  getBlockHeight,
  getLatestBlockhash,
  getRecentBlockhash,
  isBlockhashValid,
  getBalance,
  getAccountInfo,
  getMultipleAccounts,
  getMinimumBalanceForRentExemption,
  getTokenAccountBalance,
  getTokenAccountsByOwner,
  getTokenSupply,
  requestAirdrop,
  sendTransaction,
  simulateTransaction,
  getSignatureStatuses,
  getFees,
  getFeeForMessage,
  getEpochInfo,
  getGenesisHash: () => getGenesisHash(),
  getIdentity: () => getIdentity(),
  getTransactionCount,
  getBlockCommitment: () => getBlockCommitment(),
};
