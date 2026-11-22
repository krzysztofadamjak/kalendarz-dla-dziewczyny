import { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function Admin() {
  // 🔴 TUTAJ WKLEJ SWÓJ KLUCZ API Z IMGBB:
  const IMGBB_API_KEY = "ee8db817e56d88ed6b9d38d5bb38515a";

  const [day, setDay] = useState('1');
  const [optionsText, setOptionsText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  
  const [status, setStatus] = useState('');
  const [allVouchers, setAllVouchers] = useState({});

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
      setImageFile(null);
    };
    fetchDay();
  }, [day]);

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

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    setStatus('Zapisywanie...');
    try {
      const optionsArray = optionsText.split('\n').filter(line => line.trim() !== '');
      let finalPhotoUrl = photoUrl; 

      // Wysyłanie zdjęcia na darmowy serwer ImgBB
      if (imageFile) {
        setStatus('Wgrywanie zdjęcia na ImgBB...');
        const formData = new FormData();
        formData.append('image', imageFile);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.success) {
          finalPhotoUrl = data.data.url; // Pobieramy bezpośredni link do wgranego zdjęcia
          setPhotoUrl(finalPhotoUrl);
        } else {
          throw new Error('Nie udało się wgrać zdjęcia na ImgBB.');
        }
      }

      setStatus('Zapisywanie bonu w bazie...');
      const docRef = doc(db, "vouchers", day);
      await setDoc(docRef, { 
        options: optionsArray,
        photoUrl: finalPhotoUrl.trim()
      }, { merge: true });
      
      setStatus('Zapisano pomyślnie!');
      setImageFile(null); 
      document.getElementById('file-upload').value = "";
      
      fetchAllVouchers();
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
          <h1 className="text-3xl font-bold text-red-500 mb-6">Edytor Bonów i Zdjęć</h1>
          
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

          <label className="block text-sm font-bold mb-2">Treść bonu (każda linijka to opcja):</label>
          <textarea 
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            className="w-full h-32 bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6"
            placeholder="Wpisz treść bonu..."
          />

          <label className="block text-sm font-bold mb-2 text-emerald-400">
            Wgraj z dysku (ImgBB):
          </label>
          <div className="bg-slate-700 border border-slate-600 rounded p-3 mb-4 flex flex-col gap-2">
            <input 
              id="file-upload"
              type="file" 
              accept="image/*"
              onChange={handleImageChange}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
            />
          </div>

          <label className="block text-xs text-slate-400 mb-1">Link do wgranego zdjęcia:</label>
          <input 
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-slate-400 text-sm rounded p-2 mb-6 opacity-70"
            placeholder="Pojawi się tu automatycznie lub wklej ręcznie..."
          />

          <div className="flex items-center gap-4">
            <button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded transition-colors shadow-lg"
            >
              Zapisz
            </button>
            <span className={`font-bold text-sm ${status.includes('Błąd') ? 'text-red-500' : 'text-amber-400'} animate-pulse`}>
              {status}
            </span>
          </div>
          
          <Link to="/" className="block mt-8 text-sm text-slate-500 hover:text-slate-300 underline">
            Wróć do kalendarza
          </Link>
        </div>

        {/* PRAWA STRONA - DASHBOARD */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400 mb-6">Status Realizacji</h2>
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
                    isCompleted ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700 border-slate-600'
                  }`}
                >
                  <div className="font-bold text-lg mb-1 text-white">Dzień {d}</div>
                  <div className="text-xs text-slate-400 mb-2">{hasPhoto ? '📸 Foto ok' : '❌ Brak foto'}</div>
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