/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Coins, Trophy, Zap, ChevronRight, History, Settings, Info, RefreshCw, Star, X, Volume2, VolumeX } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";

// --- Sound Service ---
const SOUNDS = {
  click: "https://www.soundjay.com/buttons/sounds/button-16.mp3",
  spin: "https://www.soundjay.com/mechanical/sounds/mechanical-clutter-1.mp3",
  win: "https://www.soundjay.com/misc/sounds/bell-ring-01.mp3",
  bigWin: "https://www.soundjay.com/misc/sounds/magic-chime-01.mp3",
  ambient_idle: "https://assets.mixkit.co/music/preview/mixkit-chinese-temple-garden-135.mp3",
  ambient_bonus: "https://assets.mixkit.co/music/preview/mixkit-adventure-drums-and-flute-128.mp3",
};

class SoundService {
  private static muted = false;
  private static bgm: HTMLAudioElement | null = null;
  private static currentBgmId: string | null = null;

  static setMuted(muted: boolean) {
    this.muted = muted;
    if (this.bgm) {
      this.bgm.muted = muted;
      if (!muted && this.bgm.paused) {
        this.bgm.play().catch(() => {});
      }
    }
  }

  static isMuted() {
    return this.muted;
  }

  static play(sound: keyof typeof SOUNDS, volume = 0.5) {
    if (this.muted) return;
    const audio = new Audio(SOUNDS[sound]);
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  static playBGM(sound: keyof typeof SOUNDS, volume = 0.15) {
    if (this.currentBgmId === sound) return;
    
    if (this.bgm) {
      const prevBgm = this.bgm;
      let fadeOutVol = prevBgm.volume;
      const fadeOut = setInterval(() => {
        fadeOutVol = Math.max(0, fadeOutVol - 0.01);
        prevBgm.volume = fadeOutVol;
        if (fadeOutVol <= 0) {
          prevBgm.pause();
          clearInterval(fadeOut);
        }
      }, 50);
    }

    const audio = new Audio(SOUNDS[sound]);
    audio.loop = true;
    audio.volume = 0;
    audio.muted = this.muted;
    this.bgm = audio;
    this.currentBgmId = sound;

    audio.play().then(() => {
      let fadeInVol = 0;
      const fadeIn = setInterval(() => {
        fadeInVol = Math.min(volume, fadeInVol + 0.01);
        audio.volume = fadeInVol;
        if (fadeInVol >= volume) clearInterval(fadeIn);
      }, 100);
    }).catch(() => {});
  }
}

// --- Types ---
interface SlotSymbol {
  id: string;
  name: string;
  image: string;
  value: number;
  color: string;
}

interface WinResult {
  multiplier: number;
  winAmount: number;
  symbol: SlotSymbol | null;
}

// --- Constants ---
const SYMBOLS: SlotSymbol[] = [
  { id: "dragon", name: "Red Dragon", image: "龍", value: 50, color: "text-imperial-red" },
  { id: "phoenix", name: "Phoenix", image: "鳳", value: 25, color: "text-gold" },
  { id: "tiger", name: "Tiger", image: "虎", value: 15, color: "text-paper" },
  { id: "mahjong1", name: "Fortune", image: "發", value: 10, color: "text-green-500" },
  { id: "mahjong2", name: "Center", image: "中", value: 5, color: "text-red-500" },
  { id: "coin", name: "Gold Coin", image: "元", value: 2, color: "text-yellow-400" },
  { id: "lantern", name: "Celestial Lantern", image: "🏮", value: 0, color: "text-orange-500" },
];

const PAYLINES = [
  // Horizontal
  [0, 0, 0, 0, 0], 
  [1, 1, 1, 1, 1], 
  [2, 2, 2, 2, 2], 
  [3, 3, 3, 3, 3],
  
  // V-shapes & M-shapes
  [0, 1, 2, 1, 0],
  [1, 2, 3, 2, 1],
  [2, 1, 0, 1, 2],
  [3, 2, 1, 2, 3],

  // Zig-zags
  [0, 1, 0, 1, 0],
  [1, 0, 1, 0, 1],
  [2, 3, 2, 3, 2],
  [3, 2, 3, 2, 3],
  [0, 0, 1, 2, 2],
  [3, 3, 2, 1, 1],

  // Diagonals
  [0, 1, 2, 3, 3],
  [3, 2, 1, 0, 0],
  [1, 2, 3, 3, 3],
  [2, 1, 0, 0, 0],
  
  // Waves
  [0, 1, 1, 1, 0],
  [3, 2, 2, 2, 3],
];

const BASE_SPIN_DURATION = 1500;
const TURBO_SPIN_DURATION = 500;

// --- Utility Functions ---
const SYMBOL_WEIGHTS: Record<string, number> = {
  dragon: 4,     // Very Rare
  phoenix: 8,    // Rare
  tiger: 12,     // Uncommon
  mahjong1: 18,  // Common
  mahjong2: 22,  // Very Common
  coin: 35,      // Most Common
  lantern: 6,    // Bonus scatter - Rare
};

const getRandomSymbol = () => {
  const totalWeight = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (const s of SYMBOLS) {
    const weight = SYMBOL_WEIGHTS[s.id] || 10;
    if (random < weight) return s;
    random -= weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
};

// --- Components ---

const CelestialParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            opacity: 0, 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{ 
            opacity: [0, 0.4, 0],
            y: [null, "-100%"],
            x: [null, (Math.random() - 0.5) * 200 + "px"]
          }}
          transition={{ 
            duration: Math.random() * 10 + 10, 
            repeat: Infinity, 
            delay: Math.random() * 5,
            ease: "linear"
          }}
          className="absolute w-1 h-1 bg-gold rounded-full blur-[1px]"
        />
      ))}
    </div>
  );
};

const CelestialRays = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(212,175,55,0.05)_20deg,transparent_40deg)] opacity-30 animate-[spin_60s_linear_infinite]" />
  </div>
);

interface SlotReelProps {
  symbols: SlotSymbol[];
  spinning: boolean;
  index: number;
  isWinner: boolean;
  winningRows: number[];
}

const SlotReel: React.FC<SlotReelProps> = ({ symbols, spinning, index, isWinner, winningRows }) => {
  return (
    <div className="relative h-[220px] sm:h-[260px] md:h-[320px] w-14 sm:w-16 md:w-24 overflow-hidden border border-gold/10 bg-black/40 rounded-sm">
      <AnimatePresence mode="popLayout">
        {spinning ? (
          <motion.div
            key="spinning"
            initial={{ y: 0 }}
            animate={{ y: -1000 }}
            transition={{ 
              repeat: Infinity, 
              duration: 0.1, 
              ease: "linear",
              delay: index * 0.05
            }}
            className="flex flex-col items-center py-4 gap-4"
          >
            {[...SYMBOLS, ...SYMBOLS, ...SYMBOLS].map((s, i) => (
              <div key={i} className="text-3xl md:text-5xl serif opacity-20 grayscale">
                {s.image}
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="stopped"
            initial={{ y: 30, opacity: 0, scale: 0.8 }}
            animate={{ 
              y: [20, -5, 0], 
              opacity: 1, 
              scale: isWinner ? [1, 1.05, 1] : 1,
              filter: isWinner ? ["brightness(1)", "brightness(1.5)", "brightness(1)"] : "brightness(1)"
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 15,
              y: { duration: 0.3 },
              scale: isWinner ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.4 },
              filter: isWinner ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.4 }
            }}
            className={`flex flex-col items-center justify-around h-full py-2 relative ${isWinner ? 'shimmer-effect' : ''}`}
          >
            {symbols.map((s, rowIdx) => (
              <div key={rowIdx} className="relative w-full flex items-center justify-center">
                <div className={`text-4xl md:text-6xl serif gold-text-glow transition-all duration-500 ${s.color} ${winningRows.includes(rowIdx) ? 'scale-125 z-10' : ''}`}>
                  {s.image}
                </div>
                {winningRows.includes(rowIdx) && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 0.4, 0], scale: [1, 1.8, 2.2] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="absolute inset-0 rounded-full bg-gold/20 blur-xl"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                          animate={{ 
                            opacity: 0, 
                            scale: [0, 1.2, 0], 
                            x: Math.cos(i * (Math.PI / 4)) * 50,
                            y: Math.sin(i * (Math.PI / 4)) * 50,
                            rotate: 45
                          }}
                          transition={{ 
                            duration: 0.8, 
                            ease: "easeOut",
                            repeat: Infinity,
                            repeatDelay: 0.4,
                            delay: i * 0.05
                          }}
                          className="absolute w-1 h-2 bg-gold border border-white/10"
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Glossy Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/80 via-transparent to-black/80 opacity-60"></div>
      <div className="absolute inset-0 pointer-events-none border-x border-gold/5 shadow-inner"></div>
    </div>
  );
};

const Header = ({ balance, onOpenPaytable, onOpenHistory, isMuted, onToggleMute }: { balance: number, onOpenPaytable: () => void, onOpenHistory: () => void, isMuted: boolean, onToggleMute: () => void }) => (
  <header className="fixed top-0 left-0 w-full z-50 p-2 md:p-3 flex justify-between items-center bg-gradient-to-b from-obsidian to-transparent transition-all">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 border border-gold rotate-45 flex items-center justify-center bg-imperial-red/20 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
        <span className="text-lg serif text-gold font-bold -rotate-45">禧</span>
      </div>
      <div>
        <h1 className="text-sm md:text-base font-serif tracking-[0.2em] text-gold leading-none">DYNASTY</h1>
        <p className="text-[8px] uppercase tracking-[0.4em] opacity-40">Celestial Reels</p>
      </div>
    </div>

    <div className="flex items-center gap-6">
      <div className={`glass px-6 py-2 rounded-full flex items-center gap-3 border-gold/20 transition-all ${balance < 2 ? 'ring-2 ring-imperial-red/50 bg-imperial-red/10' : ''}`}>
        <Coins size={16} className={balance < 2 ? 'text-imperial-red' : 'text-gold'} />
        <span className={`text-lg font-mono tracking-wider ${balance < 2 ? 'text-imperial-red' : 'text-paper'}`}>
          {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(balance)}
        </span>
        {balance < 10 && (
          <button 
            onClick={() => { SoundService.play('click'); window.location.reload(); /* Simple way to reset state for demo */ }}
            className="ml-2 text-[8px] uppercase tracking-widest text-gold hover:text-white transition-colors border border-gold/30 px-2 py-0.5 rounded-sm"
          >
            Replenish
          </button>
        )}
      </div>
      <button 
        onClick={() => { SoundService.play('click'); onToggleMute(); }}
        className="p-2 border border-white/10 rounded-full hover:bg-white/5 transition-colors group"
      >
        {isMuted ? <VolumeX size={18} className="text-imperial-red" /> : <Volume2 size={18} className="opacity-50 group-hover:opacity-100 group-hover:text-gold transition-opacity" />}
      </button>
      <button 
        onClick={() => { SoundService.play('click'); onOpenHistory(); }}
        className="p-2 border border-white/10 rounded-full hover:bg-white/5 transition-colors group"
      >
        <History size={18} className="opacity-50 group-hover:opacity-100 group-hover:text-gold transition-opacity" />
      </button>
      <button 
        onClick={() => { SoundService.play('click'); onOpenPaytable(); }}
        className="p-2 border border-white/10 rounded-full hover:bg-white/5 transition-colors group"
      >
        <Info size={18} className="opacity-50 group-hover:opacity-100 group-hover:text-gold transition-opacity" />
      </button>
    </div>
  </header>
);

const WinBanner = ({ amount, symbol, onClose }: { amount: number, symbol: SlotSymbol | null, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-1/3 left-1/2 -translate-x-1/2 z-[140] pointer-events-none w-full max-w-sm"
    >
      <div className="bg-obsidian/90 backdrop-blur-xl border border-gold/40 py-2 px-6 rounded-sm shadow-[0_0_30px_rgba(212,175,55,0.2)] text-center relative overflow-hidden flex items-center justify-center gap-4">
         <motion.div 
           animate={{ x: ['-200%', '200%'] }}
           transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
           className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/5 to-transparent skew-x-12"
         />
         <div className="flex items-center gap-3 relative z-10">
            <Trophy className="text-gold" size={16} />
            <h2 className="text-xs md:text-sm font-serif text-gold tracking-[0.4em] uppercase italic leading-none">Big Win</h2>
            <div className="w-[1px] h-3 bg-gold/20" />
            <p className="text-lg font-mono text-paper leading-none">+${amount.toFixed(2)}</p>
         </div>
      </div>
    </motion.div>
  );
};

const BetConfirmModal = ({ currentBet, newBet, onConfirm, onCancel }: { currentBet: number, newBet: number, onConfirm: () => void, onCancel: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      className="max-w-sm w-full bg-charcoal border border-gold/30 p-8 rounded-sm shadow-2xl space-y-6"
    >
      <div className="text-center">
        <div className="w-12 h-12 border border-gold/30 mx-auto rotate-45 flex items-center justify-center mb-6">
          <Settings size={20} className="text-gold -rotate-45" />
        </div>
        <h3 className="text-xl font-serif text-gold tracking-widest uppercase mb-2">Adjust Stake?</h3>
        <p className="text-[10px] uppercase tracking-widest text-paper/40">Confirm your new celestial offering</p>
      </div>

      <div className="flex items-center justify-between bg-black/40 p-4 border border-white/5">
        <div className="text-left">
          <p className="text-[8px] uppercase tracking-widest text-white/20 mb-1">Current</p>
          <p className="text-xl font-mono text-white/40">${currentBet}</p>
        </div>
        <ChevronRight className="text-gold/20" />
        <div className="text-right">
          <p className="text-[8px] uppercase tracking-widest text-gold/40 mb-1">New Stake</p>
          <p className="text-2xl font-mono text-gold">${newBet}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <button 
          onClick={() => { SoundService.play('click'); onCancel(); }}
          className="py-3 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-paper/60 hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
        <button 
          onClick={() => { SoundService.play('click'); onConfirm(); }}
          className="py-3 bg-gold text-obsidian font-bold text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-transform"
        >
          Confirm
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const Paytable = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md"
      >
        <div className="max-w-2xl w-full bg-charcoal p-12 border border-gold/20 rounded-sm relative shadow-2xl">
           <button onClick={() => { SoundService.play('click'); onClose(); }} className="absolute top-8 right-8 text-gold hover:rotate-90 transition-transform">
             <X size={24} />
           </button>
           
           <div className="text-center mb-12">
             <span className="text-[10px] uppercase tracking-[0.5em] text-gold/40">Celestial Payouts</span>
             <h2 className="text-4xl font-serif mt-2">Empire Odds</h2>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="text-[8px] uppercase tracking-[0.4em] text-gold/60">RTP: 1% - 99% Dynamic</span>
                <div className="w-1 h-1 rounded-full bg-gold/20" />
                <span className="text-[8px] uppercase tracking-[0.4em] text-gold/60">Imperial Variance</span>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
             {SYMBOLS.map(s => (
               <div key={s.id} className="flex flex-col items-center p-6 border border-white/5 hover:bg-white/5 transition-colors group">
                 <div className={`text-5xl serif mb-4 transition-transform group-hover:scale-110 ${s.color}`}>{s.image}</div>
                 <p className="text-xs uppercase tracking-widest text-paper/60 mb-1">{s.name}</p>
                 <p className="text-lg font-mono text-gold leading-none">{s.value}x</p>
               </div>
             ))}
           </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

interface WinHistoryItem {
  id: string;
  amount: number;
  symbol: SlotSymbol;
  timestamp: number;
}

type SlotTheme = 'imperial' | 'jade';

const WinHistory = ({ isOpen, onClose, items }: { isOpen: boolean, onClose: () => void, items: WinHistoryItem[] }) => {
  const [filterSymbol, setFilterSymbol] = useState<string | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'high'>('newest');

  const filteredItems = items
    .filter(item => filterSymbol === 'all' || item.symbol.id === filterSymbol)
    .sort((a, b) => {
      if (sortOrder === 'newest') return b.timestamp - a.timestamp;
      if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
      if (sortOrder === 'high') return b.amount - a.amount;
      return 0;
    });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          className="fixed inset-0 z-[120] flex justify-end"
        >
          <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl bg-charcoal h-full border-l border-gold/10 shadow-2xl flex flex-col">
            <div className="p-8 md:p-12 border-b border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-serif">Celestial Log</h2>
                <p className="text-[10px] uppercase tracking-widest text-gold/40 mt-1">Past Fortunes & Blessings</p>
              </div>
              <button onClick={() => { SoundService.play('click'); onClose(); }} className="p-2 hover:rotate-90 transition-transform text-gold">
                <X size={24} />
              </button>
            </div>

            {/* Controls */}
            <div className="p-8 bg-black/20 flex flex-wrap gap-6 items-center border-b border-white/5">
              <div className="flex flex-col gap-2">
                <span className="text-[8px] uppercase tracking-widest text-white/30">Sort By</span>
                <select 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="bg-transparent border border-white/10 text-[10px] uppercase tracking-widest px-3 py-1 focus:border-gold outline-none"
                >
                  <option value="newest" className="bg-charcoal">Latest First</option>
                  <option value="oldest" className="bg-charcoal">Oldest First</option>
                  <option value="high" className="bg-charcoal">Highest amount</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[8px] uppercase tracking-widest text-white/30">Filter Symbol</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFilterSymbol('all')}
                    className={`px-3 py-1 text-[8px] uppercase tracking-widest border transition-all ${filterSymbol === 'all' ? 'border-gold text-gold bg-gold/10' : 'border-white/5 opacity-40'}`}
                  >All</button>
                  {SYMBOLS.map(s => (
                    <button 
                      key={s.id}
                      onClick={() => setFilterSymbol(s.id)}
                      className={`px-3 py-1 border transition-all ${filterSymbol === s.id ? 'border-gold text-gold bg-gold/10' : 'border-white/5 opacity-40'}`}
                    >{s.image}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto px-8 md:px-12 py-8 space-y-6 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                  <History size={48} className="mb-4" />
                  <p className="text-xs uppercase tracking-[0.3em]">No fortunes matching criteria</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={item.id} 
                    className="flex items-center justify-between group bg-white/5 p-4 border border-white/5 hover:border-gold/20 transition-all"
                  >
                    <div className="flex items-center gap-6">
                      <div className={`text-4xl serif ${item.symbol.color}`}>{item.symbol.image}</div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-paper/60 mb-1">{item.symbol.name}</p>
                        <p className="text-[10px] opacity-30">{new Date(item.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-mono text-gold leading-none mb-1">+${item.amount.toFixed(2)}</p>
                      <p className="text-[8px] uppercase tracking-widest text-gold/40">Empire Gain</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const [balance, setBalance] = useState(1000.00);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [autoplaySpins, setAutoplaySpins] = useState(0);
  const [history, setHistory] = useState<WinHistoryItem[]>([]);
  const [theme, setTheme] = useState<SlotTheme>('imperial');
  const [freeSpins, setFreeSpins] = useState(0);
  const [consecutiveWins, setConsecutiveWins] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const [showBonusIntro, setShowBonusIntro] = useState(false);
  const [showBetConfirm, setShowBetConfirm] = useState(false);
  const [pendingBet, setPendingBet] = useState(bet);
  const [isTurbo, setIsTurbo] = useState(false);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    SoundService.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    if (freeSpins > 0) {
      SoundService.playBGM('ambient_bonus', 0.2);
    } else {
      SoundService.playBGM('ambient_idle', 0.15);
    }
  }, [freeSpins]);

  const [reels, setReels] = useState<SlotSymbol[][]>(Array(5).fill(0).map(() => Array(4).fill(0).map(getRandomSymbol)));
  const [winResult, setWinResult] = useState<WinResult | null>(null);
  const [winningPaylines, setWinningPaylines] = useState<number[]>([]);

  const checkWin = (currentReels: SlotSymbol[][]) => {
    let totalWin = 0;
    let winningSymbol: SlotSymbol | null = null;
    let winMult = 0;
    const winningPaylineIndices: number[] = [];

    // Check for Lantern Scatters in any position (3 or more)
    const lanternCount = currentReels.flat().filter(s => s.id === 'lantern').length;
    if (lanternCount >= 3) {
      SoundService.play('bigWin');
      setFreeSpins(prev => prev + 10);
      setShowBonusIntro(true);
      setTimeout(() => setShowBonusIntro(false), 4000);
      setWinResult({ multiplier: 0, winAmount: 0, symbol: SYMBOLS.find(s => s.id === 'lantern') || null });
    }

    // Check all 20 Paylines
    PAYLINES.forEach((payline, lineIdx) => {
      const lineSymbols = payline.map((rowIdx, reelIdx) => currentReels[reelIdx][rowIdx]);
      
      const firstId = lineSymbols[0].id;
      if (firstId === 'lantern') return;

      let matchCount = 1;
      for (let i = 1; i < 5; i++) {
        if (lineSymbols[i].id === firstId) {
          matchCount++;
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        const symbol = lineSymbols[0];
        // Calculate payout based on match count (3=x1, 4=x2, 5=x5 of base value)
        const countMult = matchCount === 5 ? 5 : matchCount === 4 ? 2 : 1;
        const multiplier = (freeSpins > 0 ? symbol.value * 2 : symbol.value) * countMult;
        totalWin += bet * multiplier;
        winMult += multiplier;
        winningSymbol = symbol;
        winningPaylineIndices.push(lineIdx);
      }
    });

    if (totalWin > 0) {
      const currentStreak = consecutiveWins + 1;
      const streakMult = Math.pow(2, Math.floor(currentStreak / 3));
      const finalWin = totalWin * (streakMultiplier || 1);
      
      setConsecutiveWins(currentStreak);
      setStreakMultiplier(streakMult);

      setWinResult({ multiplier: winMult * streakMultiplier, winAmount: finalWin, symbol: winningSymbol });
      setBalance(prev => prev + finalWin);
      
      // Map payline indices to which row in each reel is winning
      setWinningPaylines(winningPaylineIndices);
      
      const isBigWin = (winMult * streakMultiplier) >= 25;
      if (isBigWin) {
        SoundService.play('bigWin');
        // Reset streak on Big Win as requested
        setConsecutiveWins(0);
        setStreakMultiplier(1);
      } else {
        SoundService.play('win');
      }

      setHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        amount: finalWin,
        symbol: winningSymbol!,
        timestamp: Date.now()
      }, ...prev].slice(0, 50));

      return true;
    }
    
    // Reset streak on non-win spin
    setConsecutiveWins(0);
    setStreakMultiplier(1);
    return false;
  };

  const spin = useCallback(() => {
    const isFreeSpin = freeSpins > 0;
    
    if (spinning || (!isFreeSpin && balance < bet)) {
      setIsAutoplay(false);
      setAutoplaySpins(0);
      return;
    }

    if (!isFreeSpin) {
      setBalance(prev => prev - bet);
    } else {
      setFreeSpins(prev => prev - 1);
    }

    SoundService.play('spin', 0.3);
    setSpinning(true);
    setScreenShake(true);
    setWinResult(null);
    setWinningPaylines([]);

    const currentDuration = isTurbo ? TURBO_SPIN_DURATION : BASE_SPIN_DURATION;

    setTimeout(() => {
      const newReels = Array(5).fill(0).map(() => Array(4).fill(0).map(getRandomSymbol));
      
      setReels(newReels);
      checkWin(newReels);
      setSpinning(false);
      setScreenShake(false);

      if (isAutoplay && autoplaySpins > 0) {
        setAutoplaySpins(prev => prev - 1);
      }
    }, currentDuration);
  }, [spinning, balance, bet, isAutoplay, autoplaySpins, freeSpins, isTurbo]);

  useEffect(() => {
    if ((isAutoplay || freeSpins > 0) && !spinning) {
      autoplayTimerRef.current = setTimeout(() => {
        if (freeSpins > 0 || (isAutoplay && autoplaySpins > 0)) {
          spin();
        }
      }, 1000); // 1s pause between spins
    } else if (autoplaySpins === 0 && freeSpins === 0) {
      setIsAutoplay(false);
    }

    return () => {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    };
  }, [isAutoplay, spinning, autoplaySpins, freeSpins, spin]);

  const toggleAutoplay = (count: number) => {
    if (isAutoplay) {
      setIsAutoplay(false);
      setAutoplaySpins(0);
    } else {
      setAutoplaySpins(count);
      setIsAutoplay(true);
    }
  };

  const requestBetChange = (newAmount: number) => {
    if (newAmount === bet || spinning) return;
    setPendingBet(newAmount);
    setShowBetConfirm(true);
  };

  return (
    <div className={`h-svh selection:bg-gold selection:text-obsidian overflow-hidden flex flex-col transition-all duration-1000 relative ${freeSpins > 0 ? 'bg-indigo-950 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]' : theme === 'imperial' ? 'bg-imperial-pattern' : 'bg-jade-pattern'}`}>
      <AnimatePresence>
        {freeSpins > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-0"
          >
            <CelestialParticles />
            <CelestialRays />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.2)_0%,transparent_70%)] animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
      <Header 
        balance={balance} 
        onOpenPaytable={() => setShowPaytable(true)} 
        onOpenHistory={() => setShowHistory(true)} 
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(prev => !prev)}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-2 pt-14 md:pt-16 lg:flex-row lg:gap-8 overflow-hidden relative min-h-0">
        {/* Left Stats (Desktop) */}
        <div className="hidden lg:flex flex-col gap-4 w-60">
           <div className="glass p-4 border-gold/20">
              <span className="text-[10px] uppercase tracking-widest text-gold/40 block mb-4">Celestial Log</span>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {history.map(item => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={item.id} 
                    className="flex items-center gap-4 border-b border-white/5 pb-3"
                  >
                    <div className={`text-2xl serif ${item.symbol.color}`}>{item.symbol.image}</div>
                    <div>
                      <p className="text-sm font-mono text-gold">+${item.amount.toFixed(0)}</p>
                      <p className="text-[8px] opacity-30">{new Date(item.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </motion.div>
                ))}
                {history.length === 0 && (
                   <p className="text-[10px] text-center py-8 opacity-20 italic">Awaiting Fortune</p>
                )}
              </div>
           </div>
           
           <div className="glass p-6 border-gold/20">
              <span className="text-[10px] uppercase tracking-widest text-gold/40 block mb-4">Realm Switcher</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { SoundService.play('click'); setTheme('imperial'); }}
                  className={`py-2 text-[8px] uppercase tracking-widest border transition-all ${theme === 'imperial' ? 'border-gold text-gold bg-gold/10' : 'border-white/10 opacity-40'}`}
                >Imperial</button>
                <button 
                  onClick={() => { SoundService.play('click'); setTheme('jade'); }}
                  className={`py-2 text-[8px] uppercase tracking-widest border transition-all ${theme === 'jade' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-white/10 opacity-40'}`}
                >Jade</button>
              </div>
           </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-4 flex gap-4 h-8 items-center">
             <AnimatePresence>
                {streakMultiplier > 1 && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 bg-imperial-red/20 px-4 py-1 border border-imperial-red/40 rounded-full"
                  >
                    <Zap size={14} className="text-imperial-red animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-paper">Streak x{streakMultiplier}</span>
                  </motion.div>
                )}
                {freeSpins > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 bg-gold/20 px-4 py-1 border border-gold/40 rounded-full"
                  >
                    <RefreshCw size={14} className="text-gold animate-spin" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">Celestial Spins: {freeSpins}</span>
                    <div className="w-[1px] h-3 bg-gold/40 mx-1" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">2x Mult</span>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>

          <motion.div 
            animate={screenShake ? {
               x: [0, -5, 5, -5, 5, 0],
               transition: { repeat: Infinity, duration: 0.1 }
            } : {}}
            className="relative"
          >
            {/* Machine Frame */}
              <div className={`p-1 md:p-4 border-2 rounded-sm backdrop-blur-xl relative z-10 shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-1000 ${freeSpins > 0 ? 'bg-indigo-900/40 border-gold shadow-[0_0_80px_rgba(212,175,55,0.4)]' : theme === 'imperial' ? 'bg-obsidian/40 border-gold/20' : 'bg-obsidian/40 border-emerald-500/20'}`}>
                <div className={`flex gap-1 p-1 md:p-4 rounded-sm shadow-inner border border-white/5 transition-colors duration-1000 ${freeSpins > 0 ? 'bg-indigo-950/80' : 'bg-obsidian/80'}`}>
                {reels.map((reelSymbols: SlotSymbol[], i: number) => {
                  const reelWinningRows = winningPaylines
                    .map(lineIdx => PAYLINES[lineIdx][i]);
                  
                  return (
                    <SlotReel 
                      key={i} 
                      index={i} 
                      symbols={reelSymbols} 
                      spinning={spinning} 
                      isWinner={winningPaylines.length > 0}
                      winningRows={reelWinningRows}
                    />
                  );
                })}
                </div>

                {/* Payline indicators */}
                <div className="absolute left-0 w-full h-full top-0 z-20 pointer-events-none">
                  {PAYLINES.map((line, lineIdx) => {
                    const isWinning = winningPaylines.includes(lineIdx);
                    if (!isWinning) return null;
                    return null;
                  })}
                  {[0, 1, 2, 3].map(row => {
                    const isWinningRow = winningPaylines.some(idx => {
                      const line = PAYLINES[idx];
                      return line.every(r => r === row);
                    });
                    return (
                      <div 
                        key={row}
                        className={`absolute left-0 w-full h-[1px] transition-all duration-500 ${isWinningRow ? 'bg-gold opacity-100 shadow-[0_0_10px_gold]' : 'bg-gold/5 opacity-50'}`}
                        style={{ top: `${(row + 0.5) * 25}%` }}
                      />
                    );
                  })}
                </div>
              </div>

            {/* Decorative Elements */}
            <div className={`absolute -top-12 -left-12 w-32 h-32 border-t-2 border-l-2 pointer-events-none transition-colors duration-1000 ${theme === 'imperial' ? 'border-gold/20' : 'border-emerald-500/20'}`}></div>
            <div className={`absolute -bottom-12 -right-12 w-32 h-32 border-b-2 border-r-2 pointer-events-none transition-colors duration-1000 ${theme === 'imperial' ? 'border-gold/20' : 'border-emerald-500/20'}`}></div>
          </motion.div>

          {/* Controls Section */}
          <div className="mt-2 md:mt-4 w-full max-w-4xl px-2 md:px-0">
            <div className="flex flex-col md:grid md:grid-cols-3 gap-4 md:gap-6 items-center bg-obsidian/60 p-3 md:p-6 border-t border-white/5 backdrop-blur-lg rounded-t-2xl md:rounded-t-lg">
            
            {/* Bet Controls - Combined for Mobile */}
            <div className="w-full flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-4 md:gap-2 order-2 md:order-1">
              <div className="flex flex-col items-start gap-1">
                <span className="text-[8px] md:text-[10px] uppercase tracking-[0.4em] text-gold/50">Current Stake</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => requestBetChange(Math.max(1, bet - 5))}
                    className="w-10 h-10 md:w-8 md:h-8 border border-white/10 flex items-center justify-center hover:border-gold transition-colors text-gold bg-white/5 rounded-full md:rounded-sm active:scale-90"
                  >－</button>
                  <span className="text-xl md:text-3xl font-mono text-gold w-16 text-center">${bet}</span>
                  <button 
                    onClick={() => requestBetChange(Math.min(500, bet + 5))}
                    className="w-10 h-10 md:w-8 md:h-8 border border-white/10 flex items-center justify-center hover:border-gold transition-colors text-gold bg-white/5 rounded-full md:rounded-sm active:scale-90"
                  >＋</button>
                </div>
              </div>

              <div className="hidden md:flex gap-1">
                {[10, 20, 50, 100].map(val => (
                  <button
                    key={val}
                    onClick={() => requestBetChange(val)}
                    className={`px-2 py-1 text-[8px] border transition-all ${bet === val ? 'bg-gold/20 border-gold text-gold' : 'border-white/5 text-paper/40 hover:border-white/20'}`}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              <div className="flex md:hidden flex-col items-end gap-1">
                <button 
                  onClick={() => requestBetChange(balance)}
                  className="text-[8px] uppercase tracking-[0.2em] text-gold font-bold bg-gold/10 px-2 py-1 border border-gold/20 rounded-sm"
                >MAX</button>
              </div>
            </div>

            {/* Main Spin Button - Centered and Larger on Mobile */}
            <div className="flex flex-col items-center gap-4 order-1 md:order-2">
              {balance < bet && !spinning && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[8px] md:text-[10px] uppercase tracking-[0.3em] text-imperial-red font-bold animate-pulse mb-0 md:mb-2"
                >
                  Insufficient Balance
                </motion.div>
              )}
              <div className="relative group">
                <motion.button
                  whileHover={!(spinning || balance < bet || isAutoplay) ? { scale: 1.05 } : {}}
                  whileTap={!(spinning || balance < bet || isAutoplay) ? { scale: 0.9 } : {}}
                  onClick={() => { SoundService.play('click'); spin(); }}
                  disabled={spinning || balance < bet || isAutoplay}
                  className={`relative z-10 transition-all duration-500 ${spinning || isAutoplay || balance < bet ? 'grayscale opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="absolute inset-0 bg-gold blur-3xl opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className={`relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center transition-colors duration-500 ${balance < bet ? 'border-white/10 bg-white/5' : 'border-gold bg-imperial-red shadow-[0_0_50px_rgba(159,29,53,0.6)]'} overflow-hidden`}>
                     {spinning ? (
                       <div className="flex flex-col items-center">
                         <RefreshCw className="animate-spin text-gold mb-1" size={32} />
                         <span className="text-[10px] tracking-[0.2em] text-gold/60 animate-pulse font-serif uppercase">Invoking</span>
                       </div>
                     ) : (
                       <span className={`text-2xl md:text-2xl font-serif tracking-widest uppercase transition-transform ${balance < bet ? 'text-white/20' : 'text-gold group-hover:scale-110 font-bold'}`}>
                         {balance < bet ? 'Locked' : 'Spin'}
                       </span>
                     )}

                     {/* Progress Ring Overlay */}
                     {spinning && (
                       <svg className="absolute inset-0 -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                         <motion.circle
                           cx="50"
                           cy="50"
                           r="46"
                           stroke="rgba(212, 175, 55, 0.6)"
                           strokeWidth="4"
                           fill="transparent"
                           initial={{ pathLength: 0 }}
                           animate={{ pathLength: 1 }}
                            transition={{ duration: (isTurbo ? TURBO_SPIN_DURATION : BASE_SPIN_DURATION) / 1000, ease: "linear" }}
                         />
                       </svg>
                     )}
                  </div>
                </motion.button>
              </div>

              {/* Mobile Autoplay & Turbo (Unified bar below spin) */}
              <div className="flex items-center gap-3 md:gap-4">
                <button
                  onClick={() => { SoundService.play('click'); setIsTurbo(!isTurbo); }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${isTurbo ? 'bg-gold border-obsidian text-obsidian shadow-[0_0_15px_rgba(212,175,55,0.5)]' : 'border-white/20 text-white/60 hover:text-white bg-white/5'}`}
                >
                  <Zap size={10} className={isTurbo ? 'fill-obsidian' : ''} />
                  <span className="text-[10px] md:text-[8px] font-bold uppercase tracking-widest leading-none">Turbo</span>
                </button>

                {isAutoplay ? (
                  <button
                    onClick={() => { SoundService.play('click'); toggleAutoplay(0); }}
                    className="px-4 py-1.5 border border-imperial-red text-imperial-red bg-imperial-red/10 text-[10px] rounded-full uppercase tracking-widest font-bold animate-pulse"
                  >
                    STOP ({autoplaySpins})
                  </button>
                ) : (
                  <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                    {[10, 25, 50].map(count => (
                      <button
                        key={count}
                        onClick={() => { SoundService.play('click'); toggleAutoplay(count); }}
                        disabled={spinning || balance < bet}
                        className="text-[10px] md:text-[8px] uppercase tracking-widest text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 hover:text-gold hover:border-gold/50 transition-all rounded-sm md:rounded-none whitespace-nowrap"
                      >
                        Auto {count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions / Status Label - Right Side on Desktop */}
            <div className="hidden md:flex flex-col items-end gap-3 order-3">
               <button 
                onClick={() => requestBetChange(balance)}
                className="text-[10px] uppercase tracking-[0.3em] text-white/40 hover:text-gold transition-colors"
               >Max Bet</button>
               <div className="flex gap-2">
                 {[10, 50, 100].map(val => (
                   <button 
                    key={val}
                    onClick={() => requestBetChange(val)}
                    className={`px-3 py-1 border text-[10px] transition-all ${bet === val ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-white/40'}`}
                   >
                    ${val}
                   </button>
                 ))}
               </div>
            </div>

          </div>
        </div>
      </div>
    </main>

      <footer className="p-2 md:p-4 flex justify-between items-center bg-black/40 text-[7px] md:text-[8px] uppercase tracking-[0.3em] text-paper/20 border-t border-white/5">
        <div className="flex gap-8">
          <div className="flex items-center gap-2"><Star size={12} /> Provably Fair</div>
          <div className="flex items-center gap-2"><Zap size={12} /> Instant Payout</div>
          <div className="flex items-center gap-2 opacity-50"><Info size={12} /> RTP: 96.5%</div>
        </div>
        <p>&copy; 2024 Dynasty Gaming.</p>
      </footer>

      {/* Overlays */}
      <Paytable isOpen={showPaytable} onClose={() => setShowPaytable(false)} />
      <WinHistory isOpen={showHistory} onClose={() => setShowHistory(false)} items={history} />
      
      <AnimatePresence>
        {showBonusIntro && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-32 left-1/2 -translate-x-1/2 z-[130] pointer-events-none"
          >
            <div className="bg-black/80 backdrop-blur-xl border border-gold/50 px-8 py-4 rounded-sm shadow-[0_0_30px_rgba(212,175,55,0.3)] text-center relative overflow-hidden">
               <motion.div 
                 animate={{ x: ['-100%', '200%'] }}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                 className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/10 to-transparent skew-x-12"
               />
               <h2 className="text-2xl md:text-3xl font-serif text-gold tracking-widest italic mb-1">CELESTIAL MODE</h2>
               <p className="text-[10px] uppercase tracking-[0.4em] text-paper/80 font-bold">+10 FREE SPINS (2X MULT)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {winResult && (
          <WinBanner 
            amount={winResult.winAmount} 
            symbol={winResult.symbol} 
            onClose={() => setWinResult(null)} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBetConfirm && (
          <BetConfirmModal 
            currentBet={bet}
            newBet={pendingBet}
            onConfirm={() => { setBet(pendingBet); setShowBetConfirm(false); }}
            onCancel={() => setShowBetConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
