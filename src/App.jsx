import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import ScratchCard from 'react-scratchcard-v2'; 
import Snowfall from 'react-snowfall';

// WŁASNY HOOK: Maszyna do pisania
const useTypewriter = (text, speed = 40, startTyping = false) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    if (!startTyping || !text) return;
    
    let i = 0;
    setDisplayedText('');
    const typingAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3');
    typingAudio.volume = 0.1;
    typingAudio.loop = true;
    typingAudio.play().catch(() => {});

    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i === text.length) {
        clearInterval(interval);
        typingAudio.pause();
      }
    }, speed);
    
    return () => {
      clearInterval(interval);
      typingAudio.pause();
    };
  }, [text, speed, startTyping]);
  
  return displayedText;
};

export default function App() {
  const { dayId } = useParams();
  const currentDay = parseInt(dayId, 10);
  const location = useLocation();
  const isTestMode = location.pathname.startsWith('/test');
  
  const { width, height } = useWindowSize();
  
  const [voucher, setVoucher] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // ZAGADKA I GRINCH
  const [trivia, setTrivia] = useState(null);
  const [triviaError, setTriviaError] = useState(false);
  const [startTyping, setStartTyping] = useState(false);
  
  // STAN KARY (COOLDOWN)
  const [grinchTimeLeft, setGrinchTimeLeft] = useState(0);
  
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isScratched, setIsScratched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  
  const captureRef = useRef(null);
  const today = new Date();
  let realMonth = today.getMonth(); 
  let realDate = today.getDate();

  const isLocked = !isTestMode && (realMonth < 11 || (realMonth === 11 && realDate < currentDay));

  const typedQuestion = useTypewriter(trivia?.q || '', 45, startTyping);

  // Sprawdzanie pamięci pod kątem trwającej kary Grincha po załadowaniu
  useEffect(() => {
    const penaltyEndTime = localStorage.getItem(`grinch_penalty_day_${currentDay}`);
    if (penaltyEndTime) {
      const now = new Date().getTime();
      const diff = parseInt(penaltyEndTime, 10) - now;
      if (diff > 0) {
        setGrinchTimeLeft(Math.ceil(diff / 1000));
      } else {
        localStorage.removeItem(`grinch_penalty_day_${currentDay}`);
      }
    }
  }, [currentDay]);

  // Logika odliczania kary Grincha
  useEffect(() => {
    let timer;
    if (grinchTimeLeft > 0) {
      timer = setInterval(() => {
        setGrinchTimeLeft(prev => {
          if (prev <= 1) {
            localStorage.removeItem(`grinch_penalty_day_${currentDay}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [grinchTimeLeft, currentDay]);

  useEffect(() => {
    const fetchVoucherData = async () => {
      try {
        const docRef = doc(db, "vouchers", currentDay.toString());
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPhotoUrl(data.photoUrl || null);
          setReaction(data.reaction || null);
          setIsCompleted(data.isCompleted || false);
          
          if (data.question && data.ansA && data.ansB && data.ansC) {
            setTrivia({ q: data.question, A: data.ansA, B: data.ansB, C: data.ansC, correct: data.correctAns || 'A' });
          }

          // JEŚLI JESTEŚMY NA PROD I DANE SĄ W CHMURZE:
          if (!isTestMode) {
            if (data.drawnVoucher) {
              setVoucher(data.drawnVoucher);
              setHasDrawn(true);
              setIsScratched(true);
              return; // Mamy wszystko z chmury, ignorujemy localStorage!
            } else {
              // Jeśli w panelu Admina usunięto kupon (zresetowano)
              localStorage.removeItem(`voucher_day_${currentDay}`);
              localStorage.removeItem(`time_scratched_voucher_day_${currentDay}`);
              localStorage.removeItem(`completed_voucher_day_${currentDay}`);
            }
          }
        }
      } catch (e) {
        console.log("Błąd pobierania danych", e);
      }

      // Fallback dla trybu Test lub braku danych
      const storageKey = isTestMode ? `test_voucher_day_${currentDay}` : `voucher_day_${currentDay}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setVoucher(saved);
        setHasDrawn(true);
        setIsScratched(true); 
      } else {
        setVoucher(null);
        setHasDrawn(false);
        setIsScratched(false);
        setStartTyping(true); 
      }
    };
    fetchVoucherData();
  }, [currentDay, isTestMode]);

  const playMagicSound = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_24e20f1883.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const playGrinchSound = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }

  const handleTriviaAnswer = (selected) => {
    if (grinchTimeLeft > 0) return; // Zabezpieczenie przed klikaniem w trakcie kary

    if (selected === trivia.correct) {
      drawVoucher();
    } else {
      // KARA GRINCHA (ZŁA ODPOWIEDŹ)
      playGrinchSound();
      setTriviaError(true);
      
      const penaltyDurationSeconds = 60; // 1 MINUTA KARY
      setGrinchTimeLeft(penaltyDurationSeconds);
      
      const endTime = new Date().getTime() + (penaltyDurationSeconds * 1000);
      localStorage.setItem(`grinch_penalty_day_${currentDay}`, endTime.toString());
      
      setTimeout(() => setTriviaError(false), 3000); 
    }
  };

  const drawVoucher = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "vouchers", currentDay.toString());
      const docSnap = await getDoc(docRef);
      let todayOptions = ["Brak bonu w bazie! 🎅"];
      if (docSnap.exists() && docSnap.data().options?.length > 0) {
        todayOptions = docSnap.data().options;
      }
      const selectedVoucher = todayOptions[Math.floor(Math.random() * todayOptions.length)];
      setVoucher(selectedVoucher);
      setHasDrawn(true);
      setIsScratched(false); 
      const storageKey = isTestMode ? `test_voucher_day_${currentDay}` : `voucher_day_${currentDay}`;
      localStorage.setItem(storageKey, selectedVoucher);
    } catch (error) {
      alert("Błąd połączenia z bazą danych.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScratchComplete = async () => {
    setIsScratched(true);
    playMagicSound();
    setShowConfetti(true);
    
    const now = new Date().getTime();
    const timeStorageKey = isTestMode ? `time_scratched_test_voucher_day_${currentDay}` : `time_scratched_voucher_day_${currentDay}`;
    
    if (!localStorage.getItem(timeStorageKey)) {
      localStorage.setItem(timeStorageKey, now.toString());
      
      // ZAPIS LOKALIZACJI ZDRAPKI DO CHMURY W TRYBIE PROD
      if (!isTestMode) {
        try {
          await updateDoc(doc(db, "vouchers", currentDay.toString()), {
            timeScratched: now,
            drawnVoucher: voucher
          });
        } catch (e) {
          console.log("Nie udało się zapisać do chmury", e);
        }
      }
    }

    setTimeout(() => setShowConfetti(false), 5000);
  };

  const handleReaction = async (emoji) => {
    if (isTestMode) return; 
    try {
      const docRef = doc(db, "vouchers", currentDay.toString());
      await updateDoc(docRef, { reaction: emoji });
      setReaction(emoji);
    } catch (e) {}
  };

  const handleComplete = async () => {
    if (isTestMode) {
      localStorage.setItem(`completed_test_voucher_day_${currentDay}`, 'true');
      setIsCompleted(true);
      playMagicSound();
      return;
    }
    
    try {
      const docRef = doc(db, "vouchers", currentDay.toString());
      await updateDoc(docRef, { isCompleted: true });
      setIsCompleted(true);
      
      localStorage.setItem(`completed_voucher_day_${currentDay}`, 'true');
      playMagicSound();
    } catch (e) {}
  };

  const shareAsImage = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#1a0505', scale: 2, useCORS: true });
      setGeneratedImage(canvas.toDataURL("image/png"));
    } catch (error) {}
  };

  if (isNaN(currentDay) || currentDay < 1 || currentDay > 24) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-amber-400 text-2xl font-bold">Nieprawidłowy dzień! 🎁</div></div>;
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900 via-red-950 to-emerald-950 flex items-center justify-center p-4">
        <Snowfall color="#fde047" snowflakeCount={50} style={{ opacity: 0.3 }} />
        <div className="bg-black/40 backdrop-blur-2xl p-10 rounded-3xl text-center max-w-md w-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-10">
          <h2 className="text-6xl mb-6 animate-bounce">🎁</h2>
          <h2 className="text-3xl font-bold text-amber-400 mb-4 font-serif">Jeszcze nie czas!</h2>
          <p className="text-amber-100/70 text-lg mb-8 italic">Ten prezent otworzy się dopiero <strong>{currentDay} grudnia</strong>.</p>
          <Link to="/" className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full border border-white/20 transition-all">Wróć do kalendarza</Link>
        </div>
      </div>
    );
  }

  // ZMIANA TŁA I ŚNIEGU JEŚLI JEST KARA GRINCHA
  const isGrinchMode = grinchTimeLeft > 0;
  const bgGradient = isGrinchMode 
    ? "from-slate-900 via-slate-950 to-black" 
    : "from-red-900 via-red-950 to-emerald-950"; 

  return (
    <>
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={600} gravity={0.15} colors={['#fde047', '#10b981', '#ef4444', '#ffffff']} />}

      <div className={`min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${bgGradient} flex flex-col items-center justify-center p-4 relative overflow-hidden pb-20 font-sans transition-colors duration-1000`}>
        
        <Snowfall 
          color={isGrinchMode ? "#475569" : "#ffffff"} 
          snowflakeCount={isGrinchMode ? 150 : 80} 
          style={{ opacity: isGrinchMode ? 0.8 : 0.4, zIndex: 0 }} 
        />

        <div ref={captureRef} className="flex flex-col items-center w-full z-10 pt-8 pb-4 px-4 rounded-3xl">
          {isTestMode && <div className="bg-red-500/20 text-red-300 border border-red-500/50 px-4 py-1 rounded-full font-bold mb-4 text-xs tracking-widest backdrop-blur-sm">TRYB TESTOWY</div>}
          
          <h1 className={`text-5xl md:text-7xl font-extrabold mb-10 font-serif drop-shadow-[0_5px_15px_rgba(251,191,36,0.2)] ${isGrinchMode ? 'text-slate-500' : 'text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500'}`}>
            Grudzień {currentDay}
          </h1>
          
          {!hasDrawn ? (
            trivia ? (
              <div className={`backdrop-blur-xl border p-8 rounded-3xl max-w-md w-full text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden transition-colors duration-1000 ${isGrinchMode ? 'bg-black/80 border-slate-700' : 'bg-black/40 border-white/10'}`}>
                
                {isGrinchMode ? (
                  <div className="flex flex-col items-center justify-center py-6 animate-fade-in">
                    <span className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]">🧌</span>
                    <h2 className="text-emerald-500 font-bold uppercase tracking-widest text-lg mb-2">
                      Tryb Grincha!
                    </h2>
                    <p className="text-slate-300 font-serif italic mb-8">
                      Mikołaj widzi, że nie uważałaś! <br/>Za karę musisz odczekać.
                    </p>
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full">
                      <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Blokada systemu</p>
                      <p className="text-5xl font-mono text-emerald-500 animate-pulse font-bold">{grinchTimeLeft}s</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50"></div>
                    <h2 className="text-amber-400/80 font-bold uppercase tracking-widest text-xs mb-6 flex items-center justify-center gap-2">
                      <span>🕵️</span> Mikołaj pyta
                    </h2>
                    <div className="min-h-[80px] flex items-center justify-center mb-8">
                      <p className="text-xl text-white font-serif italic leading-relaxed">
                        "{typedQuestion}"
                        <span className="animate-pulse ml-1 text-amber-400">|</span>
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <button onClick={() => handleTriviaAnswer('A')} className="group relative bg-white/5 hover:bg-white/10 text-amber-50 font-medium py-4 px-6 rounded-2xl border border-white/10 transition-all text-left flex items-center overflow-hidden">
                        <span className="bg-white/10 px-3 py-1 rounded-lg mr-4 font-bold text-amber-400">A</span>{trivia.A}
                      </button>
                      <button onClick={() => handleTriviaAnswer('B')} className="group relative bg-white/5 hover:bg-white/10 text-amber-50 font-medium py-4 px-6 rounded-2xl border border-white/10 transition-all text-left flex items-center overflow-hidden">
                        <span className="bg-white/10 px-3 py-1 rounded-lg mr-4 font-bold text-amber-400">B</span>{trivia.B}
                      </button>
                      <button onClick={() => handleTriviaAnswer('C')} className="group relative bg-white/5 hover:bg-white/10 text-amber-50 font-medium py-4 px-6 rounded-2xl border border-white/10 transition-all text-left flex items-center overflow-hidden">
                        <span className="bg-white/10 px-3 py-1 rounded-lg mr-4 font-bold text-amber-400">C</span>{trivia.C}
                      </button>
                    </div>

                    {triviaError && (
                      <p className="text-red-400 font-bold mt-6 animate-pulse bg-red-900/30 py-2 rounded-lg border border-red-500/30">
                        ❌ Błędna odpowiedź! Uruchamiam procedurę kary...
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <button onClick={drawVoucher} disabled={isLoading} className="bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold py-5 px-12 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 hover:-translate-y-1 font-serif text-xl border border-emerald-400/50 flex items-center gap-3">
                {isLoading ? "Rozwiązywanie wstążki..." : <>Odkryj prezent <span className="text-2xl">🎀</span></>}
              </button>
            )
          ) : (
            <div className="flex flex-col items-center w-full max-w-md">
              {photoUrl && (
                <div className="bg-white p-3 pb-8 rounded-sm shadow-2xl transform -rotate-1 hover:rotate-1 transition-transform duration-500 mb-8 w-auto max-w-full mx-auto relative group">
                  <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] pointer-events-none"></div>
                  <img src={photoUrl} alt="Wspomnienie" className="w-auto h-auto max-w-full max-h-[45vh] border border-slate-100 object-cover" crossOrigin="anonymous" />
                  <p className="text-center text-slate-800 font-serif mt-5 text-xl italic opacity-80 group-hover:opacity-100 transition-opacity">Nasze wspomnienie</p>
                </div>
              )}

              {!isScratched ? (
                <div className="w-full flex flex-col items-center animate-fade-in mb-6">
                  <p className="text-amber-300 font-serif mb-5 animate-pulse font-bold text-lg text-center flex items-center gap-2">
                    <span>✨</span> Zdrap złotą folię palcem! <span>✨</span>
                  </p>
                  <div className="rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(251,191,36,0.3)] border-4 border-amber-500/80 bg-amber-50 transform hover:scale-[1.02] transition-transform duration-300 cursor-pointer">
                    <ScratchCard width={320} height={200} image="https://images.unsplash.com/photo-1618424181497-157f25b64623?q=80&w=400&auto=format&fit=crop" finishPercent={60} onComplete={handleScratchComplete}>
                      <div className="bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] text-red-950 p-6 flex flex-col justify-center items-center text-center w-[320px] h-[200px] relative">
                        <h2 className="text-sm font-bold mb-3 text-emerald-800 font-serif uppercase tracking-widest border-b border-emerald-800/20 pb-2">Świąteczny bon</h2>
                        <p className="text-xl italic font-medium font-serif leading-snug text-red-950 px-2 drop-shadow-sm">"{voucher}"</p>
                      </div>
                    </ScratchCard>
                  </div>
                </div>
              ) : (
                <div className="bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] bg-amber-50 text-red-950 p-10 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.4)] text-center w-full relative mb-6 animate-fade-in border-4 border-double border-emerald-900/30">
                  <h2 className="text-sm font-bold mb-5 text-emerald-800 font-serif uppercase tracking-widest border-b-2 border-emerald-800/20 pb-3 flex justify-center items-center gap-3">
                    <span>🎄</span> Twój prezent <span>🎄</span>
                  </h2>
                  <p className="text-3xl italic font-medium font-serif leading-relaxed text-red-950 drop-shadow-sm">"{voucher}"</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {hasDrawn && isScratched && (
          <div className="flex flex-col items-center gap-5 z-10 mt-2 w-full max-w-md animate-fade-in">
            <div className="bg-black/30 p-5 rounded-3xl border border-white/10 w-full text-center backdrop-blur-md shadow-xl">
              {!reaction ? (
                <>
                  <p className="text-amber-100/80 mb-4 font-serif text-sm">Zostaw reakcję dla Mikołaja:</p>
                  <div className="flex justify-center gap-6 text-4xl">
                    <button onClick={() => handleReaction('😍')} className="hover:scale-125 hover:-translate-y-2 transition-all filter drop-shadow-lg">😍</button>
                    <button onClick={() => handleReaction('😂')} className="hover:scale-125 hover:-translate-y-2 transition-all filter drop-shadow-lg">😂</button>
                    <button onClick={() => handleReaction('🥺')} className="hover:scale-125 hover:-translate-y-2 transition-all filter drop-shadow-lg">🥺</button>
                  </div>
                </>
              ) : (
                <p className="text-amber-200 font-serif text-lg flex items-center justify-center gap-3">
                  Wysłano: <span className="text-3xl animate-bounce">{reaction}</span>
                </p>
              )}
            </div>
            {!isCompleted ? (
              <button onClick={handleComplete} className="w-full bg-emerald-600/80 hover:bg-emerald-500 backdrop-blur-md text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] border border-emerald-400/50 text-lg flex items-center justify-center gap-3 group">
                <span className="text-2xl group-hover:scale-125 transition-transform">🎯</span> Oznacz jako ZREALIZOWANY
              </button>
            ) : (
              <div className="w-full bg-emerald-900/60 backdrop-blur-md border border-emerald-500/50 text-emerald-200 font-bold py-4 px-8 rounded-2xl text-center text-lg flex items-center justify-center gap-3 shadow-inner">
                <span className="text-2xl">✅</span> Zrealizowano!
              </div>
            )}
            <div className="flex w-full gap-3 mt-2">
              <button onClick={shareAsImage} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10 backdrop-blur-md text-sm">
                📸 Zapisz Pamiątkę
              </button>
              <Link to={isTestMode ? "/test" : "/"} className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10 backdrop-blur-md text-sm">
                Wróć do bazy
              </Link>
            </div>
          </div>
        )}
      </div>

      {generatedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl">
          <p className="text-amber-400 font-bold mb-8 text-center text-xl animate-pulse font-serif tracking-wide">👇 Przytrzymaj obrazek palcem 👇</p>
          <img src={generatedImage} alt="Bon" className="max-h-[60vh] rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.3)] border border-amber-400/30" />
          <button onClick={() => setGeneratedImage(null)} className="mt-12 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-12 rounded-full border border-white/20 transition-all shadow-2xl tracking-widest uppercase text-sm">Zamknij</button>
        </div>
      )}
    </>
  );
}