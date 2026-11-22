import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  const { dayId } = useParams(); // Pobiera np. "5" z /dzien/5
  const currentDay = parseInt(dayId, 10);
  
  const [voucher, setVoucher] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Sprawdzamy, czy danego dnia już losowała
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

      // Losowanie jednej z pobranych opcji
      const randomIndex = Math.floor(Math.random() * todayOptions.length);
      const selectedVoucher = todayOptions[randomIndex];

      setVoucher(selectedVoucher);
      setHasDrawn(true);
      
      // Zapisujemy wynik do pamięci przeglądarki
      localStorage.setItem(`voucher_day_${currentDay}`, selectedVoucher);
      
    } catch (error) {
      console.error("Błąd bazy:", error);
      alert("Błąd połączenia z bazą danych. Spróbuj odświeżyć stronę.");
    } finally {
      setIsLoading(false);
    }
  };

  // Zabezpieczenie przed wpisaniem /dzien/30
  if (isNaN(currentDay) || currentDay < 1 || currentDay > 24) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center text-2xl font-bold">
          Nieprawidłowy dzień! Zeskanuj poprawny kod z kalendarza.
        </div>
      </div>
    );
  }

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
        </div>
      )}
    </div>
  );
}