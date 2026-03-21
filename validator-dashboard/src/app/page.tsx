import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030305] text-white font-sans flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-10000" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-7000" />
      </div>

      <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/stardust.png')] opacity-30 z-0 mix-blend-overlay"></div>

      <main className="z-10 flex flex-col items-center text-center max-w-4xl px-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-bold uppercase tracking-widest mb-8 shadow-[0_0_20px_rgba(153,69,255,0.2)]">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
          Live on Solana Mainnet
        </div>

        <h1 className="text-7xl md:text-[8rem] lg:text-[10rem] font-black tracking-tighter mb-8 leading-[0.9] text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 pb-2">
          Aegis<br/>The Solana Validator
        </h1>

        <p className="text-xl md:text-3xl lg:text-4xl text-gray-400 font-medium max-w-4xl mb-14 leading-relaxed">
          Analyze global network health, calculate validator trust scores, and monitor delegated stake in real time.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Link 
            href="/dashboard"
            className="group relative inline-flex items-center justify-center px-8 py-5 text-lg font-bold text-white transition-all duration-300 bg-gradient-to-r from-purple-600 to-emerald-500 rounded-2xl hover:scale-105 shadow-[0_0_40px_rgba(153,69,255,0.4)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] overflow-hidden"
          >
            <span className="absolute inset-0 w-full h-full -mt-1 rounded-2xl opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
            <span className="relative flex items-center gap-3">
              Get Started <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </Link>

          <a href="https://solana.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white font-bold transition-colors uppercase tracking-widest text-sm underline decoration-white/20 underline-offset-8">
            Learn More
          </a>
        </div>
      </main>

      <footer className="absolute bottom-8 text-xs font-mono text-gray-600 tracking-widest uppercase">
        Built with Next.js & @solana/web3.js
      </footer>
    </div>
  );
}
