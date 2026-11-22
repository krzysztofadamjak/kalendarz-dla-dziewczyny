import { Link } from 'react-router-dom';

export default function Test() {
  
  // Funkcja czyszcząca pamięć testowych losowań
  const resetTestEnvironment = () => {
    if (window.confirm("Czy na pewno chcesz wyzerować wszystkie wylosowane bony w trybie testowym?")) {
      for (let i = 1; i <= 24; i++) {
        localStorage.removeItem(`test_voucher_day_${i}`);
      }
      alert("Środowisko testowe zostało pomyślnie wyzerowane! Możesz testować od nowa.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 p-8 flex flex-col items-center justify-center relative overflow-hidden">
      
      <div className="bg-red-600 text-white px-6 py-2 rounded-full font-bold mb-6 shadow-[0_0_20px_rgba(220,38,38,0.8)] z-10">
        🛠️ TRYB TESTOWY (Blokada wyłączona)
      </div>

      <h1 className="text-5xl md:text-6xl text-amber-400 font-extrabold mb-2 text-center drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] font-serif z-10">
        🎄 Kalendarz 🎄
      </h1>
      <p className="text-red-200 mb-6 text-xl italic text-center z-10 font-serif">Wersja do testów</p>
      
      {/* Przycisk resetu */}
      <button 
        onClick={resetTestEnvironment}
        className="mb-10 z-10 bg-red-900/80 hover:bg-red-700 text-amber-200 font-bold py-2 px-6 rounded-full border border-red-500 transition-colors shadow-lg flex items-center gap-2 backdrop-blur-sm"
      >
        🔄 Wyzeruj wylosowane bony
      </button>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-4xl w-full z-10">
        {[...Array(24)].map((_, i) => (
          <Link 
            key={i + 1} 
            to={`/test/${i + 1}`}
            className="group relative bg-gradient-to-br from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 text-amber-300 font-bold aspect-square rounded-xl shadow-[0_0_15px_rgba(4,120,87,0.5)] flex items-center justify-center text-4xl transition-all transform hover:scale-110 hover:-translate-y-2 border-2 border-emerald-500 hover:border-amber-400 font-serif"
          >
            {i + 1}
          </Link>
        ))}
      </div>
      
      <Link to="/" className="mt-12 text-amber-300/80 hover:text-amber-100 text-sm z-10 underline">
        Wróć do normalnego kalendarza
      </Link>
    </div>
  );
}