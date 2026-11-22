import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function App() {
  const { dayId } = useParams();
  const currentDay = parseInt(dayId, 10);
  const location = useLocation();
  const isTestMode = location.pathname.startsWith('/test');
  
  const { width, height } = useWindowSize();
  
  const [voucher, setVoucher] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  
  const captureRef = useRef(null);
  const today = new Date();
  let realMonth = today.getMonth(); 
  let realDate = today.getDate();

  const isLocked = !isTestMode && (realMonth < 11 || (realMonth === 11 && realDate < currentDay));

  // Pobieranie statusów z bazy i tekstu bonu
  useEffect(() => {
    const fetchVoucherData = async () => {
      try {
        const docRef = doc(db, "vouchers", currentDay.toString());
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPhotoUrl(data.photoUrl || null);
          setReaction(data.reaction || null);
          setIsCompleted(data.isCompleted || false);
        }
      } catch (e) {
        console.log("Błąd pobierania danych", e);
      }

      const storageKey = isTestMode ? `test_voucher_day_${currentDay}` : `voucher_day_${currentDay}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setVoucher(saved);
        setHasDrawn(true);
      } else {
        setVoucher(null);
        setHasDrawn(false);
      }
    };
    fetchVoucherData();
  }, [currentDay, isTestMode]);

  const playMagicSound = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_24e20f1883.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Brak autoodtwarzania"));
  };

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

      playMagicSound();
      setShowConfetti(true);
      
      setVoucher(selectedVoucher);
      setHasDrawn(true);
      
      const storageKey = isTestMode ? `test_voucher_day_${currentDay}` : `voucher_day_${currentDay}`;
      localStorage.setItem(storageKey, selectedVoucher);
      
      setTimeout(() => setShowConfetti(false), 5000);
    } catch (error) {
      alert("Błąd połączenia z bazą danych.");
    } finally {
      setIsLoading(false);
    }
  };

  // Zapisywanie reakcji w Firebase
  const handleReaction = async (emoji) => {
    if (isTestMode) return; // W trybie testowym nie nadpisujemy bazy
    try {
      const docRef = doc(db, "vouchers", currentDay.toString());
      await updateDoc(docRef, { reaction: emoji });
      setReaction(emoji);
    } catch (e) {
      console.error(e);
    }
  };

  // Oznaczanie bonu jako zrealizowany w Firebase
  const handleComplete = async () => {
    if (isTestMode) return;
    try {
      const docRef = doc(db, "vouchers", currentDay.toString());
      await updateDoc(docRef, { isCompleted: true });
      setIsCompleted(true);
      playMagicSound();
    } catch (e) {
      console.error(e);
    }
  };

  const shareAsImage = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#450a0a', 
        scale: 2,
        useCORS: true
      });
      const base64image = canvas.toDataURL("image/png");
      setGeneratedImage(base64image);
    } catch (error) {}
  };

  if (isNaN(currentDay) || currentDay < 1 || currentDay > 24) {
    return <div className="min-h-screen bg-gradient-to-br from-red-900 to-emerald-950 flex items-center justify-center p-4"><div className="text-amber-400 text-2xl font-bold font-serif">Nieprawidłowy dzień! 🎁</div></div>;
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 flex items-center justify-center p-4">
        <div className="bg-red-950/80 backdrop-blur-sm p-8 rounded-3xl text-center max-w-md w-full border-2 border-red-800 shadow-xl">
          <h2 className="text-6xl mb-4 animate-bounce">🎁</h2>
          <h2 className="text-3xl font-bold text-amber-400 mb-4 font-serif">Jeszcze nie czas!</h2>
          <p className="text-red-200 text-lg mb-8 italic">Ten prezent otworzy się dopiero <strong>{currentDay} grudnia</strong>.</p>
          <Link to="/" className="inline-block bg-gradient-to-r from-emerald-700 to-emerald-900 text-amber-300 font-bold py-3 px-8 rounded-full border border-emerald-500">Wróć do kalendarza</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} gravity={0.2} />}

      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 flex flex-col items-center justify-center p-4 relative overflow-hidden pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.15)_0%,_transparent_60%)] pointer-events-none"></div>

        {/* Kontener do robienia screenshota */}
        <div ref={captureRef} className="flex flex-col items-center w-full z-10 pt-8 pb-4 px-4 rounded-3xl">
          {isTestMode && <div className="text-red-400 font-bold mb-2 text-sm">TRYB TESTOWY</div>}
          
          <h1 className="text-5xl md:text-6xl text-amber-400 font-extrabold mb-8 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] font-serif">
            Grudzień {currentDay}
          </h1>
          
          {!hasDrawn ? (
            <button 
              onClick={drawVoucher}
              disabled={isLoading}
              className="bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-500 text-amber-300 font-bold py-5 px-10 rounded-full shadow-[0_0_20px_rgba(4,120,87,0.6)] transition-all transform hover:scale-105 disabled:opacity-50 border-2 border-emerald-400 font-serif text-xl"
            >
              {isLoading ? "Rozwiązywanie wstążki..." : "Odkryj dzisiejszy prezent 🎀"}
            </button>
          ) : (
            <div className="flex flex-col items-center w-full max-w-md">
              
              {/* Polaroid ze zdjęciem (Jeśli dodano link w Adminie) */}
              {photoUrl && (
                <div className="bg-white p-3 pb-6 rounded-sm shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform mb-6 w-full border border-slate-200">
                  <img src={photoUrl} alt="Wspomnienie" className="w-full h-64 object-cover border border-slate-100" crossOrigin="anonymous" />
                  <p className="text-center text-slate-800 font-serif mt-3 text-lg italic">Wspomnienie roku</p>
                </div>
              )}

              {/* Karta Bonu */}
              <div className="bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] bg-amber-50 text-red-950 p-8 rounded-xl shadow-[0_0_40px_rgba(251,191,36,0.3)] text-center w-full border-4 border-double border-red-900 relative">
                <div className="absolute top-2 left-2 text-2xl opacity-30">🎄</div>
                <div className="absolute bottom-2 right-2 text-2xl opacity-30">🦌</div>
                <h2 className="text-xl font-bold mb-4 text-emerald-800 font-serif uppercase tracking-widest border-b-2 border-emerald-800/20 pb-4">
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
          <div className="flex flex-col items-center gap-6 z-10 mt-6 w-full max-w-md">
            
            {/* SYSTEM REAKCJI */}
            <div className="bg-red-950/40 p-4 rounded-2xl border border-red-800 w-full text-center backdrop-blur-sm">
              {!reaction ? (
                <>
                  <p className="text-amber-200 mb-3 font-serif text-sm">Jak Ci się podoba ten bon?</p>
                  <div className="flex justify-center gap-4 text-4xl">
                    <button onClick={() => handleReaction('😍')} className="hover:scale-125 transition-transform">😍</button>
                    <button onClick={() => handleReaction('😂')} className="hover:scale-125 transition-transform">😂</button>
                    <button onClick={() => handleReaction('🤔')} className="hover:scale-125 transition-transform">🤔</button>
                  </div>
                </>
              ) : (
                <p className="text-amber-300 font-serif text-lg">Moja reakcja: <span className="text-2xl ml-2">{reaction}</span></p>
              )}
            </div>

            {/* PRZYCISK ZREALIZOWANE */}
            {!isCompleted ? (
              <button 
                onClick={handleComplete}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105 border border-emerald-400 text-lg flex items-center justify-center gap-2"
              >
                <span>🎯</span> Oznacz jako ZREALIZOWANY
              </button>
            ) : (
              <div className="w-full bg-emerald-900/60 border-2 border-emerald-500 text-emerald-300 font-bold py-4 px-8 rounded-xl text-center text-lg flex items-center justify-center gap-2">
                <span>✅</span> Ten bon został zrealizowany!
              </div>
            )}

            <button 
              onClick={shareAsImage}
              className="mt-4 bg-red-800/50 hover:bg-red-700 text-amber-100 font-bold py-3 px-8 rounded-full shadow-lg transition-colors flex items-center gap-2 border border-red-600"
            >
              📸 Zapisz / Wyślij obrazek
            </button>
            
            <Link to={isTestMode ? "/test" : "/"} className="text-sm text-red-300 hover:text-amber-300 font-bold underline">
              Wróć do kalendarza
            </Link>
          </div>
        )}
      </div>

      {generatedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
          <p className="text-amber-400 font-bold mb-6 text-center text-lg animate-pulse font-serif">👇 Przytrzymaj obrazek palcem, aby zapisać 👇</p>
          <img src={generatedImage} alt="Bon" className="max-h-[65vh] rounded-xl border-2 border-amber-400/50" />
          <button onClick={() => setGeneratedImage(null)} className="mt-10 bg-red-700 text-white font-bold py-4 px-10 rounded-full border border-red-500">✖ Zamknij</button>
        </div>
      )}
    </>
  );
}