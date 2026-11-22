import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';

export default function App() {
  const { dayId } = useParams();
  const currentDay = parseInt(dayId, 10);
  
  const location = useLocation();
  const isTestMode = location.pathname.startsWith('/test');
  
  const [voucher, setVoucher] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Nowy stan dla wygenerowanego obrazka na iOS
  const [generatedImage, setGeneratedImage] = useState(null);
  
  const captureRef = useRef(null);
  const today = new Date();
  let realMonth = today.getMonth(); 
  let realDate = today.getDate();

  const isLocked = !isTestMode && (realMonth < 11 || (realMonth === 11 && realDate < currentDay));

  useEffect(() => {
    const storageKey = isTestMode ? `test_voucher_day_${currentDay}` : `voucher_day_${currentDay}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setVoucher(saved);
      setHasDrawn(true);
    } else {
      setVoucher(null);
      setHasDrawn(false);
    }
  }, [currentDay, isTestMode]);

  const drawVoucher = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "vouchers", currentDay.toString());
      const docSnap = await getDoc(docRef);

      let todayOptions = ["Brak bonu. Mikołaj zapomniał dodać go do bazy! 🎅"];
      if (docSnap.exists() && docSnap.data().options?.length > 0) {
        todayOptions = docSnap.data().options;
      }

      const randomIndex = Math.floor(Math.random() * todayOptions.length);
      const selectedVoucher = todayOptions[randomIndex];

      setVoucher(selectedVoucher);
      setHasDrawn(true);
      
      const storageKey = isTestMode ? `test_voucher_day_${currentDay}` : `voucher_day_${currentDay}`;
      localStorage.setItem(storageKey, selectedVoucher);
    } catch (error) {
      console.error("Błąd bazy:", error);
      alert("Błąd połączenia z bazą danych.");
    } finally {
      setIsLoading(false);
    }
  };

  const shareAsImage = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#450a0a', 
        scale: 2,
        useCORS: true // Pomaga przy generowaniu na telefonach
      });
      
      // Zamiast wymuszać natywne API udostępniania, generujemy obrazek Base64 
      // i pokazujemy go użytkownikowi na ekranie.
      const base64image = canvas.toDataURL("image/png");
      setGeneratedImage(base64image);

    } catch (error) {
      console.error("Błąd generowania", error);
      alert("Nie udało się wygenerować obrazka.");
    }
  };

  if (isNaN(currentDay) || currentDay < 1 || currentDay > 24) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="text-amber-400 text-center text-2xl font-bold font-serif">Nieprawidłowy dzień! 🎁</div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 flex items-center justify-center p-4">
        <div className="bg-red-950/80 backdrop-blur-sm p-8 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-center max-w-md w-full border-2 border-red-800">
          <h2 className="text-6xl mb-4 animate-bounce">🎁</h2>
          <h2 className="text-3xl font-bold text-amber-400 mb-4 font-serif">Jeszcze nie czas!</h2>
          <p className="text-red-200 text-lg mb-8 italic">
            Ten prezent otworzy się dopiero <strong>{currentDay} grudnia</strong>. Mikołaj wszystko widzi! 🎅
          </p>
          <Link to="/" className="inline-block bg-gradient-to-r from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 text-amber-300 font-bold py-3 px-8 rounded-full shadow-lg border border-emerald-500 transition-transform hover:scale-105">
            Wróć do kalendarza
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.15)_0%,_transparent_60%)] pointer-events-none"></div>

        <div ref={captureRef} className="flex flex-col items-center w-full z-10 py-8 px-4 rounded-3xl">
          {isTestMode && <div className="text-red-400 font-bold mb-2 text-sm">TRYB TESTOWY</div>}
          
          <h1 className="text-5xl md:text-6xl text-amber-400 font-extrabold mb-8 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] font-serif">
            Grudzień {currentDay}
          </h1>
          
          {!hasDrawn ? (
            <button 
              onClick={drawVoucher}
              disabled={isLoading}
              className="bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-amber-300 font-bold py-5 px-10 rounded-full shadow-[0_0_20px_rgba(4,120,87,0.6)] transition-all transform hover:scale-105 disabled:opacity-50 border-2 border-emerald-400 font-serif text-xl"
            >
              {isLoading ? "Rozwiązywanie wstążki..." : "Odkryj dzisiejszy prezent 🎀"}
            </button>
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] bg-amber-50 text-red-950 p-10 rounded-xl shadow-[0_0_40px_rgba(251,191,36,0.3)] text-center max-w-md w-full animate-fade-in mb-8 border-4 border-double border-red-900 relative">
                <div className="absolute top-2 left-2 text-2xl opacity-30">🎄</div>
                <div className="absolute bottom-2 right-2 text-2xl opacity-30">🦌</div>
                
                <h2 className="text-2xl font-bold mb-6 text-emerald-800 font-serif uppercase tracking-widest border-b-2 border-emerald-800/20 pb-4">
                  Twój świąteczny bon
                </h2>
                <p className="text-2xl italic font-medium font-serif leading-relaxed text-red-950">
                  "{voucher}"
                </p>
              </div>
            </div>
          )}
        </div>
        
        {hasDrawn && (
          <div className="flex flex-col items-center gap-4 z-10 mt-4">
            <button 
              onClick={shareAsImage}
              className="bg-red-800/50 hover:bg-red-700 text-amber-100 font-bold py-3 px-8 rounded-full shadow-lg transition-colors flex items-center gap-2 border border-red-600 backdrop-blur-sm"
            >
              📸 Zapisz / Wyślij obrazek
            </button>
            
            <Link to={isTestMode ? "/test" : "/"} className="text-sm text-red-300 hover:text-amber-300 transition-colors font-bold underline mb-8">
              Wróć do kalendarza
            </Link>
          </div>
        )}
      </div>

      {/* Ekran pop-up z obrazkiem na iOS/Android */}
      {generatedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-fade-in">
          <p className="text-amber-400 font-bold mb-6 text-center text-lg animate-pulse font-serif">
            👇 Przytrzymaj obrazek palcem, <br/>aby go zapisać lub wysłać 👇
          </p>
          
          <img 
            src={generatedImage} 
            alt="Wygenerowany bon" 
            className="max-h-[65vh] w-auto rounded-xl shadow-[0_0_40px_rgba(251,191,36,0.3)] border-2 border-amber-400/50"
          />
          
          <button 
            onClick={() => setGeneratedImage(null)}
            className="mt-10 bg-red-700 hover:bg-red-600 text-white font-bold py-4 px-10 rounded-full border border-red-500 shadow-lg text-lg"
          >
            ✖ Zamknij
          </button>
        </div>
      )}
    </>
  );
}