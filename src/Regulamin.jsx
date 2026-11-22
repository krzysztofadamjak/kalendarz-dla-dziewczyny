import { Link } from 'react-router-dom';

export default function Regulamin() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-950 to-emerald-950 p-4 md:p-8 flex flex-col items-center relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.1)_0%,_transparent_70%)] pointer-events-none"></div>

      <h1 className="text-4xl md:text-5xl text-amber-400 font-extrabold mb-8 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] font-serif z-10 text-center mt-6">
        📜 Regulamin Kalendarza 📜
      </h1>

      <div className="bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] bg-amber-50 text-red-950 p-8 md:p-12 rounded-xl shadow-[0_0_40px_rgba(251,191,36,0.2)] max-w-3xl w-full border-4 border-double border-red-900 z-10 relative">
        
        <div className="absolute top-4 left-4 text-3xl opacity-20">⚖️</div>
        <div className="absolute bottom-4 right-4 text-3xl opacity-20">❄️</div>

        <ol className="list-decimal list-outside ml-6 space-y-6 text-lg font-serif leading-relaxed">
          <li>
            <strong className="text-emerald-900">Termin ważności:</strong> Bony zachowują ważność i mogą zostać zrealizowane najpóźniej do <strong>31 stycznia 2027 roku</strong> włącznie. Po tym terminie magia wygasa.
          </li>
          <li>
            <strong className="text-emerald-900">Limit użycia:</strong> Każdy wylosowany bon jest jednorazowy. Po użyciu uznaje się go za zrealizowany.
          </li>
          <li>
            <strong className="text-emerald-900">Prawa własności:</strong> Bony są ściśle imienne i dedykowane. Zabrania się przekazywania ich osobom trzecim, odsprzedaży na Vinted czy wymiany na gotówkę.
          </li>
          <li>
            <strong className="text-emerald-900">Czas operacyjny:</strong> Chęć realizacji bonu wymagającego przygotowania (np. wyjście, gotowanie, wyjazd) należy zgłosić z odpowiednim wyprzedzeniem, aby Wykonawca mógł się przygotować logistycznie.
          </li>
          <li>
            <strong className="text-emerald-900">Siła wyższa:</strong> W przypadku zdarzeń losowych (np. choroba, zła pogoda, zamknięty ulubiony lokal), realizacja bonu zostaje przeniesiona na najbliższy dogodny termin bez utraty jego ważności.
          </li>
          <li>
            <strong className="text-emerald-900">Klauzula uśmiechu:</strong> Podczas realizacji bonów obowiązuje całkowity zakaz marudzenia (z wyjątkiem dni, w których bon wyraźnie na to pozwala!).
          </li>
        </ol>

        <div className="mt-12 text-center border-t-2 border-red-900/20 pt-6">
          <p className="italic text-emerald-800 font-bold">Podpisano: Mikołaj (Twój Stary) 🎅</p>
        </div>
      </div>

      <Link to="/" className="mt-10 bg-gradient-to-r from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 text-amber-300 font-bold py-3 px-8 rounded-full shadow-lg border border-emerald-500 transition-transform hover:scale-105 z-10">
        Zrozumiałam, wracam do kalendarza
      </Link>

    </div>
  );
}