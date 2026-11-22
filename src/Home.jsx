import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 p-8 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Subtelny śnieg w tle (za pomocą emoji i animacji Tailwind) */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 text-white text-2xl flex justify-around items-start">
        <span className="animate-[ping_3s_infinite]">❄️</span>
        <span className="animate-[ping_5s_infinite_1s]">❄️</span>
        <span className="animate-[ping_4s_infinite_0.5s]">❄️</span>
        <span className="animate-[ping_6s_infinite_2s]">❄️</span>
      </div>

      <h1 className="text-5xl md:text-6xl text-amber-400 font-extrabold mb-2 text-center drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] font-serif z-10">
        🎄 Kalendarz 🎄
      </h1>
      <p className="text-red-200 mb-10 text-xl italic text-center z-10 font-serif">
        Magiczny czas tylko dla Starej starego
      </p>
      
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
      
      <div className="mt-12 flex flex-col md:flex-row gap-6 items-center z-10">
        <Link to="/regulamin" className="text-amber-300 hover:text-amber-100 font-bold underline font-serif">
          📜 Przeczytaj Regulamin Kalendarza
        </Link>
        
        <Link to="/admin" className="text-red-300/40 hover:text-red-200 text-sm">
          Panel Starego
        </Link>
      </div>
    </div>
  );
}