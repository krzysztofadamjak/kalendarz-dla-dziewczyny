import { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function Admin() {
  const IMGBB_API_KEY = "TUTAJ_WKLEJ_TWOJ_KLUCZ_Z_API_IMGBB"; // Twój klucz

  const [day, setDay] = useState('1');
  const [optionsText, setOptionsText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  
  // NOWE STANY DLA ZAGADKI
  const [question, setQuestion] = useState('');
  const [ansA, setAnsA] = useState('');
  const [ansB, setAnsB] = useState('');
  const [ansC, setAnsC] = useState('');
  const [correctAns, setCorrectAns] = useState('A');
  
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
        setQuestion(data.question || '');
        setAnsA(data.ansA || '');
        setAnsB(data.ansB || '');
        setAnsC(data.ansC || '');
        setCorrectAns(data.correctAns || 'A');
      } else {
        setOptionsText('');
        setPhotoUrl('');
        setQuestion('');
        setAnsA('');
        setAnsB('');
        setAnsC('');
        setCorrectAns('A');
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
          finalPhotoUrl = data.data.url; 
          setPhotoUrl(finalPhotoUrl);
        } else {
          throw new Error('Nie udało się wgrać zdjęcia na ImgBB.');
        }
      }

      setStatus('Zapisywanie w bazie...');
      const docRef = doc(db, "vouchers", day);
      await setDoc(docRef, { 
        options: optionsArray,
        photoUrl: finalPhotoUrl.trim(),
        // Zapisujemy zagadkę
        question: question.trim(),
        ansA: ansA.trim(),
        ansB: ansB.trim(),
        ansC: ansC.trim(),
        correctAns: correctAns
      }, { merge: true });
      
      setStatus('Zapisano pomyślnie!');
      setImageFile(null); 
      const fileInput = document.getElementById('file-upload');
      if (fileInput) fileInput.value = "";
      
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
        
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h1 className="text-3xl font-bold text-red-500 mb-6">Edytor Dnia {day}</h1>
          
          <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6 font-bold">
            {[...Array(24)].map((_, i) => (<option key={i + 1} value={i + 1}>Dzień {i + 1}</option>))}
          </select>

          {/* SEKACJA ZAGADKI */}
          <div className="bg-slate-900/50 p-4 rounded-lg border border-indigo-500/30 mb-6">
            <h3 className="text-indigo-400 font-bold mb-4">🧩 Opcjonalna zagadka dostępu:</h3>
            
            <label className="block text-xs mb-1">Pytanie (zostaw puste, jeśli brak zagadki):</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 mb-3" placeholder="np. Gdzie zjedliśmy pierwszą pizzę?" />
            
            <div className="grid grid-cols-1 gap-2 mb-3">
              <div className="flex gap-2 items-center">
                <input type="radio" name="correct" checked={correctAns === 'A'} onChange={() => setCorrectAns('A')} className="w-5 h-5 accent-indigo-500" />
                <input type="text" value={ansA} onChange={(e) => setAnsA(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 text-sm" placeholder="Opcja A" />
              </div>
              <div className="flex gap-2 items-center">
                <input type="radio" name="correct" checked={correctAns === 'B'} onChange={() => setCorrectAns('B')} className="w-5 h-5 accent-indigo-500" />
                <input type="text" value={ansB} onChange={(e) => setAnsB(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 text-sm" placeholder="Opcja B" />
              </div>
              <div className="flex gap-2 items-center">
                <input type="radio" name="correct" checked={correctAns === 'C'} onChange={() => setCorrectAns('C')} className="w-5 h-5 accent-indigo-500" />
                <input type="text" value={ansC} onChange={(e) => setAnsC(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 text-sm" placeholder="Opcja C" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Zaznacz kółko przy poprawnej odpowiedzi.</p>
          </div>

          <label className="block text-sm font-bold mb-2">Treść bonu po odblokowaniu:</label>
          <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} className="w-full h-24 bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6" placeholder="Wpisz treść bonu..." />

          <label className="block text-sm font-bold mb-2 text-emerald-400">Wgraj zdjęcie wspomnienia:</label>
          <div className="bg-slate-700 border border-slate-600 rounded p-3 mb-4">
            <input id="file-upload" type="file" accept="image/*" onChange={handleImageChange} className="text-sm text-white" />
          </div>

          <div className="flex items-center gap-4 mt-6">
            <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded shadow-lg">Zapisz ustawienia dnia</button>
            <span className={`font-bold text-sm ${status.includes('Błąd') ? 'text-red-500' : 'text-amber-400'} animate-pulse`}>{status}</span>
          </div>
          <Link to="/" className="block mt-8 text-sm text-slate-500 underline">Wróć do kalendarza</Link>
        </div>

        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400 mb-6">Status Realizacji</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(24)].map((_, i) => {
              const d = i + 1;
              const data = allVouchers[d];
              return (
                <div key={d} className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all ${data?.isCompleted ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700 border-slate-600'}`}>
                  <div className="font-bold text-lg mb-1 text-white">Dzień {d}</div>
                  <div className="text-xs text-slate-400">{data?.photoUrl ? '📸 Foto ok' : ''}</div>
                  <div className="text-xs text-indigo-400 mb-2">{data?.question ? '🧩 Zagadka ok' : ''}</div>
                  <div className="flex gap-2">
                    {data?.isCompleted && <span>✅</span>}
                    {data?.reaction && <span>{data.reaction}</span>}
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