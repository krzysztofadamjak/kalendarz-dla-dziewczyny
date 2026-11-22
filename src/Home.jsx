import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Snowfall from 'react-snowfall';

// Funkcje pomocnicze do poprawnej odmiany polskich słów
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

export default function Home() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [countdownMessage, setCountdownMessage] = useState("Obliczanie czasu...");
  const [allUnlocked, setAllUnlocked] = useState(false);
  
  // Stan dla licznika związku
  const [together, setTogether] = useState({ years: 0, months: 0, days: 0 });

  useEffect(() => {
    // OBLICZANIE STAŻU ZWIĄZKU (od 10.01.2015)
    const calculateRelationship = () => {
      const start = new Date(2015, 0, 10); // Miesiące liczymy od 0 (0 = styczeń)
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

    // ODLICZANIE DO PREZENTÓW
    const interval = setInterval(() => {
      const now = new Date();
      let targetDate = null;
      let message = "";

      if (now.getMonth() < 11) {
        targetDate = new Date(now.getFullYear(), 11, 1, 0, 0, 0);
        message = "Pierwszy prezent odblokuje się za:";
      } else if (now.getMonth() === 11 && now.getDate() < 24) {
        targetDate = new Date(now.getFullYear(), 11, now.getDate() + 1, 0, 0, 0);
        message = "Kolejny prezent odblokuje się za:";
      } else {
        targetDate = null;
        message = "Wszystkie prezenty są już dostępne! 🎅";
        setAllUnlocked(true);
      }

      if (targetDate) {
        const diff = targetDate - now;
        if (diff > 0) {
          setTimeLeft({
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((diff / 1000 / 60) % 60),
            seconds: Math.floor((diff / 1000) % 60)
          });
          setCountdownMessage(message);
          setAllUnlocked(false);
        }
      } else {
        setCountdownMessage(message);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900 via-red-950 to-emerald-950 p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      <Snowfall 
        color="#fde047" 
        snowflakeCount={120} 
        radius={[0.5, 2.5]} 
        speed={[0.5, 1.5]} 
        wind={[-0.5, 0.5]} 
        style={{ opacity: 0.6, zIndex: 0 }}
      />

      <div className="z-10 flex flex-col items-center w-full max-w-5xl">
        
        <h1 className="text-5xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 font-extrabold mb-8 text-center drop-shadow-[0_5px_15px_rgba(251,191,36,0.3)] font-serif tracking-tight mt-6">
          Świąteczny Kalendarz
        </h1>
        
        {/* ODLICZANIE DO KALENDARZA */}
        <div className="flex flex-col items-center mb-12 bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] w-full max-w-lg transition-transform hover:scale-[1.02] duration-500">
          <div className="text-amber-400/80 text-xs md:text-sm mb-4 font-bold tracking-widest uppercase text-center">
            {countdownMessage}
          </div>
          
          {!allUnlocked && (
            <div className="flex gap-4 md:gap-6 text-amber-100 font-serif">
              {timeLeft.days > 0 && (
                <>
                  <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-5xl font-bold drop-shadow-lg">{timeLeft.days}</span><span className="text-[10px] md:text-xs uppercase tracking-wider text-amber-400/60 mt-1">Dni</span></div>
                  <div className="text-3xl font-bold opacity-30 mt-2">:</div>
                </>
              )}
              <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-5xl font-bold drop-shadow-lg">{timeLeft.hours.toString().padStart(2, '0')}</span><span className="text-[10px] md:text-xs uppercase tracking-wider text-amber-400/60 mt-1">Godz</span></div>
              <div className="text-3xl font-bold opacity-30 mt-2">:</div>
              <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-5xl font-bold drop-shadow-lg">{timeLeft.minutes.toString().padStart(2, '0')}</span><span className="text-[10px] md:text-xs uppercase tracking-wider text-amber-400/60 mt-1">Min</span></div>
              <div className="text-3xl font-bold opacity-30 mt-2">:</div>
              <div className="text-center flex flex-col items-center"><span className="text-4xl md:text-5xl font-bold drop-shadow-lg">{timeLeft.seconds.toString().padStart(2, '0')}</span><span className="text-[10px] md:text-xs uppercase tracking-wider text-amber-400/60 mt-1">Sek</span></div>
            </div>
          )}
        </div>
        
        {/* SIATKA DNI */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 md:gap-5 w-full">
          {[...Array(24)].map((_, i) => (
            <Link 
              key={i + 1} 
              to={`/dzien/${i + 1}`}
              className="group relative bg-gradient-to-br from-emerald-800/80 to-emerald-950/80 backdrop-blur-md hover:from-emerald-600 hover:to-emerald-800 text-amber-400 font-bold aspect-square rounded-2xl flex items-center justify-center text-3xl md:text-4xl transition-all duration-300 transform hover:-translate-y-2 border border-white/10 hover:border-amber-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(52,211,153,0.3)] font-serif overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="absolute top-2 right-2 text-xs md:text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-amber-200">🎁</span>
              <span className="z-10">{i + 1}</span>
            </Link>
          ))}
        </div>

        {/* NOWOŚĆ: LICZNIK ZWIĄZKU */}
        <div className="mt-14 mb-4 bg-black/30 backdrop-blur-xl border border-red-500/30 p-6 md:p-8 rounded-3xl shadow-[0_0_30px_rgba(220,38,38,0.15)] text-center w-full max-w-2xl transition-transform hover:scale-[1.02] duration-300">
          <p className="text-amber-200/60 text-xs md:text-sm font-bold tracking-widest uppercase mb-4 flex items-center justify-center gap-3">
            <span>✨</span> Nasza wspólna historia <span>✨</span>
          </p>
          <p className="text-lg md:text-2xl text-amber-100 font-serif leading-relaxed">
            Jesteśmy razem już <br className="md:hidden" />
            <span className="font-bold text-white text-3xl md:text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] mx-2">{together.years}</span> {formatYears(together.years)}, 
            <span className="font-bold text-white text-3xl md:text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] ml-3 mr-2">{together.months}</span> {formatMonths(together.months)} i 
            <span className="font-bold text-white text-3xl md:text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] ml-3 mr-2">{together.days}</span> {formatDays(together.days)} <span className="text-red-500 animate-pulse inline-block ml-1">❤️</span>
          </p>
        </div>
        
		{/* NOWY PRZYCISK PORTFELA */}
        <div className="mt-10 flex justify-center w-full">
        <Link to="/portfel" className="group bg-gradient-to-r from-emerald-600/30 to-emerald-800/30 hover:from-emerald-500/40 hover:to-emerald-700/40 border border-emerald-500/50 text-emerald-300 px-8 py-4 rounded-full font-bold text-lg tracking-wide transition-all transform hover:scale-105 flex items-center gap-4 shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md">
         <span className="text-2xl group-hover:scale-110 transition-transform">🪪</span> 
           Otwórz Portfel Kuponów
           </Link>
           </div>

        {/* STOPKA */}
        <div className="mt-6 flex flex-col md:flex-row gap-8 items-center border-t border-white/10 pt-8 w-full justify-center">
          <Link to="/regulamin" className="text-amber-400/70 hover:text-amber-300 font-bold text-sm tracking-wide transition-colors flex items-center gap-2">
            <span>📜</span> Przeczytaj Regulamin
          </Link>
          
          <Link to="/admin" className="text-white/20 hover:text-white/50 text-xs tracking-widest uppercase transition-colors">
            Panel Admina
          </Link>
        </div>
      </div>
    </div>
  );
}