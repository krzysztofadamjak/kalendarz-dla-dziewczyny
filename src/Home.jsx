import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Snowfall from 'react-snowfall';

export default function Home() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [countdownMessage, setCountdownMessage] = useState("Obliczanie czasu...");
  const [allUnlocked, setAllUnlocked] = useState(false);

  useEffect(() => {
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
      
      {/* Nowoczesny, płynny śnieg */}
      <Snowfall 
        color="#fde047" // Złotawy odcień śniegu pasujący do klimatu
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
        
        {/* Oszronione szkło (Glassmorphism) w liczniku */}
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
        
        {/* Luksusowa siatka kalendarza */}
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
        
        <div className="mt-16 flex flex-col md:flex-row gap-8 items-center border-t border-white/10 pt-8 w-full justify-center">
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