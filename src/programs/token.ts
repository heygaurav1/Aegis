import { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID } from '../constants';
import { Account, readU64LE, writeU64LE, requireSigner } from '../utils';

export interface MintData {
  mintAuthorityOption: number;
  mintAuthority: string;
  supply: bigint;
  decimals: number;
  isInitialized: boolean;
  freezeAuthorityOption: number;
  freezeAuthority: string;
}

export interface TokenAccountData {
  mint: string;
  owner: string;
  amount: bigint;
  delegateOption: number;
  delegate: string;
  state: number;
  isNativeOption: number;
  isNative: bigint;
  delegatedAmount: bigint;
  closeAuthorityOption: number;
  closeAuthority: string;
}

export function readMint(data: Buffer): MintData {
  if (data.length < 82) throw new Error('Invalid mint data');
  return {
    mintAuthorityOption: data.readUInt32LE(0),
    mintAuthority: bs58.encode(data.slice(4, 36)),
    supply: readU64LE(data, 36),
    decimals: data[44],
    isInitialized: data[45] === 1,
    freezeAuthorityOption: data.readUInt32LE(46),
    freezeAuthority: bs58.encode(data.slice(50, 82)),
  };
}

export function writeMint(mint: MintData): Buffer {
  const buf = Buffer.alloc(82);
  buf.writeUInt32LE(mint.mintAuthorityOption, 0);
  Buffer.from(bs58.decode(mint.mintAuthority)).copy(buf, 4);
  writeU64LE(buf, mint.supply, 36);
  buf[44] = mint.decimals;
  buf[45] = mint.isInitialized ? 1 : 0;
  buf.writeUInt32LE(mint.freezeAuthorityOption, 46);
  Buffer.from(bs58.decode(mint.freezeAuthority)).copy(buf, 50);
  return buf;
}

export function readTokenAccount(data: Buffer): TokenAccountData {
  if (data.length < 165) throw new Error('Invalid token account data');
  return {
    mint: bs58.encode(data.slice(0, 32)),
    owner: bs58.encode(data.slice(32, 64)),
    amount: readU64LE(data, 64),
    delegateOption: data.readUInt32LE(72),
    delegate: bs58.encode(data.slice(76, 108)),
    state: data[108],
    isNativeOption: data.readUInt32LE(109),
    isNative: readU64LE(data, 113),
    delegatedAmount: readU64LE(data, 121),
    closeAuthorityOption: data.readUInt32LE(129),
    closeAuthority: bs58.encode(data.slice(133, 165)),
  };
}

export function writeTokenAccount(ta: TokenAccountData): Buffer {
  const buf = Buffer.alloc(165);
  Buffer.from(bs58.decode(ta.mint)).copy(buf, 0);
  Buffer.from(bs58.decode(ta.owner)).copy(buf, 32);
  writeU64LE(buf, ta.amount, 64);
  buf.writeUInt32LE(ta.delegateOption, 72);
  Buffer.from(bs58.decode(ta.delegate)).copy(buf, 76);
  buf[108] = ta.state;
  buf.writeUInt32LE(ta.isNativeOption, 109);
  writeU64LE(buf, ta.isNative, 113);
  writeU64LE(buf, ta.delegatedAmount, 121);
  buf.writeUInt32LE(ta.closeAuthorityOption, 129);
  Buffer.from(bs58.decode(ta.closeAuthority)).copy(buf, 133);
  return buf;
}

export function executeTokenInstruction(
  ix: { data: Buffer; keys: { pubkey: { toBase58(): string } }[] },
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const data = ix.data;
  if (data.length < 1) throw new Error('Token: empty instruction');

  const disc = data[0];
  const keys = ix.keys.map((k) => k.pubkey.toBase58());

  switch (disc) {
    case 0:
    case 20:
      return tokenInitializeMint(data, keys, scratch);
    case 1:
      return tokenInitializeAccount(keys, scratch);
    case 16:
    case 18:
      return tokenInitializeAccount3(data, keys, scratch);
    case 3:
      return tokenTransfer(data, keys, tx, scratch);
    case 4:
      return tokenApprove(data, keys, tx, scratch);
    case 5:
      return tokenRevoke(keys, tx, scratch);
    case 6:
      return tokenSetAuthority(data, keys, tx, scratch);
    case 7:
      return tokenMintTo(data, keys, tx, scratch);
    case 8:
      return tokenBurn(data, keys, tx, scratch);
    case 9:
      return tokenCloseAccount(keys, tx, scratch);
    case 10:
      return tokenFreezeAccount(keys, tx, scratch);
    case 11:
      return tokenThawAccount(keys, tx, scratch);
    case 12:
      return tokenTransferChecked(data, keys, tx, scratch);
    case 14:
      return tokenMintToChecked(data, keys, tx, scratch);
    case 15:
      return tokenBurnChecked(data, keys, tx, scratch);
    default:
      break;
  }
}

function tokenInitializeMint(
  data: Buffer,
  keys: string[],
  scratch: Map<string, Account>
): void {
  if (data.length < 35) throw new Error('InitializeMint: data too short');

  const mintPubkey = keys[0];
  const mintAcc = scratch.get(mintPubkey)!;

  if (mintAcc.data.length >= 46 && mintAcc.data[45] === 1) {
    throw new Error('InitializeMint: already initialized');
  }

  const decimals = data[1];
  const mintAuthority = bs58.encode(data.slice(2, 34));
  const hasFreezeAuth = data[34] === 1;
  const freezeAuthority =
    hasFreezeAuth && data.length >= 67
      ? bs58.encode(data.slice(35, 67))
      : SYSTEM_PROGRAM_ID;

  if (mintAcc.data.length < 82) mintAcc.data = Buffer.alloc(82);

  const mint: MintData = {
    mintAuthorityOption: 1,
    mintAuthority,
    supply: 0n,
    decimals,
    isInitialized: true,
    freezeAuthorityOption: hasFreezeAuth ? 1 : 0,
    freezeAuthority,
  };

  mintAcc.data = writeMint(mint);
  mintAcc.owner = TOKEN_PROGRAM_ID;
  scratch.set(mintPubkey, mintAcc);
}

function tokenInitializeAccount(
  keys: string[],
  scratch: Map<string, Account>
): void {
  const tokenAccountPubkey = keys[0];
  const mintPubkey = keys[1];
  const ownerPubkey = keys[2];

  const tokenAcc = scratch.get(tokenAccountPubkey)!;
  if (tokenAcc.data.length < 165) tokenAcc.data = Buffer.alloc(165);

  Buffer.from(bs58.decode(mintPubkey)).copy(tokenAcc.data, 0);
  Buffer.from(bs58.decode(ownerPubkey)).copy(tokenAcc.data, 32);
  writeU64LE(tokenAcc.data, 0n, 64);
  tokenAcc.data.writeUInt32LE(0, 72);
  tokenAcc.data[108] = 1;
  tokenAcc.data.writeUInt32LE(0, 109);
  writeU64LE(tokenAcc.data, 0n, 121);
  tokenAcc.data.writeUInt32LE(0, 129);
  tokenAcc.owner = TOKEN_PROGRAM_ID;

  scratch.set(tokenAccountPubkey, tokenAcc);
}

function tokenInitializeAccount3(
  data: Buffer,
  keys: string[],
  scratch: Map<string, Account>
): void {
  if (data.length < 33) throw new Error('InitializeAccount3: data too short');

  const tokenAccountPubkey = keys[0];
  const mintPubkey = keys[1];
  const owner = bs58.encode(data.slice(1, 33));

  const tokenAcc = scratch.get(tokenAccountPubkey)!;
  const mintAcc = scratch.get(mintPubkey)!;

  if (mintAcc.data.length < 46 || mintAcc.data[45] !== 1) {
    throw new Error('InitializeAccount3: mint not initialized');
  }

  const ta: TokenAccountData = {
    mint: mintPubkey,
    owner,
    amount: 0n,
    delegateOption: 0,
    delegate: SYSTEM_PROGRAM_ID,
    state: 1,
    isNativeOption: 0,
    isNative: 0n,
    delegatedAmount: 0n,
    closeAuthorityOption: 0,
    closeAuthority: SYSTEM_PROGRAM_ID,
  };

  tokenAcc.data = writeTokenAccount(ta);
  tokenAcc.owner = TOKEN_PROGRAM_ID;
  scratch.set(tokenAccountPubkey, tokenAcc);
}

function tokenMintTo(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 9) throw new Error('MintTo: data too short');

  const mintPubkey = keys[0];
  const destPubkey = keys[1];
  const authorityPubkey = keys[2];
  const amount = readU64LE(data, 1);

  requireSigner(tx, authorityPubkey, 'MintTo authority');

  const mintAcc = scratch.get(mintPubkey)!;
  const destAcc = scratch.get(destPubkey)!;

  const mint = readMint(mintAcc.data);
  const dest = readTokenAccount(destAcc.data);

  if (mint.mintAuthorityOption !== 1 || mint.mintAuthority !== authorityPubkey) {
    throw new Error('MintTo: invalid authority');
  }

  if (dest.mint !== mintPubkey) {
    throw new Error('MintTo: mint mismatch');
  }

  mint.supply += amount;
  dest.amount += amount;

  mintAcc.data = writeMint(mint);
  destAcc.data = writeTokenAccount(dest);

  scratch.set(mintPubkey, mintAcc);
  scratch.set(destPubkey, destAcc);
}

function tokenTransfer(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 9) throw new Error('Transfer: data too short');

  const sourcePubkey = keys[0];
  const destPubkey = keys[1];
  const ownerPubkey = keys[2];
  const amount = readU64LE(data, 1);

  if (sourcePubkey === destPubkey) return;

  requireSigner(tx, ownerPubkey, 'Transfer owner');

  const sourceAcc = scratch.get(sourcePubkey)!;
  const destAcc = scratch.get(destPubkey)!;

  const source = readTokenAccount(sourceAcc.data);
  const dest = readTokenAccount(destAcc.data);

  const sourceDelegate = source.delegateOption === 1 ? source.delegate : null;
  if (source.owner !== ownerPubkey && sourceDelegate !== ownerPubkey) {
    throw new Error('Transfer: owner/delegate mismatch');
  }

  if (source.mint !== dest.mint) {
    throw new Error('Transfer: mint mismatch');
  }

  if (source.amount < amount) {
    throw new Error('Transfer: insufficient balance');
  }

  source.amount -= amount;
  dest.amount += amount;

  sourceAcc.data = writeTokenAccount(source);
  destAcc.data = writeTokenAccount(dest);

  scratch.set(sourcePubkey, sourceAcc);
  scratch.set(destPubkey, destAcc);
}

function tokenTransferChecked(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 10) throw new Error('TransferChecked: data too short');

  const sourcePubkey = keys[0];
  const mintPubkey = keys[1];
  const destPubkey = keys[2];
  const ownerPubkey = keys[3];
  const amount = readU64LE(data, 1);
  const decimals = data[9];

  const mintAcc = scratch.get(mintPubkey)!;
  const mint = readMint(mintAcc.data);
  if (mint.decimals !== decimals) {
    throw new Error('TransferChecked: decimals mismatch');
  }

  const transferData = Buffer.alloc(9);
  transferData[0] = 3;
  writeU64LE(transferData, amount, 1);

  tokenTransfer(transferData, [sourcePubkey, destPubkey, ownerPubkey], tx, scratch);
}

function tokenApprove(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 9) throw new Error('Approve: data too short');

  const amount = readU64LE(data, 1);
  const sourceKey = keys[0];
  const delegateKey = keys[1];
  const ownerKey = keys[2];

  requireSigner(tx, ownerKey, 'Approve owner');

  const sourceAcc = scratch.get(sourceKey)!;
  const source = readTokenAccount(sourceAcc.data);

  source.delegateOption = 1;
  source.delegate = delegateKey;
  source.delegatedAmount = amount;

  sourceAcc.data = writeTokenAccount(source);
  scratch.set(sourceKey, sourceAcc);
}

function tokenRevoke(
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const sourceKey = keys[0];
  const ownerKey = keys[1];

  requireSigner(tx, ownerKey, 'Revoke owner');

  const sourceAcc = scratch.get(sourceKey)!;
  const source = readTokenAccount(sourceAcc.data);

  source.delegateOption = 0;
  source.delegate = SYSTEM_PROGRAM_ID;
  source.delegatedAmount = 0n;

  sourceAcc.data = writeTokenAccount(source);
  scratch.set(sourceKey, sourceAcc);
}

function tokenSetAuthority(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const authorityType = data[1];
  const hasNewAuth = data[2];
  const newAuthority = hasNewAuth ? data.slice(3, 35) : null;

  const targetKey = keys[0];
  const currentAuthKey = keys[1];

  requireSigner(tx, currentAuthKey, 'SetAuthority current authority');

  const targetAcc = scratch.get(targetKey)!;

  if (targetAcc.data.length === 82) {
    const mint = readMint(targetAcc.data);
    if (authorityType === 0) {
      if (mint.mintAuthority !== currentAuthKey) throw new Error('SetAuthority: authority mismatch');
      if (newAuthority) {
        mint.mintAuthorityOption = 1;
        mint.mintAuthority = bs58.encode(newAuthority);
      } else {
        mint.mintAuthorityOption = 0;
      }
    } else if (authorityType === 1) {
      if (mint.freezeAuthority !== currentAuthKey) throw new Error('SetAuthority: authority mismatch');
      if (newAuthority) {
        mint.freezeAuthorityOption = 1;
        mint.freezeAuthority = bs58.encode(newAuthority);
      } else {
        mint.freezeAuthorityOption = 0;
      }
    }
    targetAcc.data = writeMint(mint);
  } else if (targetAcc.data.length === 165) {
    const ta = readTokenAccount(targetAcc.data);
    if (authorityType === 2) {
      if (ta.owner !== currentAuthKey) throw new Error('SetAuthority: authority mismatch');
      if (newAuthority) {
        ta.owner = bs58.encode(newAuthority);
      }
    } else if (authorityType === 3) {
      const closeAuth = ta.closeAuthorityOption === 1 ? ta.closeAuthority : ta.owner;
      if (closeAuth !== currentAuthKey) throw new Error('SetAuthority: authority mismatch');
      if (newAuthority) {
        ta.closeAuthorityOption = 1;
        ta.closeAuthority = bs58.encode(newAuthority);
      } else {
        ta.closeAuthorityOption = 0;
        ta.closeAuthority = SYSTEM_PROGRAM_ID;
      }
    }
    targetAcc.data = writeTokenAccount(ta);
  }

  scratch.set(targetKey, targetAcc);
}

function tokenBurn(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 9) throw new Error('Burn: data too short');

  const tokenAccountPubkey = keys[0];
  const mintPubkey = keys[1];
  const ownerPubkey = keys[2];
  const amount = readU64LE(data, 1);

  requireSigner(tx, ownerPubkey, 'Burn owner');

  const tokenAcc = scratch.get(tokenAccountPubkey)!;
  const mintAcc = scratch.get(mintPubkey)!;

  const ta = readTokenAccount(tokenAcc.data);
  const mint = readMint(mintAcc.data);

  const taDelegate = ta.delegateOption === 1 ? ta.delegate : null;
  if (ta.owner !== ownerPubkey && taDelegate !== ownerPubkey) {
    throw new Error('Burn: owner/delegate mismatch');
  }

  if (ta.mint !== mintPubkey) {
    throw new Error('Burn: mint mismatch');
  }

  if (ta.amount < amount) {
    throw new Error('Burn: insufficient balance');
  }

  ta.amount -= amount;
  mint.supply -= amount;

  tokenAcc.data = writeTokenAccount(ta);
  mintAcc.data = writeMint(mint);

  scratch.set(tokenAccountPubkey, tokenAcc);
  scratch.set(mintPubkey, mintAcc);
}

function tokenCloseAccount(
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const accountPubkey = keys[0];
  const destPubkey = keys[1];
  const ownerPubkey = keys[2];

  requireSigner(tx, ownerPubkey, 'CloseAccount owner');

  const tokenAcc = scratch.get(accountPubkey)!;
  const destAcc = scratch.get(destPubkey)!;

  const ta = readTokenAccount(tokenAcc.data);

  const closeAuth = ta.closeAuthorityOption === 1 ? ta.closeAuthority : ta.owner;
  if (ta.owner !== ownerPubkey && closeAuth !== ownerPubkey) {
    throw new Error('CloseAccount: owner/close authority mismatch');
  }

  if (ta.amount !== 0n) {
    throw new Error('CloseAccount: account has tokens');
  }

  destAcc.lamports += tokenAcc.lamports;

  tokenAcc.lamports = 0n;
  tokenAcc.data = Buffer.alloc(0);
  tokenAcc.owner = SYSTEM_PROGRAM_ID;

  scratch.set(accountPubkey, tokenAcc);
  scratch.set(destPubkey, destAcc);
}

function tokenFreezeAccount(
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const tokenAccountPubkey = keys[0];
  const mintPubkey = keys[1];
  const authorityPubkey = keys[2];

  requireSigner(tx, authorityPubkey, 'FreezeAccount authority');

  const mintAcc = scratch.get(mintPubkey)!;
  const mint = readMint(mintAcc.data);
  if (mint.freezeAuthority !== authorityPubkey) throw new Error('FreezeAccount: authority mismatch');

  const tokenAcc = scratch.get(tokenAccountPubkey)!;
  tokenAcc.data[108] = 2;
  scratch.set(tokenAccountPubkey, tokenAcc);
}

function tokenThawAccount(
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const tokenAccountPubkey = keys[0];
  const mintPubkey = keys[1];
  const authorityPubkey = keys[2];

  requireSigner(tx, authorityPubkey, 'ThawAccount authority');

  const mintAcc = scratch.get(mintPubkey)!;
  const mint = readMint(mintAcc.data);
  if (mint.freezeAuthority !== authorityPubkey) throw new Error('ThawAccount: authority mismatch');

  const tokenAcc = scratch.get(tokenAccountPubkey)!;
  tokenAcc.data[108] = 1;
  scratch.set(tokenAccountPubkey, tokenAcc);
}

function tokenMintToChecked(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 10) throw new Error('MintToChecked: data too short');

  const mintPubkey = keys[0];
  const destPubkey = keys[1];
  const authorityPubkey = keys[2];
  const amount = readU64LE(data, 1);
  const decimals = data[9];

  const mintAcc = scratch.get(mintPubkey)!;
  const mint = readMint(mintAcc.data);
  if (mint.decimals !== decimals) throw new Error('MintToChecked: decimals mismatch');

  const mintToData = Buffer.alloc(9);
  mintToData[0] = 7;
  writeU64LE(mintToData, amount, 1);

  tokenMintTo(mintToData, [mintPubkey, destPubkey, authorityPubkey], tx, scratch);
}

function tokenBurnChecked(
  data: Buffer,
  keys: string[],
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  if (data.length < 10) throw new Error('BurnChecked: data too short');

  const tokenAccountPubkey = keys[0];
  const mintPubkey = keys[1];
  const ownerPubkey = keys[2];
  const amount = readU64LE(data, 1);
  const decimals = data[9];

  const mintAcc = scratch.get(mintPubkey)!;
  const mint = readMint(mintAcc.data);
  if (mint.decimals !== decimals) throw new Error('BurnChecked: decimals mismatch');

  const burnData = Buffer.alloc(9);
  burnData[0] = 8;
  writeU64LE(burnData, amount, 1);

  tokenBurn(burnData, [tokenAccountPubkey, mintPubkey, ownerPubkey], tx, scratch);
}
