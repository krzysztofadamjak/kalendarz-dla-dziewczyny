import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function Admin() {
  const [day, setDay] = useState('1');
  const [optionsText, setOptionsText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [status, setStatus] = useState('');
  const [allVouchers, setAllVouchers] = useState({});

  // Pobieranie danych dla wybranego dnia w edytorze
  useEffect(() => {
    const fetchDay = async () => {
      const docRef = doc(db, "vouchers", day);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOptionsText(data.options ? data.options.join('\n') : '');
        setPhotoUrl(data.photoUrl || '');
      } else {
        setOptionsText('');
        setPhotoUrl('');
      }
    };
    fetchDay();
  }, [day]);

  // Pobieranie statusów dla wszystkich 24 dni (Panel Dowodzenia)
  const fetchAllVouchers = async () => {
    const querySnapshot = await getDocs(collection(db, "vouchers"));
    const vouchersData = {};
    querySnapshot.forEach((doc) => {
      vouchersData[doc.id] = doc.data();
    });
    setAllVouchers(vouchersData);
  };

  useEffect(() => {
    fetchAllVouchers();
  }, []);

  const handleSave = async () => {
    setStatus('Zapisywanie...');
    try {
      const optionsArray = optionsText.split('\n').filter(line => line.trim() !== '');
      const docRef = doc(db, "vouchers", day);
      
      // Używamy merge: true, aby nie nadpisać reakcji i statusu zrealizowania!
      await setDoc(docRef, { 
        options: optionsArray,
        photoUrl: photoUrl.trim()
      }, { merge: true });
      
      setStatus('Zapisano pomyślnie!');
      fetchAllVouchers(); // Odśwież panel dowodzenia
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error(error);
      setStatus('Błąd podczas zapisywania.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-200 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEWA STRONA - EDYTOR */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h1 className="text-3xl font-bold text-red-500 mb-6">Edytor Bonów i Wspomnień</h1>
          
          <label className="block text-sm font-bold mb-2">Wybierz dzień (1-24):</label>
          <select 
            value={day} 
            onChange={(e) => setDay(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6"
          >
            {[...Array(24)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Dzień {i + 1}</option>
            ))}
          </select>

          <label className="block text-sm font-bold mb-2">Treść bonu (każda linijka to opcja do losowania):</label>
          <textarea 
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            className="w-full h-40 bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6"
            placeholder="Wpisz treść bonu..."
          />

          <label className="block text-sm font-bold mb-2">
            Link do zdjęcia (URL, np. z imgur.com / postimages.org):
          </label>
          <input 
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6"
            placeholder="https://..."
          />

          <div className="flex items-center gap-4">
            <button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded transition-colors"
            >
              Zapisz w bazie
            </button>
            <span className={`font-bold ${status.includes('Błąd') ? 'text-red-500' : 'text-amber-400'}`}>
              {status}
            </span>
          </div>
          
          <Link to="/" className="block mt-8 text-sm text-slate-500 hover:text-slate-300 underline">
            Wróć do kalendarza
          </Link>
        </div>

        {/* PRAWA STRONA - DASHBOARD */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400 mb-6">Status Realizacji (Co wiszę?)</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(24)].map((_, i) => {
              const d = i + 1;
              const data = allVouchers[d];
              const isCompleted = data?.isCompleted;
              const reaction = data?.reaction;
              const hasPhoto = !!data?.photoUrl;

              return (
                <div 
                  key={d} 
                  className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all ${
                    isCompleted 
                    ? 'bg-emerald-900/30 border-emerald-600' 
                    : 'bg-slate-700 border-slate-600'
                  }`}
                >
                  <div className="font-bold text-lg mb-1 text-white">Dzień {d}</div>
                  <div className="text-xs text-slate-400 mb-2">{hasPhoto ? '📸 Dodano foto' : '❌ Brak foto'}</div>
                  
                  <div className="flex gap-2">
                    {isCompleted && <span title="Zrealizowano" className="text-xl">✅</span>}
                    {reaction && <span title="Jej reakcja" className="text-xl">{reaction}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}