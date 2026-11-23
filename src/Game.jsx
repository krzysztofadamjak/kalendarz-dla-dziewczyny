import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import Snowfall from 'react-snowfall';

// --- BAZA ULEPSZEŃ ---
const UPGRADES = {
  elf: { id: 'elf', name: 'Zwinny Elf', baseCost: 15, cps: 1, icon: '🧝‍♂️', desc: 'Produkuje 1 Magię na sekundę.' },
  reindeer: { id: 'reindeer', name: 'Renifer', baseCost: 200, cps: 15, icon: '🦌', desc: 'Produkuje 15 Magii na sekundę.' },
  maverick: { id: 'maverick', name: 'Maverick w LPG', baseCost: 1500, cps: 100, icon: '🛻', desc: 'Produkuje 100 Magii na sekundę.' },
  lexus: { id: 'lexus', name: 'Lexus Hybryda', baseCost: 10000, cps: 500, icon: '🏎️', desc: 'Produkuje 500 Magii na sekundę.' }
};

export default function Game() {
  const [gameState, setGameState] = useState('menu');
  const [player, setPlayer] = useState(null);
  
  const [magic, setMagic] = useState(0);
  const [inventory, setInventory] = useState({ elf: 0, reindeer: 0, maverick: 0, lexus: 0 });
  
  const [leaderboard, setLeaderboard] = useState({ stary: { magic: 0 }, stara: { magic: 0 } });
  const [offlineGains, setOfflineGains] = useState(0);
  
  // Referencje dla asynchronicznych interwałów
  const magicRef = useRef(magic);
  const inventoryRef = useRef(inventory);
  
  useEffect(() => { magicRef.current = magic; }, [magic]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);

  // --- 1. NASŁUCHIWANIE RANKINGU NA ŻYWO ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factory"), (snapshot) => {
      const lb = { stary: { magic: 0 }, stara: { magic: 0 } };
      snapshot.forEach(doc => {
        lb[doc.id] = doc.data();
      });
      setLeaderboard(lb);
    });
    return () => unsub();
  }, []);

  // --- 2. OBLICZANIE KOSZTÓW I ZYSKÓW ---
  const getCost = (id) => Math.floor(UPGRADES[id].baseCost * Math.pow(1.15, inventory[id]));
  
  const getCPS = () => {
    return (inventory.elf * UPGRADES.elf.cps) + 
           (inventory.reindeer * UPGRADES.reindeer.cps) + 
           (inventory.maverick * UPGRADES.maverick.cps) + 
           (inventory.lexus * UPGRADES.lexus.cps);
  };

  // --- 3. INICJALIZACJA GRACZA I ZYSKI OFFLINE ---
  const handleStart = async (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setGameState('loading');
    
    const docRef = doc(db, "factory", selectedPlayer);
    const docSnap = await getDoc(docRef);
    
    let currentData;
    if (docSnap.exists()) {
      currentData = docSnap.data();
      const savedInventory = {
        elf: currentData.elf || 0,
        reindeer: currentData.reindeer || 0,
        maverick: currentData.maverick || 0,
        lexus: currentData.lexus || 0
      };
      setInventory(savedInventory);
      
      // Oblicz zyski z czasu, gdy apka była wyłączona!
      const now = Date.now();
      const diffSeconds = Math.floor((now - (currentData.lastUpdate || now)) / 1000);
      
      const cps = (savedInventory.elf * UPGRADES.elf.cps) + 
                  (savedInventory.reindeer * UPGRADES.reindeer.cps) + 
                  (savedInventory.maverick * UPGRADES.maverick.cps) + 
                  (savedInventory.lexus * UPGRADES.lexus.cps);
                  
      const earned = Math.max(0, diffSeconds * cps);
      
      setMagic(currentData.magic + earned);
      setOfflineGains(earned);
      
      if (earned > 0) {
        // Zapisz od razu ten przyrost do bazy
        await updateDoc(docRef, { magic: currentData.magic + earned, lastUpdate: now });
      }
    } else {
      // Nowy gracz w bazie
      currentData = { magic: 0, elf: 0, reindeer: 0, maverick: 0, lexus: 0, lastUpdate: Date.now() };
      await setDoc(docRef, currentData);
      setMagic(0);
    }
    
    setGameState('playing');
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3');
    audio.volume = 0.5; audio.play().catch(()=>{});
  };

  // --- 4. PĘTLA GRY (ZARABIANIE CO SEKUNDĘ) ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      const cps = getCPS();
      if (cps > 0) setMagic(prev => prev + cps);
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, inventory]);

  // --- 5. ZAPIS DO BAZY CO 5 SEKUND ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    const saveTimer = setInterval(async () => {
      try {
        await updateDoc(doc(db, "factory", player), {
          magic: magicRef.current,
          lastUpdate: Date.now()
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [gameState, player]);

  // --- INTERAKCJE ---
  const handleTap = () => {
    setMagic(prev => prev + 1);
    const tapAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_3db61a7a14.mp3');
    tapAudio.volume = 0.1; tapAudio.play().catch(()=>{});
  };

  const handleBuy = async (id) => {
    const cost = getCost(id);
    if (magic >= cost) {
      const newMagic = magic - cost;
      const newInv = { ...inventory, [id]: inventory[id] + 1 };
      
      setMagic(newMagic);
      setInventory(newInv);
      
      // Zapisz zakup natychmiast, żeby nie przepadł przy zamknięciu karty!
      try {
        await updateDoc(doc(db, "factory", player), {
          magic: newMagic,
          [id]: newInv[id],
          lastUpdate: Date.now()
        });
      } catch (e) {}
      
      const buyAudio = new Audio('https://cdn.pixabay.com/audio/2021/08/09/audio_88447e12e2.mp3');
      buyAudio.volume = 0.3; buyAudio.play().catch(()=>{});
    }
  };

  // --- RENDEROWANIE ---
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black p-4 flex flex-col items-center relative overflow-hidden font-sans select-none">
      <Snowfall color="#ffffff" snowflakeCount={60} style={{ opacity: 0.3, zIndex: 0 }} />

      <div className="z-10 w-full max-w-lg flex flex-col items-center pt-4 pb-20">
        
        {/* EKRAN MENU */}
        {gameState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-10">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">
              Fabryka Mikołaja 🏭
            </h1>
            <p className="text-blue-200/70 mb-10 italic text-sm text-center">
              Klikaj w prezent, kupuj ulepszenia i produkuj magię! <br/>Gra toczy się cały grudzień, nawet gdy śpisz.
            </p>

            <div className="bg-black/40 border border-amber-500/30 rounded-3xl p-6 w-full mb-10 backdrop-blur-md shadow-[0_0_30px_rgba(251,191,36,0.1)]">
              <h2 className="text-amber-400 font-bold tracking-widest uppercase mb-6 text-sm text-center flex justify-center items-center gap-2"><span>🏆</span> Wyścig Zbrojeń <span>🏆</span></h2>
              
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-blue-900/30 p-4 rounded-xl border border-blue-500/30 shadow-inner">
                  <span className="font-bold text-white uppercase tracking-wider text-lg">Stary</span>
                  <span className="text-2xl font-mono text-amber-400 font-bold drop-shadow-lg">{Math.floor(leaderboard.stary?.magic || 0)} ✨</span>
                </div>
                <div className="flex justify-between items-center bg-pink-900/30 p-4 rounded-xl border border-pink-500/30 shadow-inner">
                  <span className="font-bold text-white uppercase tracking-wider text-lg">Stara</span>
                  <span className="text-2xl font-mono text-amber-400 font-bold drop-shadow-lg">{Math.floor(leaderboard.stara?.magic || 0)} ✨</span>
                </div>
              </div>
            </div>

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wybierz swoją fabrykę:</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => handleStart('stary')} className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 text-white font-bold py-5 rounded-2xl border border-blue-400/50 shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition-all text-xl uppercase">Stary</button>
              <button onClick={() => handleStart('stara')} className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 text-white font-bold py-5 rounded-2xl border border-pink-400/50 shadow-[0_10px_20px_rgba(219,39,119,0.3)] transition-all text-xl uppercase">Stara</button>
            </div>
            
            <Link to="/" className="mt-12 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1">Wróć do Kalendarza</Link>
          </div>
        )}

        {/* EKRAN GRY */}
        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            
            {/* WIDŻET ZYSKÓW OFFLINE */}
            {offlineGains > 0 && (
              <div className="bg-emerald-900/80 border border-emerald-400 text-emerald-100 p-4 rounded-2xl w-full mb-6 text-center animate-pulse-slow shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <p className="font-bold text-sm uppercase tracking-widest mb-1">Zyski Offline!</p>
                <p className="text-xs">Podczas Twojej nieobecności fabryka wyprodukowała <strong>{offlineGains}</strong> magii! ✨</p>
                <button onClick={() => setOfflineGains(0)} className="mt-3 bg-emerald-700 hover:bg-emerald-600 text-xs px-6 py-2 rounded-full font-bold">Odbierz</button>
              </div>
            )}

            {/* HEADER PUNKTÓW */}
            <div className="bg-black/50 backdrop-blur-xl border-b border-amber-500/30 w-screen fixed top-0 left-0 p-4 flex justify-between items-center z-20 shadow-xl">
              <div className="flex flex-col">
                <span className="text-xs text-amber-200/50 uppercase tracking-widest font-bold">Twoja Magia Świąt</span>
                <span className="text-3xl md:text-4xl text-amber-400 font-mono font-bold drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">{Math.floor(magic)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-emerald-300/70 uppercase tracking-widest font-bold">Produkcja</span>
                <span className="text-xl text-emerald-400 font-mono font-bold">+{getCPS()}/sek</span>
              </div>
            </div>

            {/* GŁÓWNY PRZYCISK (TAP) */}
            <div className="mt-28 mb-12 flex justify-center items-center">
              <button 
                onClick={handleTap} 
                className="text-[120px] md:text-[150px] filter drop-shadow-[0_20px_50px_rgba(239,68,68,0.5)] transform active:scale-90 transition-transform cursor-pointer hover:rotate-3"
              >
                🎁
              </button>
            </div>

            {/* SKLEP ULEPSZEŃ */}
            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-white/10 shadow-2xl">
              <h3 className="text-white/80 font-bold mb-4 uppercase tracking-widest text-xs flex justify-between px-2">
                <span>Sklep Ulepszeń</span>
                <span className="text-amber-500/70">Wydawaj mądrze!</span>
              </h3>
              
              <div className="flex flex-col gap-3">
                {Object.values(UPGRADES).map(upg => {
                  const cost = getCost(upg.id);
                  const canAfford = magic >= cost;
                  const count = inventory[upg.id];
                  
                  return (
                    <div key={upg.id} className="bg-black/40 border border-white/5 rounded-2xl p-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl bg-white/5 p-2 rounded-xl border border-white/10">{upg.icon}</div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{upg.name}</span>
                          <span className="text-[10px] text-slate-400">{upg.desc}</span>
                          <span className="text-xs text-emerald-400 font-bold mt-1">Posiadasz: {count} szt.</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleBuy(upg.id)}
                        disabled={!canAfford}
                        className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl font-bold min-w-[90px] transition-all border ${canAfford ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/40' : 'bg-slate-800 text-slate-500 border-slate-700 opacity-50'}`}
                      >
                        <span className="text-[10px] uppercase">Kup za</span>
                        <span>{cost} ✨</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex gap-4 w-full">
              <button onClick={() => setGameState('menu')} className="flex-1 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 text-xs font-bold uppercase py-4 rounded-xl border border-white/10 transition-colors">Wróć do Menu</button>
              <Link to="/" className="flex-1 bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-bold uppercase py-4 rounded-xl border border-red-500/30 transition-colors flex justify-center items-center">Wyjście</Link>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}