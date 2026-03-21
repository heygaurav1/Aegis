import { PublicKey, Transaction } from '@solana/web3.js';
import { SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, ATA_PROGRAM_ID, TOKEN_ACCOUNT_SIZE } from '../constants';
import { Account, requireSigner } from '../utils';
import { TokenAccountData, writeTokenAccount } from './token';

export function executeATAInstruction(
  ix: { data: Buffer; keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] },
  tx: Transaction,
  scratch: Map<string, Account>
): void {
  const data = ix.data;
  const disc = data.length > 0 ? data[0] : 0;

  if (disc === 0 || disc === 1) {
    return ataCreate(ix.keys, tx, scratch, disc === 1);
  }

  throw new Error(`ATA: unknown instruction ${disc}`);
}

function ataCreate(
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  tx: Transaction,
  scratch: Map<string, Account>,
  idempotent: boolean
): void {
  const payerPubkey = keys[0].pubkey.toBase58();
  const ataPubkey = keys[1].pubkey.toBase58();
  const ownerPubkey = keys[2].pubkey.toBase58();
  const mintPubkey = keys[3].pubkey.toBase58();

  requireSigner(tx, payerPubkey, 'ATA payer');

  const [expectedATA] = PublicKey.findProgramAddressSync(
    [
      new PublicKey(ownerPubkey).toBuffer(),
      new PublicKey(TOKEN_PROGRAM_ID).toBuffer(),
      new PublicKey(mintPubkey).toBuffer(),
    ],
    new PublicKey(ATA_PROGRAM_ID)
  );

  if (expectedATA.toBase58() !== ataPubkey) {
    throw new Error('ATA: derived address mismatch');
  }

  const ataAcc = scratch.get(ataPubkey)!;

  if (ataAcc.lamports > 0n || ataAcc.data.length > 0) {
    if (idempotent) return;
    throw new Error('ATA: account already exists');
  }

  const rentLamports = BigInt((TOKEN_ACCOUNT_SIZE + 128) * 2);

  const payerAcc = scratch.get(payerPubkey)!;
  if (payerAcc.lamports < rentLamports) {
    throw new Error('ATA: insufficient funds for rent');
  }

  payerAcc.lamports -= rentLamports;

  ataAcc.lamports = rentLamports;
  ataAcc.owner = TOKEN_PROGRAM_ID;

  const ta: TokenAccountData = {
    mint: mintPubkey,
    owner: ownerPubkey,
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
  ataAcc.data = writeTokenAccount(ta);

  scratch.set(payerPubkey, payerAcc);
  scratch.set(ataPubkey, ataAcc);
}
