import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
        // Jesteśmy przed grudniem -> odliczamy do 1 grudnia tego samego roku, godzina 00:00
        targetDate = new Date(now.getFullYear(), 11, 1, 0, 0, 0);
        message = "Pierwszy prezent odblokuje się za:";
      } else if (now.getMonth() === 11 && now.getDate() < 24) {
        // Jesteśmy w grudniu (przed 24.) -> odliczamy do północy następnego dnia
        targetDate = new Date(now.getFullYear(), 11, now.getDate() + 1, 0, 0, 0);
        message = "Kolejny prezent odblokuje się za:";
      } else {
        // Jest 24 grudnia lub później
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
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 p-8 flex flex-col items-center justify-center relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 text-white text-2xl flex justify-around items-start">
        <span className="animate-[ping_3s_infinite]">❄️</span>
        <span className="animate-[ping_5s_infinite_1s]">❄️</span>
        <span className="animate-[ping_4s_infinite_0.5s]">❄️</span>
        <span className="animate-[ping_6s_infinite_2s]">❄️</span>
      </div>

      <h1 className="text-5xl md:text-6xl text-amber-400 font-extrabold mb-2 text-center drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] font-serif z-10 mt-4">
        🎄 Kalendarz 🎄
      </h1>
      
      {/* Dynamiczne odliczanie */}
      <div className="flex flex-col items-center z-10 mb-8 font-serif bg-red-950/50 p-4 rounded-xl border border-red-800/50 backdrop-blur-sm mt-4">
        <div className="text-amber-300 text-sm md:text-base mb-3 font-bold tracking-wider uppercase text-center">
          {countdownMessage}
        </div>
        
        {!allUnlocked && (
          <div className="flex gap-3 md:gap-4 text-amber-200">
            {timeLeft.days > 0 && (
              <>
                <div className="text-center"><span className="text-3xl font-bold">{timeLeft.days}</span><div className="text-xs uppercase">Dni</div></div>
                <div className="text-3xl font-bold opacity-50">:</div>
              </>
            )}
            <div className="text-center"><span className="text-3xl font-bold">{timeLeft.hours.toString().padStart(2, '0')}</span><div className="text-xs uppercase">Godz</div></div>
            <div className="text-3xl font-bold opacity-50">:</div>
            <div className="text-center"><span className="text-3xl font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</span><div className="text-xs uppercase">Min</div></div>
            <div className="text-3xl font-bold opacity-50">:</div>
            <div className="text-center"><span className="text-3xl font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</span><div className="text-xs uppercase">Sek</div></div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-4xl w-full z-10">
        {[...Array(24)].map((_, i) => (
          <Link 
            key={i + 1} 
            to={`/dzien/${i + 1}`}
            className="group relative bg-gradient-to-br from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 text-amber-300 font-bold aspect-square rounded-xl shadow-[0_0_15px_rgba(4,120,87,0.5)] flex items-center justify-center text-4xl transition-all transform hover:scale-110 hover:-translate-y-2 border-2 border-emerald-500 hover:border-amber-400 font-serif"
          >
            <span className="absolute top-2 right-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity">🎁</span>
            {i + 1}
          </Link>
        ))}
      </div>
      
      <div className="mt-12 flex flex-col md:flex-row gap-6 items-center z-10 mb-6">
        <Link to="/regulamin" className="text-amber-300 hover:text-amber-100 font-bold underline font-serif">
          📜 Przeczytaj Regulamin Kalendarza
        </Link>
        
        <Link to="/admin" className="text-red-300/40 hover:text-red-200 text-sm">
          Panel Admina
        </Link>
      </div>
    </div>
  );
}