import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import Snowfall from 'react-snowfall';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const START_BALANCE = 100; // Saldo startowe

const TICKETS = [
  {
    id: 't3',
    name: 'Szczęśliwe 3 zł',
    price: 3,
    badge: 'Lekki start',
    headerBg: 'bg-emerald-700',
    accentBorder: 'border-emerald-600',
    cardBg: 'from-emerald-900 to-emerald-950',
    prizes: [
      { amount: 0, weight: 52, label: 'Pusto (0 zł)' },
      { amount: 3, weight: 25, label: 'Zwrot 3 zł' },
      { amount: 6, weight: 14, label: '6 zł' },
      { amount: 15, weight: 7, label: '15 zł' },
      { amount: 50, weight: 2, label: '50 zł!' }
    ]
  },
  {
    id: 't5',
    name: 'Świąteczny Strzał',
    price: 5,
    badge: 'Klasyk',
    headerBg: 'bg-red-700',
    accentBorder: 'border-red-600',
    cardBg: 'from-red-900 to-red-950',
    prizes: [
      { amount: 0, weight: 55, label: 'Pusto (0 zł)' },
      { amount: 5, weight: 22, label: 'Zwrot 5 zł' },
      { amount: 10, weight: 13, label: '10 zł' },
      { amount: 25, weight: 7, label: '25 zł' },
      { amount: 100, weight: 2.5, label: '100 zł!' },
      { amount: 250, weight: 0.5, label: '250 zł!!' }
    ]
  },
  {
    id: 't10',
    name: 'Złota Gwiazdka',
    price: 10,
    badge: 'Średnie ryzyko',
    headerBg: 'bg-amber-600',
    accentBorder: 'border-amber-500',
    cardBg: 'from-amber-900 to-yellow-950',
    prizes: [
      { amount: 0, weight: 58, label: 'Pusto (0 zł)' },
      { amount: 10, weight: 20, label: 'Zwrot 10 zł' },
      { amount: 20, weight: 12, label: '20 zł' },
      { amount: 50, weight: 6.5, label: '50 zł' },
      { amount: 200, weight: 2.5, label: '200 zł!' },
      { amount: 1000, weight: 1, label: '1 000 zł!!!' }
    ]
  },
  {
    id: 't20',
    name: 'Diamentowy Lód',
    price: 20,
    badge: 'Wysoka stawka',
    headerBg: 'bg-cyan-700',
    accentBorder: 'border-cyan-600',
    cardBg: 'from-sky-900 to-slate-900',
    prizes: [
      { amount: 0, weight: 62, label: 'Pusto (0 zł)' },
      { amount: 20, weight: 18, label: 'Zwrot 20 zł' },
      { amount: 50, weight: 11, label: '50 zł' },
      { amount: 150, weight: 6, label: '150 zł' },
      { amount: 500, weight: 2.3, label: '500 zł!' },
      { amount: 5000, weight: 0.7, label: '5 000 zł!!!!' }
    ]
  }
];

const createFreshLottoDoc = (ts = Date.now()) => ({
  pin: '',
  balance: START_BALANCE,
  totalWon: 0,
  totalSpent: 0,
  ticketsBought: 0,
  bestWin: 0,
  lastUpdate: ts
});

const rollPrize = (prizes) => {
  const totalWeight = prizes.reduce((acc, p) => acc + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (const p of prizes) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return prizes[0];
};

// Generowanie planszy - 3 takie same kwoty, żeby wygrać
const generateCells = (ticket, wonAmount) => {
  const amounts = ticket.prizes.map(p => p.amount);
  let cells = [];
  if (wonAmount > 0) {
    cells = [wonAmount, wonAmount, wonAmount]; // 3 wygrywające
    let decoys = [];
    while (decoys.length < 3) {
      const r = amounts[Math.floor(Math.random() * amounts.length)];
      if (r !== wonAmount && decoys.filter(x => x === r).length < 2) decoys.push(r);
    }
    cells = cells.concat(decoys);
  } else {
    // Przegrana - maksymalnie 2 takie same kwoty
    let decoys = [];
    while (decoys.length < 6) {
      const r = amounts[Math.floor(Math.random() * amounts.length)];
      if (decoys.filter(x => x === r).length < 2) decoys.push(r);
    }
    cells = decoys;
  }
  return cells.sort(() => Math.random() - 0.5); // tasowanie
};

const formatPln = (val) => {
  const num = Math.round(val * 100) / 100;
  const sign = num < 0 ? '-' : '';
  return `${sign}${Math.abs(num).toLocaleString('pl-PL')} zł`;
};

export default function LottoScratch() {
  const { width, height } = useWindowSize();

  const [viewState, setViewState] = useState('menu');
  const [player, setPlayer] = useState(null);

  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTicket, setActiveTicket] = useState(null);
  const [showBigWinConfetti, setShowBigWinConfetti] = useState(false);

  const [leaderboard, setLeaderboard] = useState({
    stary: createFreshLottoDoc(0),
    stara: createFreshLottoDoc(0)
  });

  // Synchronizacja stanu z Firebase (Brak błędów z opóźnionym balansem)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "scratch_lotto"), (snapshot) => {
      const lb = { stary: createFreshLottoDoc(0), stara: createFreshLottoDoc(0) };
      snapshot.forEach((d) => {
        lb[d.id] = { ...lb[d.id], ...d.data() };
      });
      setLeaderboard(lb);
    });
    return () => unsub();
  }, []);

  const myData = player ? leaderboard[player] : null;

  const handleSelectPlayer = async (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setPinInput('');
    setPinConfirm('');
    setAuthError('');
    setViewState('loading');

    const docRef = doc(db, "scratch_lotto", selectedPlayer);
    const snap = await getDoc(docRef);
    let data = createFreshLottoDoc();
    if (snap.exists()) data = { ...data, ...snap.data() };
    else await setDoc(docRef, data);

    if (data.pin && String(data.pin).length > 0) setViewState('auth_login');
    else setViewState('auth_setup');
  };

  const handleSetPin = async () => {
    if (pinInput.trim().length < 4 || pinInput !== pinConfirm) {
      setAuthError('Hasło musi mieć min. 4 znaki i być identyczne.');
      return;
    }
    setAuthError('');
    setViewState('loading');

    const docRef = doc(db, "scratch_lotto", player);
    await setDoc(docRef, { pin: pinInput.trim(), lastUpdate: Date.now() }, { merge: true });
    
    setPinInput('');
    setPinConfirm('');
    setViewState('playing');
  };

  const handleLoginPin = async () => {
    setViewState('loading');
    const docRef = doc(db, "scratch_lotto", player);
    const snap = await getDoc(docRef);
    const baseData = snap.exists() ? snap.data() : createFreshLottoDoc();

    if (pinInput === baseData.pin) {
      setAuthError('');
      setPinInput('');
      setViewState('playing');
    } else {
      setPinInput('');
      setAuthError('Nieprawidłowe hasło!');
      setViewState('auth_login');
    }
  };

  // KUPNO ZDRAPKI - Odejmuje kwotę z bazy od razu
  const handleBuyTicket = async (ticket) => {
    if (!player || activeTicket) return;

    const wonPrize = rollPrize(ticket.prizes);
    const cells = generateCells(ticket, wonPrize.amount);

    setActiveTicket({
      ticket,
      prize: wonPrize,
      cells,
      scratched: [false, false, false, false, false, false],
      settled: false
    });

    const buyAudio = new Audio('https://cdn.pixabay.com/audio/2021/08/09/audio_88447e12e2.mp3');
    buyAudio.volume = 0.3; buyAudio.play().catch(()=>{});

    const docRef = doc(db, "scratch_lotto", player);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const d = snap.data();
      await updateDoc(docRef, {
        balance: (d.balance ?? START_BALANCE) - ticket.price,
        totalSpent: (d.totalSpent || 0) + ticket.price,
        ticketsBought: (d.ticketsBought || 0) + 1,
        lastUpdate: Date.now()
      });
    }
  };

  // REALIZACJA WYGRANEJ
  const finalizeTicketWin = async (ticketState) => {
    const prizeAmount = ticketState.prize.amount;

    if (prizeAmount > 0) {
      const winAudio = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3');
      winAudio.volume = 0.6; winAudio.play().catch(()=>{});
      if (prizeAmount >= 50) {
        setShowBigWinConfetti(true);
        setTimeout(() => setShowBigWinConfetti(false), 4500);
      }
    } else {
      const loseAudio = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3');
      loseAudio.volume = 0.2; loseAudio.play().catch(()=>{});
    }

    const docRef = doc(db, "scratch_lotto", player);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const d = snap.data();
      await updateDoc(docRef, {
        balance: (d.balance ?? START_BALANCE) + prizeAmount,
        totalWon: (d.totalWon || 0) + prizeAmount,
        bestWin: Math.max(d.bestWin || 0, prizeAmount),
        lastUpdate: Date.now()
      });
    }
  };

  // Efekt monitorujący zakończenie zdrapywania
  useEffect(() => {
    if (activeTicket && !activeTicket.settled) {
      if (activeTicket.scratched.every(Boolean)) {
        setActiveTicket(prev => ({ ...prev, settled: true }));
        finalizeTicketWin(activeTicket);
      }
    }
  }, [activeTicket]);

  const handleScratchCell = (idx) => {
    if (!activeTicket || activeTicket.scratched[idx] || activeTicket.settled) return;
    
    const scratchAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_24e20f1883.mp3');
    scratchAudio.volume = 0.15; scratchAudio.play().catch(()=>{});

    setActiveTicket(prev => {
      const next = [...prev.scratched];
      next[idx] = true;
      return { ...prev, scratched: next };
    });
  };

  const handleRevealAll = () => {
    if (!activeTicket || activeTicket.settled) return;
    setActiveTicket(prev => ({
      ...prev,
      scratched: [true, true, true, true, true, true]
    }));
  };

  const staryData = leaderboard.stary || createFreshLottoDoc(0);
  const staraData = leaderboard.stara || createFreshLottoDoc(0);
  const leaderText = staryData.totalWon === staraData.totalWon ? 'Remis w wygranych!'
    : staryData.totalWon > staraData.totalWon ? `Prowadzi Stary (+${formatPln(staryData.totalWon - staraData.totalWon)})`
    : `Prowadzi Stara (+${formatPln(staraData.totalWon - staryData.totalWon)})`;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-black p-4 flex flex-col items-center relative overflow-hidden font-sans select-none">
      <Snowfall color="#fde047" snowflakeCount={40} style={{ opacity: 0.2, zIndex: 0 }} />
      {showBigWinConfetti && (
        <Confetti width={width} height={height} recycle={false} numberOfPieces={500} colors={['#fde047', '#10b981', '#ef4444', '#ffffff']} />
      )}

      <div className="z-10 w-full max-w-lg flex flex-col items-center pt-4 pb-20">
        {viewState === 'loading' && <div className="mt-24 text-amber-300 font-bold animate-pulse text-lg">Łączenie z bazą...</div>}

        {viewState === 'auth_setup' && (
          <div className="w-full bg-black/65 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔐</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">Konto: {player?.toUpperCase()}</h2>
            <p className="text-xs text-slate-300 mb-6">Ustaw hasło (min. 4 znaki) do swojego konta Lotto.</p>
            <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-3 text-lg tracking-widest focus:outline-none focus:border-amber-400" placeholder="Nowe hasło" />
            <input type="password" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSetPin()} className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400" placeholder="Powtórz hasło" />
            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}
            <button onClick={handleSetPin} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all mb-3">Zapisz i wejdź</button>
            <button onClick={() => { setViewState('menu'); setPlayer(null); }} className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10">Wróć</button>
          </div>
        )}

        {viewState === 'auth_login' && (
          <div className="w-full bg-black/65 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔑</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">Konto: {player?.toUpperCase()}</h2>
            <p className="text-xs text-slate-300 mb-6">Podaj hasło do swojego konta Lotto.</p>
            <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLoginPin()} className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400" placeholder="Hasło" />
            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}
            <button onClick={handleLoginPin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all mb-3">Zaloguj się</button>
            <button onClick={() => { setViewState('menu'); setPlayer(null); }} className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10">Wróć</button>
          </div>
        )}

        {viewState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">Zdrapki Lotto 🎟️</h1>
            <p className="text-emerald-200/80 mb-6 italic text-xs md:text-sm text-center">Wyścig trwa do 24 grudnia! Kto wygra więcej, zgarnia tytuł.</p>

            <div className="bg-black/45 border border-amber-400/30 rounded-3xl p-6 w-full mb-7 backdrop-blur-md shadow-xl">
              <h2 className="text-amber-300 font-bold tracking-widest uppercase mb-2 text-sm text-center">🏆 Tabela (do 24.12)</h2>
              <p className="text-xs text-center text-emerald-300 font-bold mb-5">{leaderText}</p>
              
              <div className="flex flex-col gap-4">
                <div className="bg-blue-950/40 border border-blue-400/30 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white uppercase tracking-wider text-base">Stary {staryData.pin ? '🔒' : '🔓'}</span>
                    <span className="text-xl font-mono font-bold text-amber-300">Wygrane: {formatPln(staryData.totalWon || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className={(staryData.balance ?? START_BALANCE) < 0 ? 'text-red-400 font-bold' : 'text-emerald-300'}>Saldo: {formatPln(staryData.balance ?? START_BALANCE)}</span>
                    <span>Losów: {staryData.ticketsBought || 0} • Max: {formatPln(staryData.bestWin || 0)}</span>
                  </div>
                </div>
                <div className="bg-pink-950/40 border border-pink-400/30 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white uppercase tracking-wider text-base">Stara {staraData.pin ? '🔒' : '🔓'}</span>
                    <span className="text-xl font-mono font-bold text-amber-300">Wygrane: {formatPln(staraData.totalWon || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className={(staraData.balance ?? START_BALANCE) < 0 ? 'text-red-400 font-bold' : 'text-emerald-300'}>Saldo: {formatPln(staraData.balance ?? START_BALANCE)}</span>
                    <span>Losów: {staraData.ticketsBought || 0} • Max: {formatPln(staraData.bestWin || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wybierz gracza:</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => handleSelectPlayer('stary')} className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 text-white font-bold py-5 rounded-2xl border border-blue-400/50 shadow-lg text-xl uppercase">Stary</button>
              <button onClick={() => handleSelectPlayer('stara')} className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 text-white font-bold py-5 rounded-2xl border border-pink-400/50 shadow-lg text-xl uppercase">Stara</button>
            </div>
            <Link to="/" className="mt-10 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1">Wróć do Kalendarza</Link>
          </div>
        )}

        {viewState === 'playing' && myData && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            
            {/* HEADER Z SALDEM */}
            <div className="bg-black/80 backdrop-blur-xl border-b border-amber-500/30 w-screen fixed top-0 left-0 px-5 py-3 flex justify-between items-center z-20 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-200/70 uppercase tracking-widest font-bold">{player?.toUpperCase()} • Saldo</span>
                <span className={`text-2xl font-mono font-bold ${myData.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatPln(myData.balance ?? START_BALANCE)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-amber-300/80 uppercase tracking-widest font-bold">Łącznie wygrano</span>
                <span className="text-lg font-mono font-bold text-amber-300">{formatPln(myData.totalWon || 0)}</span>
              </div>
            </div>

            <div className="mt-20 w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 mb-5 flex justify-between text-xs text-slate-300">
              <span>Losy: <strong className="text-white">{myData.ticketsBought || 0}</strong></span>
              <span>Wydano: <strong className="text-white">{formatPln(myData.totalSpent || 0)}</strong></span>
              <span>Max: <strong className="text-amber-300">{formatPln(myData.bestWin || 0)}</strong></span>
            </div>

            {(myData.balance ?? START_BALANCE) < 0 && (
              <div className="w-full bg-red-950/70 border border-red-500/60 text-red-200 rounded-2xl p-3 mb-5 text-xs text-center font-bold">
                ⚠️ Jesteś na minusie! Graj dalej, żeby odrobić straty.
              </div>
            )}

            {activeTicket ? (
              /* PROFESJONALNY WYGLĄD ZDRAPKI */
              <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-4 ${activeTicket.ticket.accentBorder} animate-fade-in`}>
                
                {/* ZDRAPKA HEADER */}
                <div className={`${activeTicket.ticket.headerBg} p-5 text-center relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/10"></div>
                  <h2 className="text-3xl font-black uppercase text-white drop-shadow-lg relative z-10">{activeTicket.ticket.name}</h2>
                  <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest mt-1 relative z-10">
                    Znajdź 3 takie same kwoty, aby wygrać!
                  </p>
                </div>

                {/* ZDRAPKA CONTENT */}
                <div className="bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')] bg-amber-50 p-6 relative flex flex-col items-center">
                  <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
                    {activeTicket.cells.map((amount, idx) => {
                      const isOpen = activeTicket.scratched[idx];
                      const isWinnerCell = activeTicket.settled && activeTicket.prize.amount > 0 && amount === activeTicket.prize.amount;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => handleScratchCell(idx)}
                          disabled={isOpen || activeTicket.settled}
                          className={`relative h-20 rounded-xl overflow-hidden border-2 shadow-md transition-transform ${!isOpen ? 'active:scale-95 cursor-pointer' : ''} ${isOpen ? (isWinnerCell ? 'border-emerald-600 bg-emerald-100 shadow-[inset_0_0_15px_rgba(16,185,129,0.3)]' : 'border-slate-300 bg-white') : 'border-slate-400'}`}
                        >
                          {isOpen ? (
                            <div className={`flex items-center justify-center w-full h-full font-mono font-extrabold text-xl ${isWinnerCell ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {formatPln(amount)}
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/aluminum.png')] bg-slate-300 bg-gradient-to-tr from-slate-400 via-slate-200 to-slate-400 flex items-center justify-center group">
                              <span className="text-3xl opacity-60 group-hover:scale-110 transition-transform">🪙</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* KOD KRESKOWY (Fikcyjny) */}
                  <div className="mt-6 w-full flex flex-col items-center opacity-60">
                    <div className="w-3/4 h-8 bg-[url('https://www.freepnglogos.com/uploads/barcode-png/barcode-logo-transparent-download-23.png')] bg-contain bg-center bg-no-repeat"></div>
                    <p className="text-[8px] font-mono text-slate-800 mt-1">S/N: {Date.now().toString().slice(-8)}-{activeTicket.ticket.price}PLN</p>
                  </div>

                  {/* NAKŁADKA PO ZAKOŃCZENIU */}
                  {activeTicket.settled && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center p-6 animate-fade-in z-20 text-center">
                      <p className="text-sm font-bold text-white mb-2 uppercase tracking-widest">Twój Wynik</p>
                      <p className={`text-4xl font-black mb-6 ${activeTicket.prize.amount > 0 ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'text-slate-400'}`}>
                        {activeTicket.prize.label}
                      </p>
                      <button
                        onClick={() => setActiveTicket(null)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black py-4 px-8 rounded-xl text-sm uppercase tracking-widest shadow-xl transition-transform hover:scale-105"
                      >
                        Kolejna Zdrapka
                      </button>
                    </div>
                  )}
                </div>

                {!activeTicket.settled && (
                  <div className="bg-black/90 p-3">
                    <button onClick={handleRevealAll} className="w-full bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold uppercase py-3 rounded-xl border border-white/15">
                      Zdrap całą folię
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* LISTA ZDRAPEK DO KUPIENIA */
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {TICKETS.map((t) => (
                  <div key={t.id} className={`bg-gradient-to-br ${t.cardBg} border-2 ${t.accentBorder} rounded-3xl p-5 flex flex-col justify-between shadow-2xl transform transition-transform hover:-translate-y-1`}>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] uppercase tracking-widest text-amber-200/80 font-bold bg-black/30 px-2 py-1 rounded-lg">
                          {t.badge}
                        </span>
                        <span className="text-xl font-mono font-extrabold text-white bg-black/40 px-3 py-1 rounded-xl shadow-inner">
                          {t.price} zł
                        </span>
                      </div>
                      <h3 className="text-xl font-black uppercase text-white mb-1 drop-shadow-md">{t.name}</h3>
                      <p className="text-[11px] text-slate-300 mb-5">
                        Max wygrana: <strong className="text-amber-300 text-sm">{formatPln(Math.max(...t.prizes.map((p) => p.amount)))}</strong>
                      </p>
                    </div>
                    <button onClick={() => handleBuyTicket(t)} className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black py-4 rounded-xl shadow-lg text-sm uppercase tracking-wider transition-all">
                      Kup los
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button onClick={() => { setViewState('menu'); setPlayer(null); setActiveTicket(null); }} className="flex-1 bg-white/10 text-white/80 hover:text-white hover:bg-white/20 text-xs font-bold uppercase py-4 rounded-xl border border-white/10 transition-colors">
                Menu Główne
              </button>
              <Link to="/" className="flex-1 bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-bold uppercase py-4 rounded-xl border border-red-500/30 transition-colors flex justify-center items-center">
                Wyjście
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}