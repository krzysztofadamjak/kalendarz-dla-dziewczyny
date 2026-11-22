import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [day, setDay] = useState('1');
  const [voucher, setVoucher] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Logowanie
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'adminPTR') {
      setIsAuth(true);
    } else {
      alert('Błędne hasło!');
    }
  };

  // Pobieranie danych dla wybranego dnia
  const loadDayData = async (selectedDay) => {
    setIsLoading(true);
    setStatus('');
    try {
      const docRef = doc(db, 'vouchers', selectedDay.toString());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().options) {
        // Jeśli opcji jest kilka, łączymy je enterem (każda linijka to osobna opcja do wylosowania)
        setVoucher(docSnap.data().options.join('\n'));
      } else {
        setVoucher('');
      }
    } catch (error) {
      console.error("Błąd pobierania:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Odpal pobieranie, gdy zmieni się dzień (i jesteś zalogowany)
  useEffect(() => {
    if (isAuth) {
      loadDayData(day);
    }
  }, [isAuth, day]);

  // Zapis do Firebase
  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('Zapisywanie...');
    try {
      // Dzielimy tekst po enterach i usuwamy puste linie, żeby znowu zrobić tablicę
      const optionsArray = voucher.split('\n').filter(v => v.trim() !== '');
      
      await setDoc(doc(db, 'vouchers', day.toString()), {
        options: optionsArray
      });
      
      setStatus('Zapisano pomyślnie!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error("Błąd zapisu:", error);
      setStatus('Błąd podczas zapisywania.');
    }
  };

  // Ekran logowania (jeśli nie jesteś zalogowany)
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl w-full max-w-sm">
          <h2 className="text-white text-2xl mb-6 font-bold text-center">Panel Admina</h2>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Hasło"
            className="w-full p-3 rounded mb-4 bg-slate-700 text-white border border-slate-600 focus:outline-none"
          />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded">
            Zaloguj
          </button>
        </form>
      </div>
    );
  }

  // Ekran edycji (po zalogowaniu)
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto bg-slate-800 p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-red-500">Edytor Bonów</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-slate-300">Wybierz dzień (1-24):</label>
          <select 
            value={day} 
            onChange={(e) => setDay(e.target.value)}
            className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:outline-none"
          >
            {[...Array(24)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Dzień {i + 1}</option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSave}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-300">
              Treść bonu (każda linijka to osobna opcja do wylosowania, jeśli jest jedna - losowania nie będzie):
            </label>
            <textarea 
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              disabled={isLoading}
              rows="4"
              className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:outline-none disabled:opacity-50"
              placeholder="Wpisz treść bonu..."
            ></textarea>
          </div>

          <div className="flex items-center gap-4">
            <button 
              type="submit" 
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded disabled:opacity-50"
            >
              Zapisz w bazie
            </button>
            {status && <span className="text-yellow-400 font-medium">{status}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}