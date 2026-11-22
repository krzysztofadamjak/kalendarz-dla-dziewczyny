import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Snowfall from 'react-snowfall';

export default function Wallet() {
  const [vouchers, setVouchers] = useState([]);
  const [now, setNow] = useState(new Date().getTime());

  // Aktualizacja czasu co sekundę dla liczników
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadedVouchers = [];
    const isTestMode = location.pathname.startsWith('/test');
    const prefix = isTestMode ? 'test_voucher_day_' : 'voucher_day_';

    // Przeglądamy 24 dni
    for (let i = 1; i <= 24; i++) {
      const voucherText = localStorage.getItem(`${prefix}${i}`);
      
      if (voucherText) {
        // Sprawdzamy, czy kupon dostał czas "odkrycia"
        let timeScratched = localStorage.getItem(`time_scratched_${prefix}${i}`);
        
        // Jeśli nie ma czasu, a jest odkryty (kompatybilność wsteczna z poprzednimi testami), ustawiamy na teraz
        if (!timeScratched) {
          timeScratched = new Date().getTime().toString();
          localStorage.setItem(`time_scratched_${prefix}${i}`, timeScratched);
        }

        // Dajemy każdemu kuponowi dokładnie 48 godzin (172800000 milisekund) na realizację
        const expirationTime = parseInt(timeScratched, 10) + (48 * 60 * 60 * 1000);
        
        // Czy został zrealizowany? (Stan z Firebase lub localStorage - uprośćmy na razie do localStorage)
        // Uwaga: W idealnym scenariuszu pobieralibyśmy isCompleted z Firestore. 
        // Dla prostoty i szybkości sprawdzamy flagę lokalną:
        const isCompleted = localStorage.getItem(`completed_${prefix}${i}`) === 'true';

        loadedVouchers.push({
          day: i,
          text: voucherText,
          expirationTime,
          isCompleted
        });
      }
    }
    
    // Sortujemy: najpierw te aktywne, z najkrótszym czasem, na końcu wygasłe/zrealizowane
    loadedVouchers.sort((a, b) => a.expirationTime - b.expirationTime);
    setVouchers(loadedVouchers);
  }, []);

  // Funkcja formatująca pozostały czas
  const getRemainingTime = (expTime) => {
    const diff = expTime - now;
    if (diff <= 0) return "Wygasł";
    
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / 1000 / 60) % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900 via-red-950 to-emerald-950 p-6 md:p-12 flex flex-col items-center relative overflow-hidden font-sans pb-24">
      <Snowfall color="#ffffff" snowflakeCount={40} style={{ opacity: 0.3, zIndex: 0 }} />

      <div className="z-10 w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 font-extrabold mb-2 font-serif text-center mt-6">
          Twój Portfel Kuponów
        </h1>
        <p className="text-amber-100/70 mb-10 italic text-sm text-center px-4">
          Pamiętaj, każdy odkryty kupon ważny jest tylko 48 godzin!
        </p>

        {vouchers.length === 0 ? (
          <div className="bg-black/30 backdrop-blur-md border border-white/10 p-10 rounded-3xl text-center max-w-md w-full">
            <span className="text-6xl mb-4 block opacity-50">🪪</span>
            <h3 className="text-xl text-amber-200 font-bold mb-2">Portfel jest pusty!</h3>
            <p className="text-white/60 text-sm">Odkryj swój pierwszy prezent, aby dodać tutaj kupon.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full px-2">
            {vouchers.map((v) => {
              const isExpired = now >= v.expirationTime;
              const isExpiringSoon = !isExpired && (v.expirationTime - now < 12 * 60 * 60 * 1000); // Mniej niż 12h
              
              let cardStyle = "bg-gradient-to-r from-emerald-800 to-emerald-950 border-emerald-500/50 shadow-[0_8px_30px_rgba(16,185,129,0.2)]"; // Aktywny
              let statusText = `Ważny jeszcze: ${getRemainingTime(v.expirationTime)}`;
              let statusColor = "text-emerald-300";

              if (v.isCompleted) {
                cardStyle = "bg-slate-800/80 border-emerald-500 shadow-inner opacity-70";
                statusText = "Zrealizowany ✅";
                statusColor = "text-emerald-400 font-bold";
              } else if (isExpired) {
                cardStyle = "bg-slate-900/90 border-red-900 opacity-60 grayscale";
                statusText = "Kupon Wygasł ❌";
                statusColor = "text-red-500 font-bold";
              } else if (isExpiringSoon) {
                cardStyle = "bg-gradient-to-r from-red-900 to-orange-950 border-red-500 animate-pulse-slow shadow-[0_0_20px_rgba(239,68,68,0.4)]";
                statusColor = "text-red-300 font-bold";
              }

              return (
                <div key={v.day} className={`relative p-6 rounded-3xl border-2 backdrop-blur-md transition-all transform hover:scale-[1.02] flex flex-col justify-between overflow-hidden ${cardStyle}`}>
                  {/* Subtelny "pasek magnetyczny" dla efektu karty */}
                  <div className="absolute top-0 right-0 w-20 h-full bg-white/5 transform skew-x-12"></div>
                  
                  <div className="flex justify-between items-start mb-4 z-10">
                    <h3 className="text-amber-400 font-bold uppercase tracking-widest text-xs">
                      {isTestMode ? "TEST " : ""}Kupon z dnia {v.day}
                    </h3>
                    <span className="text-2xl opacity-50">🎫</span>
                  </div>
                  
                  <p className={`text-xl md:text-2xl font-serif italic mb-6 z-10 ${v.isCompleted || isExpired ? 'text-slate-400' : 'text-amber-50 drop-shadow-md'}`}>
                    "{v.text}"
                  </p>
                  
                  <div className="flex justify-between items-end border-t border-white/10 pt-4 z-10">
                    <span className={`text-sm ${statusColor}`}>
                      {statusText}
                    </span>
                    
                    {!v.isCompleted && !isExpired && (
                      <Link to={isTestMode ? `/test/${v.day}` : `/dzien/${v.day}`} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors border border-white/20">
                        Przejdź do realizacji
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link to="/" className="mt-12 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full border border-white/20 transition-all backdrop-blur-md shadow-lg">
          Wróć do Kalendarza
        </Link>
      </div>
    </div>
  );
}