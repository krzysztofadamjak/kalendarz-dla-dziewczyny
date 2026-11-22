import { Link } from 'react-router-dom';

export default function Test() {
  return (
    <div className="min-h-screen bg-slate-900 p-8 flex flex-col items-center justify-center">
      <div className="bg-red-600 text-white px-4 py-1 rounded-full font-bold mb-4 animate-pulse">
        TRYB TESTOWY (Blokada daty wyłączona)
      </div>
      <h1 className="text-4xl text-white font-bold mb-10 text-center">Kalendarz - Test</h1>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-4xl w-full">
        {[...Array(24)].map((_, i) => (
          <Link 
            key={i + 1} 
            to={`/test/${i + 1}`}
            className="bg-slate-800 hover:bg-red-600 text-white font-bold aspect-square rounded-xl shadow-lg flex items-center justify-center text-3xl transition-all transform hover:scale-105 border border-slate-700 hover:border-red-500"
          >
            {i + 1}
          </Link>
        ))}
      </div>
      
      <Link to="/" className="mt-12 text-slate-500 hover:text-slate-300 text-sm">
        Wróć do normalnego kalendarza
      </Link>
    </div>
  );
}