import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Snowfall from 'react-snowfall';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function Game() {
  const { width, height } = useWindowSize();
  
  // STANY GRY: 'menu', 'playing', 'gameover'
  const [gameState, setGameState] = useState('menu');
  const [player, setPlayer] = useState(null); // 'stary' lub 'stara'
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highscores, setHighscores] = useState({ stary: 0, stara: 0 });
  
  const [activeMole, setActiveMole] = useState({ index: -1, type: null }); // type: 'grinch' lub 'santa'
  const [newRecord, setNewRecord] = useState(false);

  const gameIntervalRef = useRef(null);

  // POBIERANIE WYNIKÓW Z BAZY
  const fetchHighscores = async () => {
    try {
      const docRef = doc(db, "game", "leaderboard");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setHighscores(docSnap.data());
      } else {
        // Inicjalizacja bazy, jeśli nikt jeszcze nie grał
        await setDoc(docRef, { stary: 0, stara: 0 });
      }
    } catch (e) {
      console.error("Błąd pobierania tabeli wyników", e);
    }
  };

  useEffect(() => {
    fetchHighscores();
    return () => clearInterval(gameIntervalRef.current);
  }, []);

  // MECHANIKA GRY (Główna Pętla)
  useEffect(() => {
    if (gameState === 'playing') {
      // Im więcej punktów, tym szybciej pojawiają się postacie! (od 1000ms do 400ms)
      const currentSpeed = Math.max(400, 1000 - (score * 3));
      
      gameIntervalRef.current = setInterval(() => {
        setActiveMole(prev => {
          let nextIndex;
          do {
            nextIndex = Math.floor(Math.random() * 9);
          } while (nextIndex === prev.index); // Żeby nie pojawił się dwa razy w tym samym kominie
          
          // 80% szans na Grincha, 20% na Mikołaja (Zmyłkę)
          const isGrinch = Math.random() > 0.2; 
          return { index: nextIndex, type: isGrinch ? 'grinch' : 'santa' };
        });
      }, currentSpeed);
    } else {
      clearInterval(gameIntervalRef.current);
    }
    
    return () => clearInterval(gameIntervalRef.current);
  }, [gameState, score]);

  // KONTROLA ŻYĆ I KOŃCA GRY
  useEffect(() => {
    if (lives <= 0 && gameState === 'playing') {
      handleGameOver();
    }
  }, [lives]);

  const handleStart = (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setScore(0);
    setLives(3);
    setNewRecord(false);
    setGameState('playing');
    
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3');
    audio.volume = 0.5; audio.play().catch(()=>{});
  };

  const handleHit = (index, type) => {
    if (index !== activeMole.index) return; // Pudło, uderzył w pusty komin

    if (type === 'grinch') {
      // Uderzył Grincha! Punkty!
      setScore(prev => prev + 10);
      setActiveMole({ index: -1, type: null }); // Znika natychmiast
      const hitSound = new Audio('https://cdn.pixabay.com/audio/2021/08/09/audio_88447e12e2.mp3');
      hitSound.volume = 0.3; hitSound.play().catch(()=>{});
    } else if (type === 'santa') {
      // O nie! Uderzył Mikołaja! Kara!
      setLives(prev => prev - 1);
      setActiveMole({ index: -1, type: null });
      const errorSound = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3');
      errorSound.volume = 0.3; errorSound.play().catch(()=>{});
    }
  };

  const handleGameOver = async () => {
    setGameState('gameover');
    setActiveMole({ index: -1, type: null });
    
    const errorSound = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3');
    errorSound.volume = 0.5; errorSound.play().catch(()=>{});

    // ZAPIS NOWEGO REKORDU DO FIREBASE
    if (score > highscores[player]) {
      setNewRecord(true);
      try {
        const docRef = doc(db, "game", "leaderboard");
        await updateDoc(docRef, { [player]: score });
        // Odśwież lokalne wyniki
        setHighscores(prev => ({ ...prev, [player]: score }));
      } catch (e) {
        console.error("Błąd zapisu rekordu", e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black p-4 flex flex-col items-center justify-center relative overflow-hidden font-sans select-none">
      <Snowfall color="#ffffff" snowflakeCount={60} style={{ opacity: 0.3, zIndex: 0 }} />
      
      {newRecord && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} colors={['#fde047', '#10b981', '#ef4444']} />}

      <div className="z-10 w-full max-w-md flex flex-col items-center">
        
        {/* --- EKRAN GŁÓWNY (MENU) --- */}
        {gameState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-blue-200 to-blue-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">
              Śnieżką w Grincha!
            </h1>
            <p className="text-blue-200/70 mb-8 italic text-sm text-center">
              Celuj w Grincha (🧌), omijaj Mikołaja (🎅)! Im dalej, tym szybciej.
            </p>

            <div className="bg-black/40 border border-white/10 rounded-3xl p-6 w-full mb-8 backdrop-blur-md text-center shadow-xl">
              <h2 className="text-amber-400 font-bold tracking-widest uppercase mb-4 text-sm flex items-center justify-center gap-2"><span>🏆</span> Tabela Wyników <span>🏆</span></h2>
              <div className="flex justify-between items-center bg-blue-900/30 p-3 rounded-xl mb-3 border border-blue-500/30">
                <span className="font-bold text-white uppercase tracking-wider">Stary</span>
                <span className="text-2xl font-mono text-amber-400 font-bold">{highscores.stary}</span>
              </div>
              <div className="flex justify-between items-center bg-pink-900/30 p-3 rounded-xl border border-pink-500/30">
                <span className="font-bold text-white uppercase tracking-wider">Stara</span>
                <span className="text-2xl font-mono text-amber-400 font-bold">{highscores.stara}</span>
              </div>
            </div>

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wybierz gracza:</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => handleStart('stary')} className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-6 rounded-2xl border border-blue-400/50 shadow-lg transform hover:scale-105 transition-all text-xl uppercase tracking-wider">
                Stary
              </button>
              <button onClick={() => handleStart('stara')} className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 hover:to-pink-700 text-white font-bold py-6 rounded-2xl border border-pink-400/50 shadow-lg transform hover:scale-105 transition-all text-xl uppercase tracking-wider">
                Stara
              </button>
            </div>
            
            <Link to="/" className="mt-10 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1">Wróć do Kalendarza</Link>
          </div>
        )}

        {/* --- EKRAN GRY --- */}
        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center">
            {/* INTERFEJS GRY */}
            <div className="flex justify-between w-full mb-8 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl">
              <div className="flex flex-col">
                <span className="text-xs text-blue-300 uppercase tracking-widest font-bold">Punkty</span>
                <span className="text-3xl text-amber-400 font-mono font-bold">{score}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-red-300 uppercase tracking-widest font-bold mb-1">Życia</span>
                <div className="flex gap-1 text-2xl">
                  {[...Array(3)].map((_, i) => (
                    <span key={i} className={i < lives ? "opacity-100" : "opacity-20 grayscale"}>❤️</span>
                  ))}
                </div>
              </div>
            </div>

            {/* PLANSZA 3x3 */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 w-full aspect-square mb-8">
              {[...Array(9)].map((_, i) => (
                <div 
                  key={i} 
                  onClick={() => handleHit(i, activeMole.index === i ? activeMole.type : null)}
                  className="bg-slate-800/80 border-b-4 border-slate-900 rounded-2xl relative overflow-hidden flex items-end justify-center shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)] cursor-pointer active:scale-95 transition-transform"
                >
                  {/* KOMIN */}
                  <div className="absolute bottom-0 w-full h-1/3 bg-red-900 border-t border-red-700 opacity-50"></div>
                  
                  {/* POSTAĆ */}
                  {activeMole.index === i && (
                    <div className="absolute bottom-2 text-6xl md:text-7xl animate-bounce-fast filter drop-shadow-xl z-10 pointer-events-none">
                      {activeMole.type === 'grinch' ? '🧌' : '🎅'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- EKRAN KOŃCA GRY --- */}
        {gameState === 'gameover' && (
          <div className="bg-black/60 backdrop-blur-xl border-2 border-red-500/50 rounded-3xl p-8 w-full text-center shadow-2xl animate-fade-in">
            <span className="text-7xl mb-4 block filter grayscale opacity-80">🥶</span>
            <h2 className="text-3xl font-bold text-red-400 mb-2 uppercase tracking-widest">Koniec Gry!</h2>
            
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 my-6">
              <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Twój wynik ({player})</p>
              <p className="text-6xl text-amber-400 font-mono font-bold mb-2">{score}</p>
              
              {newRecord ? (
                <p className="text-emerald-400 font-bold animate-pulse text-sm uppercase tracking-widest bg-emerald-900/30 py-2 rounded-lg mt-4 border border-emerald-500/30">
                  🎉 NOWY REKORD!
                </p>
              ) : (
                <p className="text-slate-500 text-xs">Nie pobiłeś swojego rekordu ({highscores[player]}).</p>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button onClick={() => setGameState('menu')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl border border-blue-400/50 shadow-lg transition-all tracking-wide uppercase text-sm">
                Tabela i Menu
              </button>
              <button onClick={() => handleStart(player)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl border border-emerald-400/50 shadow-lg transition-all tracking-wide uppercase text-sm">
                Graj ponownie
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}