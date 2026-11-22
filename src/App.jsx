import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  const { dayId } = useParams();
  const currentDay = parseInt(dayId, 10);
  
  const [voucher, setVoucher] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- LOGIKA BLOKADY CZASOWEJ ---
  const today = new Date();
  // W JavaScript miesiące liczone są od zera (0 = styczeń, 11 = grudzień)
  let realMonth = today.getMonth(); 
  let realDate = today.getDate();

  // TRYB TESTOWY (USUŃ UKOŚNIKI Z LINIJKI PONIŻEJ, ABY ZASYMULOWAĆ 15 GRUDNIA):
  // realMonth = 11; realDate = 15; 

  // Blokada działa, jeśli mamy miesiąc przed grudniem LUB jest grudzień, ale dzisiejszy dzień jest mniejszy niż ten z linku.
  // Uwzględniamy też styczeń i kolejne miesiące (realMonth > 11), by po nowym roku wszystko było wciąż odblokowane.
  const isLocked = realMonth < 11 || (realMonth === 11 && realDate < currentDay);
  // -------------------------------

  useEffect(() => {
    const saved = localStorage.getItem(`voucher_day_${currentDay}`);
    if (saved) {
      setVoucher(saved);
      setHasDrawn(true);
    } else {
      setVoucher(null);
      setHasDrawn(false);
    }
  }, [currentDay]);

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
      localStorage.setItem(`voucher_day_${currentDay}`, selectedVoucher);
      
    } catch (error) {
      console.error("Błąd bazy:", error);
      alert("Błąd połączenia z bazą danych.");
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Zabezpieczenie przed adresami typu /dzien/30
  if (isNaN(currentDay) || currentDay < 1 || currentDay > 24) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center text-2xl font-bold">
          Nieprawidłowy dzień! Zeskanuj poprawny kod z kalendarza.
        </div>
      </div>
    );
  }

  // 2. Ekran blokady przed czasem
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-700">
          <h2 className="text-4xl mb-4">🛑</h2>
          <h2 className="text-2xl font-bold text-red-500 mb-4">To jeszcze nie ten dzień!</h2>
          <p className="text-slate-300 text-lg mb-8">
            Ten bon będzie dostępny dopiero <strong>{currentDay} grudnia</strong>. Cierpliwości, nie podglądamy!
          </p>
          <Link 
            to="/" 
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
          >
            Wróć do kalendarza
          </Link>
        </div>
      </div>
    );
  }

  // 3. Właściwy widok bonu (jeśli data się zgadza)
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl text-white font-bold mb-8">Grudzień {currentDay}</h1>
      
      {!hasDrawn ? (
        <button 
          onClick={drawVoucher}
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50"
        >
          {isLoading ? "Odbieranie od Mikołaja..." : "Odkryj dzisiejszy prezent"}
        </button>
      ) : (
        <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full animate-fade-in">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Twój bon na dziś:</h2>
          <p className="text-xl italic font-medium">"{voucher}"</p>
          
          <Link to="/" className="inline-block mt-8 text-sm text-slate-500 hover:text-slate-700 font-bold underline">
            Wróć do kalendarza
          </Link>
        </div>
      )}
    </div>
  );
}