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
  
  // Referencja do obszaru, z którego zrobimy obrazek
  const captureRef = useRef(null);

  const today = new Date();
  let realMonth = today.getMonth(); 
  let realDate = today.getDate();

  // Wyłączamy blokadę, jeśli adres zaczyna się od /test
  const isLocked = !isTestMode && (realMonth < 11 || (realMonth === 11 && realDate < currentDay));

  useEffect(() => {
    // Osobna pamięć dla testów, żeby nie zepsuć prawdziwych losowań
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

      let todayOptions = ["Brak bonu. Mikołaj zapomniał dodać go do bazy!"];
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
      // Robimy zrzut elementu z bonem
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#0f172a', // Kolor tła dopasowany do aplikacji
        scale: 2 // Lepsza jakość obrazka
      });
      
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `bon-dzien-${currentDay}.png`, { type: 'image/png' });
        
        // Sprawdzamy, czy urządzenie (np. smartfon) obsługuje bezpośrednie udostępnianie plików
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Mój bon na dzień ${currentDay}!`,
              files: [file]
            });
          } catch (e) {
            console.log("Anulowano udostępnianie.");
          }
        } else {
          // Awaryjnie (np. na PC) pobieramy obrazek na dysk
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `bon-dzien-${currentDay}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error("Błąd generowania grafiki", error);
      alert("Nie udało się wygenerować obrazka.");
    }
  };

  if (isNaN(currentDay) || currentDay < 1 || currentDay > 24) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center text-2xl font-bold">Nieprawidłowy dzień!</div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-700">
          <h2 className="text-4xl mb-4">🛑</h2>
          <h2 className="text-2xl font-bold text-red-500 mb-4">To jeszcze nie ten dzień!</h2>
          <p className="text-slate-300 text-lg mb-8">
            Ten bon będzie dostępny dopiero <strong>{currentDay} grudnia</strong>.
          </p>
          <Link to="/" className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full transition-colors">
            Wróć do kalendarza
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4" ref={captureRef}>
      {isTestMode && <div className="text-red-500 font-bold mb-4 animate-pulse">TRYB TESTOWY</div>}
      <h1 className="text-4xl text-white font-bold mb-8">Grudzień {currentDay}</h1>
      
      {!hasDrawn ? (
        <button 
          onClick={drawVoucher}
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50"
        >
          {isLoading ? "Losowanie..." : "Odkryj dzisiejszy prezent"}
        </button>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full animate-fade-in mb-6">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Twój bon na dziś:</h2>
            <p className="text-xl italic font-medium">"{voucher}"</p>
          </div>
          
          <button 
            onClick={shareAsImage}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-colors flex items-center gap-2 mb-4"
          >
            📸 Prześlij jako obrazek
          </button>
          
          <Link to={isTestMode ? "/test" : "/"} className="text-sm text-slate-500 hover:text-slate-300 font-bold underline">
            Wróć do siatki
          </Link>
        </div>
      )}
    </div>
  );
}