import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';

// Native Next.js App Router Data Caching
// Caches this route's responses for 60 seconds to prevent RPC rate limits
export const revalidate = 60;

// Module level in-memory cache as fallback
let globalCache: any = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voteAccount = searchParams.get('voteAccount');

  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const now = Date.now();

    // Re-fetch heavy active stake arrays only once a minute
    if (!globalCache || now - lastFetchTime > CACHE_TTL_MS) {
      const [voteAccounts, samples, epochInfo] = await Promise.all([
        connection.getVoteAccounts(),
        connection.getRecentPerformanceSamples(1),
        connection.getEpochInfo()
      ]);

      const tps = samples.length > 0 
        ? Math.round(samples[0].numTransactions / samples[0].samplePeriodSecs) 
        : 0;

      globalCache = {
        voteAccounts,
        tps,
        epoch: epochInfo.epoch
      };
      lastFetchTime = now;
    }

    // Format response
    let specificValidator = null;

    let topValidators = null;

    if (voteAccount) {
      // Find in Current
      const current = globalCache.voteAccounts.current.find((v: any) => v.votePubkey === voteAccount);
      // Find in Delinquent
      const delinquent = globalCache.voteAccounts.delinquent.find((v: any) => v.votePubkey === voteAccount);

      const found = current || delinquent;

      if (found) {
        let score = 100;
        if (delinquent) score -= 50; 
        score -= found.commission; 
        if (score < 0) score = 0;

        specificValidator = {
          pubkey: found.votePubkey,
          activatedStake: found.activatedStake,
          commission: found.commission,
          rootSlot: found.rootSlot,
          status: current ? 'ONLINE' : 'DELINQUENT',
          score
        };
      }
    } else {
      // If no specific account searched, return top 10 by stake
      topValidators = globalCache.voteAccounts.current
        .sort((a: any, b: any) => b.activatedStake - a.activatedStake)
        .slice(0, 10)
        .map((v: any) => {
          let score = 100 - v.commission;
          if (score < 0) score = 0;
          return {
            pubkey: v.votePubkey,
            activatedStake: v.activatedStake,
            commission: v.commission,
            score,
            status: 'ONLINE'
          };
        });
    }

    return NextResponse.json({
      success: true,
      network: {
        tps: globalCache.tps,
        epoch: globalCache.epoch,
        totalValidators: globalCache.voteAccounts.current.length + globalCache.voteAccounts.delinquent.length,
        activeValidators: globalCache.voteAccounts.current.length
      },
      validator: specificValidator,
      topValidators
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
