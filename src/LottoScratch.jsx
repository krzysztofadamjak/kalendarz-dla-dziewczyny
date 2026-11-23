import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import Snowfall from 'react-snowfall';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const START_BALANCE = 100;

const TICKETS = [
  { id: 't3', name: 'Szczęśliwe 3 zł', price: 3, badge: 'Lekki start', headerBg: 'bg-emerald-700', accentBorder: 'border-emerald-600', cardBg: 'from-emerald-900 to-emerald-950', prizes: [{ amount: 0, weight: 52, label: 'Pusto (0 zł)' }, { amount: 3, weight: 25, label: 'Zwrot 3 zł' }, { amount: 6, weight: 14, label: '6 zł' }, { amount: 15, weight: 7, label: '15 zł' }, { amount: 50, weight: 2, label: '50 zł!' }] },
  { id: 't5', name: 'Świąteczny Strzał', price: 5, badge: 'Klasyk', headerBg: 'bg-red-700', accentBorder: 'border-red-600', cardBg: 'from-red-900 to-red-950', prizes: [{ amount: 0, weight: 55, label: 'Pusto (0 zł)' }, { amount: 5, weight: 22, label: 'Zwrot 5 zł' }, { amount: 10, weight: 13, label: '10 zł' }, { amount: 25, weight: 7, label: '25 zł' }, { amount: 100, weight: 2.5, label: '100 zł!' }, { amount: 250, weight: 0.5, label: '250 zł!!' }] },
  { id: 't10', name: 'Złota Gwiazdka', price: 10, badge: 'Średnie ryzyko', headerBg: 'bg-amber-600', accentBorder: 'border-amber-500', cardBg: 'from-amber-900 to-yellow-950', prizes: [{ amount: 0, weight: 58, label: 'Pusto (0 zł)' }, { amount: 10, weight: 20, label: 'Zwrot 10 zł' }, { amount: 20, weight: 12, label: '20 zł' }, { amount: 50, weight: 6.5, label: '50 zł' }, { amount: 200, weight: 2.5, label: '200 zł!' }, { amount: 1000, weight: 1, label: '1 000 zł!!!' }] },
  { id: 't20', name: 'Diamentowy Lód', price: 20, badge: 'Wysoka stawka', headerBg: 'bg-cyan-700', accentBorder: 'border-cyan-600', cardBg: 'from-sky-900 to-slate-900', prizes: [{ amount: 0, weight: 62, label: 'Pusto (0 zł)' }, { amount: 20, weight: 18, label: 'Zwrot 20 zł' }, { amount: 50, weight: 11, label: '50 zł' }, { amount: 150, weight: 6, label: '150 zł' }, { amount: 500, weight: 2.3, label: '500 zł!' }, { amount: 5000, weight: 0.7, label: '5 000 zł!!!!' }] }
];

const PLINKO_MULTIPLIERS = [25, 5, 1.5, 0.2, 1.5, 5, 25];
const PLINKO_ROWS = 6;

const SLOT_SYMBOLS = [
  { id: 'grinch', icon: '🧌', payout: 0 },
  { id: 'elf', icon: '🚐', payout: 2 },
  { id: 'reindeer', icon: '🚗', payout: 5 },
  { id: 'maverick', icon: '🛻', payout: 15 },
  { id: 'lexus', icon: '🏎️', payout: 100 }
];

const createFreshLottoDoc = (ts = Date.now()) => ({
  pin: '', balance: START_BALANCE, totalWon: 0, totalSpent: 0, ticketsBought: 0, bestWin: 0,
  piggyBank: 0, lastPiggyBreak: 0, lastUpdate: ts
});

const rollPrize = (prizes) => {
  const t = prizes.reduce((a, p) => a + p.weight, 0);
  let r = Math.random() * t;
  for (const p of prizes) { if (r < p.weight) return p; r -= p.weight; }
  return prizes[0];
};

const generateCells = (ticket, wonAmount) => {
  const amounts = ticket.prizes.map(p => p.amount);
  let cells = [];
  if (wonAmount > 0) {
    cells = [wonAmount, wonAmount, wonAmount];
    let decoys = [];
    while (decoys.length < 3) {
      const r = amounts[Math.floor(Math.random() * amounts.length)];
      if (r !== wonAmount && decoys.filter(x => x === r).length < 2) decoys.push(r);
    }
    cells = cells.concat(decoys);
  } else {
    let decoys = [];
    while (decoys.length < 6) {
      const r = amounts[Math.floor(Math.random() * amounts.length)];
      if (decoys.filter(x => x === r).length < 2) decoys.push(r);
    }
    cells = decoys;
  }
  return cells.sort(() => Math.random() - 0.5);
};

const formatPln = (val) => {
  const num = Math.round(val * 100) / 100;
  return `${num < 0 ? '-' : ''}${Math.abs(num).toLocaleString('pl-PL')} zł`;
};

export default function CasinoHub() {
  const { width, height } = useWindowSize();

  const [viewState, setViewState] = useState('menu');
  const [player, setPlayer] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [authError, setAuthError] = useState('');

  const [balance, setBalance] = useState(START_BALANCE);
  const [piggyBank, setPiggyBank] = useState(0);
  const [lastPiggyBreak, setLastPiggyBreak] = useState(0);
  
  const [totalWon, setTotalWon] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [ticketsBought, setTicketsBought] = useState(0);
  const [bestWin, setBestWin] = useState(0);
  const [showBigWinConfetti, setShowBigWinConfetti] = useState(false);
  
  const [activeTab, setActiveTab] = useState('scratch'); // scratch, crash, slots, plinko

  // --- ZDRAPKI STATE ---
  const [activeTicket, setActiveTicket] = useState(null);

  // --- CRASH STATE ---
  const [crashBet, setCrashBet] = useState(10);
  const [crashMultiplier, setCrashMultiplier] = useState(1.00);
  const [crashStatus, setCrashStatus] = useState('idle'); // idle, playing, crashed, cashed
  const [crashTarget, setCrashTarget] = useState(1.00);
  const crashIntervalRef = useRef(null);
  const crashMultRef = useRef(1.00);

  // --- SLOTS STATE ---
  const [slotBet, setSlotBet] = useState(5);
  const [reels, setReels] = useState(['🚐', '🛻', '🧌']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [slotResult, setSlotResult] = useState(null);

  // --- PLINKO STATE ---
  const [plinkoBet, setPlinkoBet] = useState(10);
  const [plinkoStatus, setPlinkoStatus] = useState('idle'); // idle, dropping, finished
  const [plinkoPath, setPlinkoPath] = useState([]); // {row, col}
  const [plinkoResult, setPlinkoResult] = useState(null);

  const [leaderboard, setLeaderboard] = useState({ stary: createFreshLottoDoc(0), stara: createFreshLottoDoc(0) });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "scratch_lotto"), (snapshot) => {
      const lb = { stary: createFreshLottoDoc(0), stara: createFreshLottoDoc(0) };
      snapshot.forEach((d) => { lb[d.id] = { ...lb[d.id], ...d.data() }; });
      setLeaderboard(lb);
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  const myData = player ? leaderboard[player] : null;

  const addLossToPiggy = async (lossAmount) => {
    if (lossAmount <= 0) return;
    const cashback = lossAmount * 0.10; // 10%
    const nextPiggy = piggyBank + cashback;
    setPiggyBank(nextPiggy);
    await syncPlayerDoc(player, { piggyBank: nextPiggy });
  };

  const syncPlayerDoc = async (targetPlayer, patch) => {
    if (!targetPlayer) return;
    try {
      await setDoc(doc(db, "scratch_lotto", targetPlayer), { ...patch, lastUpdate: Date.now() }, { merge: true });
    } catch (e) {}
  };

  const openPlayerSession = async (selectedPlayer, rawData) => {
    const d = rawData || createFreshLottoDoc();
    setBalance(typeof d.balance === 'number' ? d.balance : START_BALANCE);
    setTotalWon(d.totalWon || 0);
    setTotalSpent(d.totalSpent || 0);
    setTicketsBought(d.ticketsBought || 0);
    setBestWin(d.bestWin || 0);
    setPiggyBank(d.piggyBank || 0);
    setLastPiggyBreak(d.lastPiggyBreak || 0);
    setActiveTicket(null);
    setViewState('playing');
  };

  const handleSelectPlayer = async (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setPinInput(''); setPinConfirm(''); setAuthError(''); setViewState('loading');
    const snap = await getDoc(doc(db, "scratch_lotto", selectedPlayer));
    let data = createFreshLottoDoc();
    if (snap.exists()) data = { ...data, ...snap.data() };
    else await setDoc(doc(db, "scratch_lotto", selectedPlayer), data);

    if (data.pin && String(data.pin).length > 0) setViewState('auth_login');
    else setViewState('auth_setup');
  };

  const handleSetPin = async () => {
    if (pinInput.trim().length < 4 || pinInput !== pinConfirm) {
      setAuthError('Hasło musi mieć min. 4 znaki i być identyczne.');
      return;
    }
    setViewState('loading');
    const docRef = doc(db, "scratch_lotto", player);
    await setDoc(docRef, { pin: pinInput.trim(), lastUpdate: Date.now() }, { merge: true });
    await openPlayerSession(player, { ...createFreshLottoDoc(), pin: pinInput.trim() });
  };

  const handleLoginPin = async () => {
    setViewState('loading');
    const snap = await getDoc(doc(db, "scratch_lotto", player));
    const baseData = snap.exists() ? snap.data() : createFreshLottoDoc();
    if (pinInput === baseData.pin) {
      await openPlayerSession(player, baseData);
    } else {
      setPinInput(''); setAuthError('Nieprawidłowe hasło!'); setViewState('auth_login');
    }
  };

  // --- ZDRAPKI LOGIC ---
  const handleBuyTicket = async (ticket) => {
    if (!player || activeTicket) return;
    const nextBalance = balance - ticket.price;
    const wonPrize = rollPrize(ticket.prizes);
    setBalance(nextBalance);
    setTotalSpent(totalSpent + ticket.price);
    setTicketsBought(ticketsBought + 1);
    setActiveTicket({ ticket, prize: wonPrize, cells: generateCells(ticket, wonPrize.amount), scratched: [false, false, false, false, false, false], settled: false });
    new Audio('https://cdn.pixabay.com/audio/2021/08/09/audio_88447e12e2.mp3').play().catch(()=>{});
    await syncPlayerDoc(player, { balance: nextBalance, totalSpent: totalSpent + ticket.price, ticketsBought: ticketsBought + 1 });
  };

  const finalizeTicketWin = async (ticketState) => {
    const amt = ticketState.prize.amount;
    if (amt > 0) {
      new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3').play().catch(()=>{});
      if (amt >= 50) { setShowBigWinConfetti(true); setTimeout(() => setShowBigWinConfetti(false), 4500); }
    } else {
      new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3').play().catch(()=>{});
      addLossToPiggy(ticketState.ticket.price); // Cashback from loss
    }
    const nextBalance = balance + amt;
    setBalance(nextBalance); setTotalWon(totalWon + amt); setBestWin(Math.max(bestWin, amt));
    await syncPlayerDoc(player, { balance: nextBalance, totalWon: totalWon + amt, bestWin: Math.max(bestWin, amt) });
  };

  useEffect(() => {
    if (activeTicket && !activeTicket.settled && activeTicket.scratched.every(Boolean)) {
      setActiveTicket(prev => ({ ...prev, settled: true }));
      finalizeTicketWin(activeTicket);
    }
  }, [activeTicket]);

  const handleScratchCell = (idx) => {
    if (!activeTicket || activeTicket.scratched[idx] || activeTicket.settled) return;
    new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_24e20f1883.mp3').play().catch(()=>{});
    setActiveTicket(prev => {
      const next = [...prev.scratched];
      next[idx] = true;
      return { ...prev, scratched: next };
    });
  };

  const handleRevealAll = () => {
    if (!activeTicket || activeTicket.settled) return;
    setActiveTicket(prev => ({ ...prev, scratched: [true, true, true, true, true, true] }));
  };

  // --- CRASH GAME LOGIC ---
  const handleCrashStart = async () => {
    if (crashStatus === 'playing') return;
    const nextBalance = balance - crashBet;
    setBalance(nextBalance); setTotalSpent(totalSpent + crashBet);
    await syncPlayerDoc(player, { balance: nextBalance, totalSpent: totalSpent + crashBet });

    const e = 100 / (100 - Math.random() * 100);
    const target = e < 1.03 ? 1.00 : e; // 3% instant crash
    setCrashTarget(target);
    setCrashMultiplier(1.00); crashMultRef.current = 1.00;
    setCrashStatus('playing');

    let ticks = 0;
    crashIntervalRef.current = setInterval(() => {
      ticks += 1;
      const current = Math.pow(1.04, ticks / 2);
      crashMultRef.current = current;
      setCrashMultiplier(current);

      if (current >= target) {
        clearInterval(crashIntervalRef.current);
        setCrashMultiplier(target);
        setCrashStatus('crashed');
        addLossToPiggy(crashBet);
      }
    }, 50);
  };

  const handleCashout = async () => {
    if (crashStatus !== 'playing') return;
    clearInterval(crashIntervalRef.current);
    const won = crashBet * crashMultRef.current;
    setCrashStatus('cashed');
    
    const nextBalance = balance + won;
    setBalance(nextBalance); setTotalWon(totalWon + won); setBestWin(Math.max(bestWin, won));
    if (won >= 100) { setShowBigWinConfetti(true); setTimeout(() => setShowBigWinConfetti(false), 3000); }
    await syncPlayerDoc(player, { balance: nextBalance, totalWon: totalWon + won, bestWin: Math.max(bestWin, won) });
  };

  // --- SLOTS LOGIC ---
  const handleSlotSpin = async () => {
    if (isSpinning) return;
    const nextBalance = balance - slotBet;
    setBalance(nextBalance); setTotalSpent(totalSpent + slotBet);
    await syncPlayerDoc(player, { balance: nextBalance, totalSpent: totalSpent + slotBet });
    setIsSpinning(true); setSlotResult(null);
    
    let spins = 0;
    const spinInt = setInterval(() => {
      setReels([
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].icon,
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].icon,
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].icon,
      ]);
      spins++;
      if (spins > 15) {
        clearInterval(spinInt);
        const r1 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        const r2 = Math.random() > 0.4 ? r1 : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        const r3 = Math.random() > 0.6 ? r1 : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        
        setReels([r1.icon, r2.icon, r3.icon]);
        setIsSpinning(false);
        
        if (r1.id === r2.id && r2.id === r3.id && r1.payout > 0) {
          const won = slotBet * r1.payout;
          setSlotResult(`Wygrana! x${r1.payout} (${formatPln(won)})`);
          const fBal = nextBalance + won;
          setBalance(fBal); setTotalWon(totalWon + won); setBestWin(Math.max(bestWin, won));
          syncPlayerDoc(player, { balance: fBal, totalWon: totalWon + won, bestWin: Math.max(bestWin, won) });
          if (won >= 100) { setShowBigWinConfetti(true); setTimeout(() => setShowBigWinConfetti(false), 3000); }
        } else {
          setSlotResult('Pudło!');
          addLossToPiggy(slotBet);
        }
      }
    }, 100);
  };

  // --- PLINKO LOGIC ---
  const handlePlinkoDrop = async () => {
    if (plinkoStatus === 'dropping') return;
    const nextBalance = balance - plinkoBet;
    setBalance(nextBalance); setTotalSpent(totalSpent + plinkoBet);
    await syncPlayerDoc(player, { balance: nextBalance, totalSpent: totalSpent + plinkoBet });
    setPlinkoStatus('dropping'); setPlinkoResult(null); setPlinkoPath([{r: 0, c: 0}]);
    
    let cR = 0; let cC = 0; let currentPath = [{r: 0, c: 0}];
    
    const dropInt = setInterval(() => {
      cR++;
      cC += Math.random() > 0.5 ? 1 : 0;
      currentPath.push({r: cR, c: cC});
      setPlinkoPath([...currentPath]);
      
      if (cR >= PLINKO_ROWS) {
        clearInterval(dropInt);
        setPlinkoStatus('finished');
        const mult = PLINKO_MULTIPLIERS[cC];
        const won = plinkoBet * mult;
        setPlinkoResult(mult);
        
        if (won > 0) {
          const fBal = nextBalance + won;
          setBalance(fBal); setTotalWon(totalWon + won); setBestWin(Math.max(bestWin, won));
          syncPlayerDoc(player, { balance: fBal, totalWon: totalWon + won, bestWin: Math.max(bestWin, won) });
          if (won < plinkoBet) addLossToPiggy(plinkoBet - won);
          if (won >= 100) { setShowBigWinConfetti(true); setTimeout(() => setShowBigWinConfetti(false), 3000); }
        } else {
          addLossToPiggy(plinkoBet);
        }
      }
    }, 200);
  };

  // --- CASHBACK BREAK ---
  const handleBreakPiggy = async () => {
    if (piggyBank <= 0 || (now - lastPiggyBreak < 24 * 60 * 60 * 1000)) return;
    const nextBalance = balance + piggyBank;
    setBalance(nextBalance);
    setPiggyBank(0);
    setLastPiggyBreak(now);
    setShowBigWinConfetti(true); setTimeout(() => setShowBigWinConfetti(false), 3000);
    await syncPlayerDoc(player, { balance: nextBalance, piggyBank: 0, lastPiggyBreak: now });
  };

  const staryData = leaderboard.stary || createFreshLottoDoc(0);
  const staraData = leaderboard.stara || createFreshLottoDoc(0);
  const leaderText = staryData.totalWon === staraData.totalWon ? 'Remis w wygranych!'
    : staryData.totalWon > staraData.totalWon ? `Prowadzi Stary (+${formatPln(staryData.totalWon - staraData.totalWon)})`
    : `Prowadzi Stara (+${formatPln(staraData.totalWon - staryData.totalWon)})`;

  const renderTabButton = (id, icon, label) => (
    <button onClick={() => setActiveTab(id)} className={`flex-1 py-3 flex flex-col items-center gap-1 border-b-2 transition-all ${activeTab === id ? 'border-amber-400 text-amber-300 bg-amber-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
      <span className="text-xl">{icon}</span><span className="text-[9px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-900 to-black p-4 flex flex-col items-center relative overflow-hidden font-sans select-none">
      <Snowfall color="#fde047" snowflakeCount={40} style={{ opacity: 0.2, zIndex: 0 }} />
      {showBigWinConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} colors={['#fde047', '#10b981', '#ef4444', '#ffffff']} />}

      <div className="z-10 w-full max-w-lg flex flex-col items-center pt-4 pb-24">
        {viewState === 'loading' && <div className="mt-24 text-amber-300 font-bold animate-pulse text-lg">Łączenie z bazą...</div>}

        {viewState === 'auth_setup' && (
          <div className="w-full bg-black/65 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔐</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">Konto: {player?.toUpperCase()}</h2>
            <p className="text-xs text-slate-300 mb-6">Ustaw hasło (min. 4 znaki) do swojego portfela w Kasynie.</p>
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
            <p className="text-xs text-slate-300 mb-6">Podaj hasło do swojego konta.</p>
            <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLoginPin()} className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400" placeholder="Hasło" />
            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}
            <button onClick={handleLoginPin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all mb-3">Zaloguj się</button>
            <button onClick={() => { setViewState('menu'); setPlayer(null); }} className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10">Wróć</button>
          </div>
        )}

        {viewState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">Świąteczne Kasyno 🎰</h1>
            <p className="text-emerald-200/80 mb-6 italic text-xs md:text-sm text-center">Zdrapki, Sloty, Plinko i Crash! Kto zbankrutuje pierwszy?</p>

            <div className="bg-black/45 border border-amber-400/30 rounded-3xl p-6 w-full mb-7 backdrop-blur-md shadow-xl">
              <h2 className="text-amber-300 font-bold tracking-widest uppercase mb-2 text-sm text-center">🏆 Ranking Łącznych Wygranych</h2>
              <p className="text-xs text-center text-emerald-300 font-bold mb-5">{leaderText}</p>
              
              <div className="flex flex-col gap-4">
                <div className="bg-blue-950/40 border border-blue-400/30 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white uppercase tracking-wider text-base">Stary {staryData.pin ? '🔒' : '🔓'}</span>
                    <span className="text-xl font-mono font-bold text-amber-300">Wygrane: {formatPln(staryData.totalWon || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className={(staryData.balance ?? START_BALANCE) < 0 ? 'text-red-400 font-bold' : 'text-emerald-300'}>Saldo: {formatPln(staryData.balance ?? START_BALANCE)}</span>
                    <span className="text-fuchsia-300">Skarbonka: {formatPln(staryData.piggyBank || 0)}</span>
                  </div>
                </div>
                <div className="bg-pink-950/40 border border-pink-400/30 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white uppercase tracking-wider text-base">Stara {staraData.pin ? '🔒' : '🔓'}</span>
                    <span className="text-xl font-mono font-bold text-amber-300">Wygrane: {formatPln(staraData.totalWon || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className={(staraData.balance ?? START_BALANCE) < 0 ? 'text-red-400 font-bold' : 'text-emerald-300'}>Saldo: {formatPln(staraData.balance ?? START_BALANCE)}</span>
                    <span className="text-fuchsia-300">Skarbonka: {formatPln(staraData.piggyBank || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wejdź do Kasyna:</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => handleSelectPlayer('stary')} className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 text-white font-bold py-5 rounded-2xl border border-blue-400/50 shadow-lg text-xl uppercase">Stary</button>
              <button onClick={() => handleSelectPlayer('stara')} className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 text-white font-bold py-5 rounded-2xl border border-pink-400/50 shadow-lg text-xl uppercase">Stara</button>
            </div>
            <Link to="/" className="mt-10 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1">Wróć do Kalendarza</Link>
          </div>
        )}

        {viewState === 'playing' && myData && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            
            {/* HEADER */}
            <div className="bg-black/90 backdrop-blur-xl border-b border-amber-500/30 w-screen fixed top-0 left-0 z-30 shadow-xl flex flex-col">
              <div className="px-5 py-3 flex justify-between items-center border-b border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] text-amber-200/70 uppercase tracking-widest font-bold">{player?.toUpperCase()} • Saldo</span>
                  <span className={`text-2xl font-mono font-bold ${balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatPln(balance)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-fuchsia-300/80 uppercase tracking-widest font-bold">Skarbonka (Cashback)</span>
                  <button 
                    onClick={handleBreakPiggy}
                    disabled={piggyBank <= 0 || (now - lastPiggyBreak < 24 * 60 * 60 * 1000)}
                    className={`text-sm font-mono font-bold px-3 py-1 rounded-lg border transition-all ${piggyBank > 0 && (now - lastPiggyBreak >= 24 * 60 * 60 * 1000) ? 'bg-fuchsia-900/50 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_15px_rgba(217,70,239,0.5)]' : 'bg-transparent border-fuchsia-900 text-fuchsia-700'}`}
                  >
                    🐖 {formatPln(piggyBank)}
                  </button>
                </div>
              </div>
              {/* NAV BAR */}
              <div className="flex w-full px-2">
                {renderTabButton('scratch', '🎟️', 'Zdrapki')}
                {renderTabButton('crash', '📈', 'Crash')}
                {renderTabButton('slots', '🎰', 'Sloty')}
                {renderTabButton('plinko', '🛝', 'Plinko')}
              </div>
            </div>

            <div className="mt-[115px] w-full">
              {balance < 0 && (
                <div className="w-full bg-red-950/70 border border-red-500/60 text-red-200 rounded-2xl p-3 mb-5 text-xs text-center font-bold">
                  ⚠️ Jesteś na minusie! Graj ostrożnie albo rozbij Skarbonkę.
                </div>
              )}

              {/* TAB 1: ZDRAPKI */}
              {activeTab === 'scratch' && (
                activeTicket ? (
                  <div className={`w-full max-w-sm mx-auto rounded-3xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-4 ${activeTicket.ticket.accentBorder} animate-fade-in`}>
                    <div className={`${activeTicket.ticket.headerBg} p-5 text-center relative overflow-hidden`}>
                      <h2 className="text-3xl font-black uppercase text-white drop-shadow-lg relative z-10">{activeTicket.ticket.name}</h2>
                      <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest mt-1 relative z-10">Znajdź 3 takie same kwoty!</p>
                    </div>
                    <div className="bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')] bg-amber-50 p-6 relative flex flex-col items-center">
                      <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
                        {activeTicket.cells.map((amount, idx) => {
                          const isOpen = activeTicket.scratched[idx];
                          const isWinnerCell = activeTicket.settled && activeTicket.prize.amount > 0 && amount === activeTicket.prize.amount;
                          return (
                            <button key={idx} onClick={() => handleScratchCell(idx)} disabled={isOpen || activeTicket.settled} className={`relative h-20 rounded-xl overflow-hidden border-2 shadow-md ${isOpen ? (isWinnerCell ? 'border-emerald-600 bg-emerald-100 shadow-[inset_0_0_15px_rgba(16,185,129,0.3)]' : 'border-slate-300 bg-white') : 'border-slate-400 bg-slate-300'}`}>
                              {isOpen ? <div className={`flex items-center justify-center w-full h-full font-mono font-extrabold text-xl ${isWinnerCell ? 'text-emerald-700' : 'text-slate-800'}`}>{formatPln(amount)}</div> : <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/aluminum.png')] bg-gradient-to-tr from-slate-400 via-slate-200 to-slate-400 flex items-center justify-center">🪙</div>}
                            </button>
                          );
                        })}
                      </div>
                      {activeTicket.settled && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center p-6 z-20 text-center animate-fade-in">
                          <p className={`text-4xl font-black mb-6 ${activeTicket.prize.amount > 0 ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'text-slate-400'}`}>{activeTicket.prize.label}</p>
                          <button onClick={() => setActiveTicket(null)} className="bg-amber-500 text-black font-black py-4 px-8 rounded-xl text-sm uppercase shadow-xl hover:scale-105">Kolejna Zdrapka</button>
                        </div>
                      )}
                    </div>
                    {!activeTicket.settled && <div className="bg-black/90 p-3"><button onClick={handleRevealAll} className="w-full bg-white/10 text-slate-200 text-xs font-bold uppercase py-3 rounded-xl border border-white/15">Zdrap wszystko</button></div>}
                  </div>
                ) : (
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {TICKETS.map(t => (
                      <div key={t.id} className={`bg-gradient-to-br ${t.cardBg} border-2 ${t.accentBorder} rounded-3xl p-5 flex flex-col justify-between shadow-2xl`}>
                        <div>
                          <div className="flex justify-between items-center mb-2"><span className="text-[10px] uppercase text-amber-200/80 font-bold bg-black/30 px-2 py-1 rounded-lg">{t.badge}</span><span className="text-xl font-mono font-extrabold text-white bg-black/40 px-3 py-1 rounded-xl">{t.price} zł</span></div>
                          <h3 className="text-xl font-black uppercase text-white mb-1">{t.name}</h3>
                          <p className="text-[11px] text-slate-300 mb-5">Max: <strong className="text-amber-300 text-sm">{formatPln(Math.max(...t.prizes.map(p => p.amount)))}</strong></p>
                        </div>
                        <button onClick={() => handleBuyTicket(t)} className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black py-4 rounded-xl text-sm uppercase">Kup los</button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* TAB 2: CRASH */}
              {activeTab === 'crash' && (
                <div className="w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center">
                  <h2 className="text-xl font-black uppercase text-white mb-2">Wyprawa Mikołaja 📈</h2>
                  <p className="text-xs text-slate-400 mb-6">Wypłać zanim sanie runą! (Crash)</p>
                  
                  <div className={`h-48 border-2 rounded-2xl flex flex-col items-center justify-center mb-6 transition-colors ${crashStatus === 'crashed' ? 'border-red-500 bg-red-950/50' : crashStatus === 'cashed' ? 'border-emerald-500 bg-emerald-950/50' : 'border-blue-500/50 bg-black/50'}`}>
                    <div className={`text-6xl font-black font-mono transition-all ${crashStatus === 'crashed' ? 'text-red-500' : crashStatus === 'cashed' ? 'text-emerald-400' : 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-110'}`}>
                      {crashMultiplier.toFixed(2)}x
                    </div>
                    {crashStatus === 'crashed' && <p className="text-red-400 font-bold uppercase tracking-widest mt-2">Rozbił się!</p>}
                    {crashStatus === 'cashed' && <p className="text-emerald-400 font-bold uppercase tracking-widest mt-2">Wypłacono!</p>}
                    {crashStatus === 'playing' && <div className="text-4xl mt-4 animate-bounce">🛷💨</div>}
                  </div>

                  <div className="flex gap-4 mb-4">
                    {[5, 10, 25, 50, 100].map(v => (
                      <button key={v} onClick={() => setCrashBet(v)} disabled={crashStatus === 'playing'} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${crashBet === v ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>{v} zł</button>
                    ))}
                  </div>

                  {crashStatus !== 'playing' ? (
                    <button onClick={handleCrashStart} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-xl text-lg uppercase shadow-[0_0_20px_rgba(37,99,235,0.4)]">Postaw {crashBet} zł</button>
                  ) : (
                    <button onClick={handleCashout} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-5 rounded-xl text-lg uppercase shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse">Wypłać {formatPln(crashBet * crashMultiplier)}</button>
                  )}
                </div>
              )}

              {/* TAB 3: SLOTS */}
              {activeTab === 'slots' && (
                <div className="w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center">
                  <h2 className="text-xl font-black uppercase text-white mb-2">Świąteczny Bandyta 🎰</h2>
                  <p className="text-xs text-slate-400 mb-6">Traf 3 takie same pojazdy. Grinch to pudło!</p>
                  
                  <div className="flex gap-2 justify-center mb-8">
                    {reels.map((icon, i) => (
                      <div key={i} className={`w-24 h-28 bg-white border-4 border-slate-300 rounded-2xl flex items-center justify-center text-6xl shadow-inner ${isSpinning ? 'animate-pulse' : ''}`}>
                        {icon}
                      </div>
                    ))}
                  </div>

                  {slotResult && (
                    <div className={`mb-6 text-xl font-black uppercase tracking-widest ${slotResult.includes('Wygrana') ? 'text-emerald-400 animate-bounce' : 'text-red-400'}`}>
                      {slotResult}
                    </div>
                  )}

                  <div className="flex gap-4 mb-4">
                    {[2, 5, 10, 20].map(v => (
                      <button key={v} onClick={() => setSlotBet(v)} disabled={isSpinning} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${slotBet === v ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>{v} zł</button>
                    ))}
                  </div>

                  <button onClick={handleSlotSpin} disabled={isSpinning} className={`w-full font-black py-5 rounded-xl text-lg uppercase shadow-xl ${isSpinning ? 'bg-slate-600 text-slate-400' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
                    {isSpinning ? 'Kręcenie...' : `SPIN (${slotBet} zł)`}
                  </button>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                    {SLOT_SYMBOLS.map(s => <div key={s.id}>3x {s.icon} = {s.payout > 0 ? `x${s.payout}` : 'Pudło'}</div>)}
                  </div>
                </div>
              )}

              {/* TAB 4: PLINKO */}
              {activeTab === 'plinko' && (
                <div className="w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center">
                  <h2 className="text-xl font-black uppercase text-white mb-2">Plinko Na Mrozie 🛝</h2>
                  <p className="text-xs text-slate-400 mb-6">Zrzuć śnieżkę i módl się o boki!</p>
                  
                  <div className="relative w-full h-64 bg-black/40 border-2 border-slate-700 rounded-2xl mb-6 flex flex-col justify-end pb-2 overflow-hidden">
                    {/* WIZUALIZACJA PLINKO (bardzo uproszczona siatka dla klimatu) */}
                    <div className="absolute inset-0 flex flex-col justify-between pt-4 pb-12 opacity-30">
                      {Array.from({length: PLINKO_ROWS}).map((_, r) => (
                        <div key={r} className="flex justify-center gap-4">
                          {Array.from({length: r + 1}).map((_, c) => <div key={c} className="w-2 h-2 rounded-full bg-white"></div>)}
                        </div>
                      ))}
                    </div>

                    {/* SPADAJĄCA ŚNIEŻKA */}
                    {plinkoPath.length > 0 && plinkoStatus !== 'idle' && (
                      <div 
                        className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)] transition-all duration-200 z-10"
                        style={{ 
                          top: `${(plinkoPath[plinkoPath.length-1].r / PLINKO_ROWS) * 75}%`, 
                          left: `calc(50% + ${(plinkoPath[plinkoPath.length-1].c - (plinkoPath[plinkoPath.length-1].r/2)) * 15}%)`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      ></div>
                    )}

                    <div className="flex justify-center w-full gap-1 px-1 z-0 relative">
                      {PLINKO_MULTIPLIERS.map((m, i) => (
                        <div key={i} className={`flex-1 text-[10px] font-bold py-2 rounded-md ${m >= 5 ? 'bg-emerald-600 text-white' : m < 1 ? 'bg-red-600/50 text-red-200' : 'bg-amber-600/80 text-white'}`}>
                          {m}x
                        </div>
                      ))}
                    </div>
                  </div>

                  {plinkoResult && plinkoStatus === 'finished' && (
                    <div className={`mb-6 text-xl font-black uppercase tracking-widest ${plinkoResult >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Trafiono: {plinkoResult}x ({formatPln(plinkoBet * plinkoResult)})
                    </div>
                  )}

                  <div className="flex gap-4 mb-4">
                    {[5, 10, 25, 50].map(v => (
                      <button key={v} onClick={() => setPlinkoBet(v)} disabled={plinkoStatus === 'dropping'} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${plinkoBet === v ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>{v} zł</button>
                    ))}
                  </div>

                  <button onClick={handlePlinkoDrop} disabled={plinkoStatus === 'dropping'} className={`w-full font-black py-5 rounded-xl text-lg uppercase shadow-xl ${plinkoStatus === 'dropping' ? 'bg-slate-600 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                    {plinkoStatus === 'dropping' ? 'Leci...' : `Zrzut (${plinkoBet} zł)`}
                  </button>
                </div>
              )}

            </div>
            
            <div className="flex gap-3 w-full mt-6 mb-10">
              <button onClick={() => { setViewState('menu'); setPlayer(null); }} className="flex-1 bg-white/10 text-white/80 hover:text-white hover:bg-white/20 text-xs font-bold uppercase py-4 rounded-xl border border-white/10 transition-colors">Wyloguj</button>
              <Link to="/" className="flex-1 bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-bold uppercase py-4 rounded-xl border border-red-500/30 transition-colors flex justify-center items-center">Wyjście</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}