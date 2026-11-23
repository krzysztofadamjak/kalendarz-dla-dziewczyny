import { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function Admin() {
  const IMGBB_API_KEY = "TUTAJ_WKLEJ_TWOJ_KLUCZ_Z_API_IMGBB"; 

  const [day, setDay] = useState('1');
  const [optionsText, setOptionsText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  
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
    querySnapshot.forEach((docSnap) => {
      vouchersData[docSnap.id] = docSnap.data();
    });
    setAllVouchers(vouchersData);
  };

  useEffect(() => {
    fetchAllVouchers();
  }, []);

  const handleImageChange = (e) => {
    if (e.target.files[0]) setImageFile(e.target.files[0]);
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
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          finalPhotoUrl = data.data.url; 
          setPhotoUrl(finalPhotoUrl);
        } else throw new Error('Błąd uploadu');
      }

      setStatus('Zapisywanie w bazie...');
      const docRef = doc(db, "vouchers", day);
      await setDoc(docRef, { 
        options: optionsArray,
        photoUrl: finalPhotoUrl.trim(),
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
      setStatus('Błąd zapisu');
    }
  };

  // --- ZARZĄDZANIE PORTFELEM ---
  const handleAdd24h = async (d, currentTime) => {
    if (window.confirm(`Chcesz dodać dodatkowe 24h ważności dla kuponu z dnia ${d}?`)) {
      const newTime = currentTime + (24 * 60 * 60 * 1000);
      await updateDoc(doc(db, "vouchers", d.toString()), { timeScratched: newTime });
      fetchAllVouchers();
    }
  };

  const handleResetVoucher = async (d) => {
    if (window.confirm(`UWAGA: To brutalnie usunie ten bon z jej portfela! Zresetuje jej dzień i pozwoli wylosować bon od nowa. Robimy to?`)) {
      await updateDoc(doc(db, "vouchers", d.toString()), { 
        timeScratched: null, 
        drawnVoucher: null, 
        isCompleted: false, 
        reaction: null 
      });
      fetchAllVouchers();
    }
  };

  const sortedKeys = Object.keys(allVouchers).sort((a, b) => parseInt(a) - parseInt(b));
  const activeVouchers = sortedKeys.filter(d => allVouchers[d].drawnVoucher && allVouchers[d].timeScratched);

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-200 font-sans pb-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* EDYTOR */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h1 className="text-3xl font-bold text-red-500 mb-6">Edytor Dnia {day}</h1>
          <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6 font-bold">
            {[...Array(24)].map((_, i) => (<option key={i + 1} value={i + 1}>Dzień {i + 1}</option>))}
          </select>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-indigo-500/30 mb-6">
            <h3 className="text-indigo-400 font-bold mb-4">🧩 Opcjonalna zagadka dostępu:</h3>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 mb-3" placeholder="Pytanie" />
            <div className="grid grid-cols-1 gap-2 mb-2">
              {['A', 'B', 'C'].map((opt) => (
                <div key={opt} className="flex gap-2 items-center">
                  <input type="radio" checked={correctAns === opt} onChange={() => setCorrectAns(opt)} className="w-5 h-5 accent-indigo-500" />
                  <input type="text" value={eval(`ans${opt}`)} onChange={(e) => eval(`setAns${opt}`)(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" placeholder={`Opcja ${opt}`} />
                </div>
              ))}
            </div>
          </div>

          <label className="block text-sm font-bold mb-2">Treść bonu po odblokowaniu:</label>
          <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} className="w-full h-24 bg-slate-700 border border-slate-600 text-white rounded p-3 mb-6" placeholder="Wpisz treść..." />
          <label className="block text-sm font-bold mb-2 text-emerald-400">Wgraj zdjęcie wspomnienia:</label>
          <div className="bg-slate-700 border border-slate-600 rounded p-3 mb-4">
            <input id="file-upload" type="file" accept="image/*" onChange={handleImageChange} className="text-sm text-white" />
          </div>
          <div className="flex items-center gap-4 mt-6">
            <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded shadow-lg">Zapisz ustawienia</button>
            <span className={`font-bold text-sm ${status.includes('Błąd') ? 'text-red-500' : 'text-amber-400'}`}>{status}</span>
          </div>
          <Link to="/" className="block mt-8 text-sm text-slate-500 underline">Wróć do kalendarza</Link>
        </div>
        
        {/* STATUS PROJEKTU - POPRAWIONY! */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400 mb-6">Status Projektu</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 gap-3">
            {sortedKeys.map((d) => {
              const data = allVouchers[d];
              const hasPhoto = !!data?.photoUrl;
              const hasQuestion = !!data?.question; // Sprawdzamy czy jest ustawiona zagadka

              return (
                <div key={d} className={`p-2 rounded border flex flex-col items-center justify-center text-center ${data?.isCompleted ? 'bg-emerald-900/30 border-emerald-600' : 'bg-slate-700 border-slate-600'}`}>
                  <div className="font-bold text-white text-sm">Dzień {d}</div>
                  
                  {/* Tutaj wracają ikony! */}
                  <div className="flex flex-col gap-0.5 mt-1">
                    {hasPhoto && <span className="text-[10px] text-emerald-400">📸 Foto</span>}
                    {hasQuestion && <span className="text-[10px] text-indigo-400">🕵️‍♂️ Pytanie</span>}
                    {!hasPhoto && !hasQuestion && <span className="text-[10px] text-slate-500 opacity-0">.</span>}
                  </div>

                  <div className="flex gap-1 mt-1 text-xs items-center justify-center min-h-[20px]">
                    {data?.isCompleted && <span>✅</span>}
                    {data?.reaction && <span className="text-sm">{data.reaction}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ZARZĄDZANIE PORTFELEM */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl border border-emerald-700/50 lg:col-span-2">
          <h2 className="text-2xl font-bold text-emerald-400 mb-2 flex items-center gap-3">
            <span>🪪</span> Zarządzanie Jej Portfelem (Zdalne)
          </h2>
          <p className="text-sm text-slate-400 mb-6 italic">Zmiany tutaj zapisują się w chmurze i wpływają od razu na jej telefon.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeVouchers.length === 0 ? (
              <p className="text-slate-500 italic col-span-full">W tej chwili jej portfel jest pusty (albo nie odkryła jeszcze żadnego prezentu).</p>
            ) : (
              activeVouchers.map(d => {
                const data = allVouchers[d];
                const expTime = data.timeScratched + (48 * 60 * 60 * 1000);
                const now = new Date().getTime();
                const isExpired = now > expTime;
                const diff = expTime - now;
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff / 1000 / 60) % 60);

                return (
                  <div key={d} className={`p-5 rounded-xl border relative overflow-hidden ${isExpired ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-900 border-slate-600'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-bold text-amber-400 text-sm tracking-widest uppercase">Dzień {d}</span>
                      {data.isCompleted ? (
                        <span className="text-emerald-400 text-[10px] font-bold bg-emerald-900/50 px-2 py-1 rounded uppercase tracking-wider">Zrealizowano</span>
                      ) : isExpired ? (
                        <span className="text-red-400 text-[10px] font-bold bg-red-900/50 px-2 py-1 rounded uppercase tracking-wider">Wygasł</span>
                      ) : (
                        <span className="text-emerald-300 text-[10px] font-bold bg-emerald-900/30 px-2 py-1 rounded tracking-wider">{h}h {m}m</span>
                      )}
                    </div>
                    
                    <p className="text-white italic text-sm mb-6 pb-4 border-b border-white/10">"{data.drawnVoucher}"</p>
                    
                    <div className="flex gap-2">
                      <button onClick={() => handleAdd24h(d, data.timeScratched)} className="flex-1 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-1 rounded transition-colors border border-emerald-500 whitespace-nowrap">
                        ⏳ +24h
                      </button>
                      <button onClick={() => handleResetVoucher(d)} className="flex-1 bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold py-2 px-1 rounded transition-colors border border-red-500 whitespace-nowrap">
                        🗑️ Reset
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}