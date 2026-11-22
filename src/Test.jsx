import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Snowfall from 'react-snowfall';

const formatYears = (y) => {
  if (y === 1) return 'rok';
  if ([2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100)) return 'lata';
  return 'lat';
};
const formatMonths = (m) => {
  if (m === 1) return 'miesiąc';
  if ([2, 3, 4].includes(m % 10) && ![12, 13, 14].includes(m % 100)) return 'miesiące';
  return 'miesięcy';
};
const formatDays = (d) => {
  if (d === 1) return 'dzień';
  return 'dni';
};

export default function Test() {
  const [together, setTogether] = useState({ years: 0, months: 0, days: 0 });

  useEffect(() => {
    const calculateRelationship = () => {
      const start = new Date(2015, 0, 10); 
      const now = new Date();
      let y = now.getFullYear() - start.getFullYear();
      let m = now.getMonth() - start.getMonth();
      let d = now.getDate() - start.getDate();
      if (d < 0) {
        m -= 1;
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        d += prevMonth.getDate();
      }
      if (m < 0) {
        y -= 1;
        m += 12;
      }
      setTogether({ years: y, months: m, days: d });
    };
    calculateRelationship();
  }, []);

  // FUNKCJA DO RESETOWANIA TESTÓW
  const handleResetTests = () => {
    if (window.confirm("Na pewno chcesz usunąć wszystkie testowe zdrapki, wyczyścić portfel i kary Grincha?")) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('test_voucher_') || key.includes('grinch_penalty_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      alert("Dane testowe usunięte!");
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900 via-red-950 to-emerald-950 p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden font-sans border-8 border-red-500/50">
      <Snowfall color="#fde047" snowflakeCount={120} radius={[0.5, 2.5]} speed={[0.5, 1.5]} wind={[-0.5, 0.5]} style={{ opacity: 0.6, zIndex: 0 }} />

      <div className="z-10 flex flex-col items-center w-full max-w-5xl">
        
        <div className="bg-red-500 text-white font-bold py-1 px-8 rounded-full mb-4 animate-pulse">TRYB TESTOWY BEZ BLOKAD</div>

        <h1 className="text-5xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 font-extrabold mb-12 text-center drop-shadow-[0_5px_15px_rgba(251,191,36,0.3)] font-serif tracking-tight mt-2">
          Świąteczny Kalendarz
        </h1>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 md:gap-5 w-full">
          {[...Array(24)].map((_, i) => (
            <Link key={i + 1} to={`/test/${i + 1}`} className="group relative bg-gradient-to-br from-red-800/80 to-red-950/80 backdrop-blur-md hover:from-red-600 hover:to-red-800 text-amber-400 font-bold aspect-square rounded-2xl flex items-center justify-center text-3xl md:text-4xl transition-all duration-300 transform hover:-translate-y-2 border border-red-500/50 hover:border-amber-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(239,68,68,0.3)] font-serif overflow-hidden">
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="absolute top-2 right-2 text-xs md:text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-amber-200">🎁</span>
              <span className="z-10">{i + 1}</span>
            </Link>
          ))}
        </div>

        <div className="mt-14 mb-4 bg-black/30 backdrop-blur-xl border border-red-500/30 p-6 md:p-8 rounded-3xl shadow-[0_0_30px_rgba(220,38,38,0.15)] text-center w-full max-w-2xl transition-transform hover:scale-[1.02] duration-300">
          <p className="text-amber-200/60 text-xs md:text-sm font-bold tracking-widest uppercase mb-4 flex items-center justify-center gap-3">
            <span>✨</span> Nasza wspólna historia <span>✨</span>
          </p>
          <p className="text-lg md:text-2xl text-amber-100 font-serif leading-relaxed">
            Jesteśmy razem już <br className="md:hidden" />
            <span className="font-bold text-white text-3xl md:text-4xl mx-2">{together.years}</span> {formatYears(together.years)}, 
            <span className="font-bold text-white text-3xl md:text-4xl ml-3 mr-2">{together.months}</span> {formatMonths(together.months)} i 
            <span className="font-bold text-white text-3xl md:text-4xl ml-3 mr-2">{together.days}</span> {formatDays(together.days)} <span className="text-red-500 animate-pulse inline-block ml-1">❤️</span>
          </p>
        </div>
        
        {/* PRZYCISK PORTFELA PRZEKAZUJĄCY STAN TESTOWY */}
        <div className="mt-6 flex flex-col gap-4 items-center w-full">
          <Link to="/portfel" state={{ isTest: true }} className="group bg-gradient-to-r from-emerald-600/30 to-emerald-800/30 hover:from-emerald-500/40 hover:to-emerald-700/40 border border-emerald-500/50 text-emerald-300 px-8 py-4 rounded-full font-bold text-lg tracking-wide transition-all transform hover:scale-105 flex items-center gap-4 shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md">
            <span className="text-2xl group-hover:scale-110 transition-transform">🪪</span> 
            Otwórz Testowy Portfel
          </Link>
          
          {/* NOWY PRZYCISK RESETU */}
          <button onClick={handleResetTests} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest border border-red-500/30 hover:border-red-500/80 px-4 py-2 rounded-full transition-colors flex items-center gap-2">
            <span>🗑️</span> Wyczyść dane testowe
          </button>
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-8 items-center border-t border-white/10 pt-8 w-full justify-center">
          <Link to="/" className="text-amber-400/70 hover:text-amber-300 font-bold text-sm tracking-wide transition-colors">Wróć do normalnej apki</Link>
          <Link to="/admin" className="text-white/20 hover:text-white/50 text-xs tracking-widest uppercase transition-colors">Panel Admina</Link>
        </div>
      </div>
    </div>
  );
}