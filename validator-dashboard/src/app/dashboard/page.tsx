'use client';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [networkStats, setNetworkStats] = useState<any>(null);
  const [validatorData, setValidatorData] = useState<any>(null);
  const [topValidators, setTopValidators] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial load
  useEffect(() => {
    fetchData();
    // Refresh global stats every 30 seconds
    const interval = setInterval(() => fetchData(searchQuery), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (voteAccount?: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const qs = voteAccount ? `?voteAccount=${voteAccount}` : '';
      const res = await fetch(`/api/validator${qs}`);
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch node data');
      }

      setNetworkStats(data.network);
      
      if (voteAccount) {
        if (data.validator) {
          setValidatorData(data.validator);
          setTopValidators([]);
        } else {
          setValidatorData(null);
          setTopValidators([]);
          setErrorMsg('Validator Vote Account not found on Mainnet-Beta.');
        }
      } else {
        setValidatorData(null);
        if (data.topValidators) {
          setTopValidators(data.topValidators);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) {
      fetchData(); // Fetch top 10 if empty
      return;
    }
    fetchData(searchQuery.trim());
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center py-16 px-6 relative overflow-x-hidden">
      {/* Dynamic Deep Space Background gradients */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none animate-pulse duration-10000" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-7000" />
      </div>
      
      {/* Grid Pattern */}
      <div className="fixed inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-10 z-0 mix-blend-overlay"></div>

      {/* Main Container */}
      <div className="z-10 w-full max-w-5xl flex flex-col gap-8">
        
        {/* Header Hero */}
        <header className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-4 mb-6 rounded-3xl bg-white/5 border border-white/10 shadow-[0_0_50px_rgba(153,69,255,0.1)] ring-1 ring-white/10">
            <span className="text-4xl">💠</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 pb-2">
            Aegis: The Solana Validator
          </h1>
          <p className="text-emerald-400 mt-2 tracking-[0.2em] text-sm font-bold uppercase drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
            Explore Validators on Solana Mainnet
          </p>
        </header>

        {/* Global Network HUD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            <GlobalTicker title="Mainnet TPS" value={networkStats ? networkStats.tps : '...'} />
            <GlobalTicker title="Epoch" value={networkStats ? networkStats.epoch : '...'} />
            <GlobalTicker title="Active Nodes" value={networkStats ? networkStats.activeValidators : '...'} />
            <GlobalTicker title="Network Health" value={networkStats ? 'STABLE' : 'SYNCING'} glow={true} />
        </div>

        {/* Search Matrix */}
        <div className="w-full backdrop-blur-3xl bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden mt-4">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50"></div>
          
          <h2 className="text-xl font-bold mb-6 text-white/90">Analyze a Validator</h2>
          
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 relative">
            <input 
              type="text" 
              placeholder="Paste Validator Vote Account Address... (Empty for Top 10)" 
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-6 py-4 outline-none focus:ring-2 focus:ring-purple-500/50 text-white font-mono transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(153,69,255,0.3)] hover:shadow-[0_0_40px_rgba(153,69,255,0.5)] active:scale-95 whitespace-nowrap"
            >
              {loading ? 'Scanning...' : 'Analyze Node'}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-sm">
              ⚠ {errorMsg}
            </div>
          )}
        </div>

        {/* Specific Validator Result Panel */}
        {validatorData && (
          <div className="w-full relative mt-4 transform origin-top animate-fade-in">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4 ml-4">Node Profile</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Trust Score (Option B feature) */}
              <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-gradient-to-b from-purple-900/40 to-black/60 border border-purple-500/30 rounded-[2rem] p-8 relative overflow-hidden flex flex-col items-center justify-center text-center">
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent opacity-50" />
                 <h4 className="text-purple-300 text-sm font-bold uppercase tracking-widest mb-4 z-10">Trust Score</h4>
                 <div className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(153,69,255,0.8)] z-10 mb-2">
                    {validatorData.score}
                 </div>
                 <div className="text-xs text-purple-400/80 uppercase tracking-wider z-10">Out of 100</div>
              </div>

              {/* Status */}
              <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8 flex flex-col justify-center relative group">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Uptime Status</h4>
                <div className={`text-3xl font-bold tracking-tight ${validatorData.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-500'}`}>
                  {validatorData.status}
                </div>
                <div className={`mt-2 text-xs font-medium uppercase ${validatorData.status === 'ONLINE' ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                  {validatorData.status === 'ONLINE' ? 'Producing Blocks Normally' : 'Delinquent / Offline'}
                </div>
              </div>

              {/* Commission */}
              <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8 flex flex-col justify-center relative group">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Commission</h4>
                <div className="text-3xl font-bold tracking-tight text-white">
                  {validatorData.commission}%
                </div>
                <div className="mt-2 text-xs font-medium uppercase text-gray-500">
                  Cut of Staking Rewards
                </div>
              </div>

              {/* Active Stake */}
              <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8 flex flex-col justify-center relative group">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Active Stake</h4>
                <div className="text-3xl font-bold font-mono tracking-tight text-white truncate" title={(validatorData.activatedStake / 1e9).toLocaleString()}>
                  {(validatorData.activatedStake / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="mt-2 text-xs font-medium uppercase text-blue-400/60 flex items-center gap-1">
                  SOL Delegated
                </div>
              </div>

            </div>

             {/* Vote Address Detail */}
             <div className="mt-6 bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Vote PubKey</span>
                <span className="text-sm font-mono text-gray-300 break-all ml-4 selection:bg-purple-500/30">{validatorData.pubkey}</span>
             </div>
          </div>
        )}

        {/* Top 10 Validators Table */}
        {!validatorData && topValidators.length > 0 && (
          <div className="w-full relative mt-4 transform origin-top animate-fade-in">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-4 ml-4">Top 10 Global Node Operators</h3>
            
            <div className="w-full backdrop-blur-3xl bg-black/40 border border-white/5 rounded-[2rem] p-6 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-gray-500">
                      <th className="p-4 font-bold">Rank</th>
                      <th className="p-4 font-bold">Vote Account</th>
                      <th className="p-4 font-bold text-right">Active Stake (SOL)</th>
                      <th className="p-4 font-bold text-right">Fee</th>
                      <th className="p-4 font-bold text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono text-gray-300">
                    {topValidators.map((v, i) => (
                      <tr key={v.pubkey} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => { setSearchQuery(v.pubkey); fetchData(v.pubkey); }}>
                        <td className="p-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-xs ${i < 3 ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                            #{i + 1}
                          </div>
                        </td>
                        <td className="p-4 text-purple-300 hover:text-purple-400 break-all min-w-[200px]">{v.pubkey}</td>
                        <td className="p-4 text-right text-white">{(v.activatedStake / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="p-4 text-right">{v.commission}%</td>
                        <td className="p-4 text-right">
                          <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {v.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-24 text-xs font-mono text-gray-600 uppercase tracking-widest relative z-10 flex gap-6 pb-8">
        <span>● Aegis Validator Tool</span>
        <span>● Mainnet-Beta</span>
      </div>
    </div>
  );
}

function GlobalTicker({ title, value, glow = false }: { title: string, value: string | number, glow?: boolean }) {
  return (
    <div className="bg-black/60 border border-white/5 backdrop-blur-md rounded-2xl p-5 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{title}</span>
        <span className={`text-xl font-mono font-bold ${glow ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-white'}`}>
            {value}
        </span>
    </div>
  );
}
