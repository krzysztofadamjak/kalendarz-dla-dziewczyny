import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import Snowfall from 'react-snowfall';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const START_BALANCE = 100; // zł na start

const TICKETS = [
  {
    id: 't3',
    name: 'Szczęśliwe 3 zł',
    price: 3,
    badge: 'Lekki start',
    accent: 'from-emerald-800/70 to-emerald-950/80 border-emerald-400/40',
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
    accent: 'from-red-800/70 to-red-950/80 border-red-400/40',
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
    accent: 'from-amber-800/70 to-amber-950/80 border-amber-400/50',
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
    accent: 'from-sky-800/70 to-slate-950/90 border-sky-400/50',
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

const formatPln = (val) => {
  const num = Math.round(val * 100) / 100;
  const sign = num < 0 ? '-' : '';
  return `${sign}${Math.abs(num).toLocaleString('pl-PL')} zł`;
};

export default function LottoScratch() {
  const { width, height } = useWindowSize();

  // 'menu', 'auth_setup', 'auth_login', 'loading', 'playing'
  const [viewState, setViewState] = useState('menu');
  const [player, setPlayer] = useState(null); // 'stary' lub 'stara'

  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [authError, setAuthError] = useState('');

  const [balance, setBalance] = useState(START_BALANCE);
  const [totalWon, setTotalWon] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [ticketsBought, setTicketsBought] = useState(0);
  const [bestWin, setBestWin] = useState(0);

  // Aktualnie kupiona zdrapka do zdrapania
  const [activeTicket, setActiveTicket] = useState(null); // { ticket, prize, revealedCells, isRevealed }
  const [showBigWinConfetti, setShowBigWinConfetti] = useState(false);

  const [leaderboard, setLeaderboard] = useState({
    stary: createFreshLottoDoc(0),
    stara: createFreshLottoDoc(0)
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "scratch_lotto"), (snapshot) => {
      const lb = {
        stary: createFreshLottoDoc(0),
        stara: createFreshLottoDoc(0)
      };
      snapshot.forEach((d) => {
        lb[d.id] = { ...lb[d.id], ...d.data() };
      });
      setLeaderboard(lb);
    });
    return () => unsub();
  }, []);

  const syncPlayerDoc = async (targetPlayer, patch) => {
    if (!targetPlayer) return;
    try {
      await setDoc(
        doc(db, "scratch_lotto", targetPlayer),
        { ...patch, lastUpdate: Date.now() },
        { merge: true }
      );
    } catch (e) {
      console.error("Błąd zapisu zdrapek:", e);
    }
  };

  const openPlayerSession = async (selectedPlayer, rawData) => {
    const d = rawData || createFreshLottoDoc();
    setBalance(typeof d.balance === 'number' ? d.balance : START_BALANCE);
    setTotalWon(d.totalWon || 0);
    setTotalSpent(d.totalSpent || 0);
    setTicketsBought(d.ticketsBought || 0);
    setBestWin(d.bestWin || 0);
    setActiveTicket(null);
    setViewState('playing');
  };

  const handleSelectPlayer = async (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setPinInput('');
    setPinConfirm('');
    setAuthError('');
    setViewState('loading');

    const docRef = doc(db, "scratch_lotto", selectedPlayer);
    const snap = await getDoc(docRef);
    let data = createFreshLottoDoc();
    if (snap.exists()) {
      data = { ...data, ...snap.data() };
    } else {
      await setDoc(docRef, data);
    }

    if (data.pin && String(data.pin).length > 0) {
      setViewState('auth_login');
    } else {
      setViewState('auth_setup');
    }
  };

  const handleSetPin = async () => {
    const cleanPin = pinInput.trim();
    const cleanConfirm = pinConfirm.trim();
    if (cleanPin.length < 4) {
      setAuthError('Hasło musi mieć co najmniej 4 znaki.');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setAuthError('Hasła nie są identyczne.');
      return;
    }
    setAuthError('');
    setViewState('loading');

    const docRef = doc(db, "scratch_lotto", player);
    const snap = await getDoc(docRef);
    const baseData = snap.exists() ? { ...createFreshLottoDoc(), ...snap.data() } : createFreshLottoDoc();
    const updated = { ...baseData, pin: cleanPin, lastUpdate: Date.now() };
    await setDoc(docRef, updated, { merge: true });

    setPinInput('');
    setPinConfirm('');
    await openPlayerSession(player, updated);
  };

  const handleLoginPin = async () => {
    setViewState('loading');
    const docRef = doc(db, "scratch_lotto", player);
    const snap = await getDoc(docRef);
    const baseData = snap.exists() ? { ...createFreshLottoDoc(), ...snap.data() } : createFreshLottoDoc();

    if (pinInput === baseData.pin) {
      setAuthError('');
      setPinInput('');
      await openPlayerSession(player, baseData);
    } else {
      setPinInput('');
      setAuthError('Nieprawidłowe hasło do konta!');
      setViewState('auth_login');
    }
  };

  const handleBuyTicket = async (ticket) => {
    if (!player || activeTicket) return;

    // Koszt zdrapki odejmujemy od razu – można zejść na minus
    const nextBalance = balance - ticket.price;
    const nextSpent = totalSpent + ticket.price;
    const nextBought = ticketsBought + 1;
    const wonPrize = rollPrize(ticket.prizes);

    // 6 pól zdrapki: 3 pola pokazują kwotę wygranej, 3 losowe kwoty z tabeli
    const decoyAmounts = ticket.prizes.map((p) => p.amount).filter((a) => a !== wonPrize.amount);
    const cells = Array.from({ length: 6 }, (_, idx) => {
      if (idx < 3) return wonPrize.amount;
      return decoyAmounts[Math.floor(Math.random() * decoyAmounts.length)] ?? 0;
    }).sort(() => Math.random() - 0.5);

    setBalance(nextBalance);
    setTotalSpent(nextSpent);
    setTicketsBought(nextBought);
    setActiveTicket({
      ticket,
      prize: wonPrize,
      cells,
      scratched: [false, false, false, false, false, false],
      settled: false
    });

    await syncPlayerDoc(player, {
      balance: nextBalance,
      totalSpent: nextSpent,
      ticketsBought: nextBought
    });
  };

  const finalizeTicketWin = async (currentActive) => {
    if (!currentActive || currentActive.settled) return;
    const prizeAmount = currentActive.prize.amount;
    const nextBalance = balance + prizeAmount;
    const nextWon = totalWon + prizeAmount;
    const nextBest = Math.max(bestWin, prizeAmount);

    setBalance(nextBalance);
    setTotalWon(nextWon);
    setBestWin(nextBest);

    if (prizeAmount >= 100) {
      setShowBigWinConfetti(true);
      setTimeout(() => setShowBigWinConfetti(false), 4000);
    }

    await syncPlayerDoc(player, {
      balance: nextBalance,
      totalWon: nextWon,
      bestWin: nextBest
    });
  };

  const handleScratchCell = async (idx) => {
    if (!activeTicket || activeTicket.scratched[idx] || activeTicket.settled) return;
    const nextScratched = [...activeTicket.scratched];
    nextScratched[idx] = true;

    const allDone = nextScratched.every(Boolean);
    const updated = { ...activeTicket, scratched: nextScratched, settled: allDone };
    setActiveTicket(updated);

    if (allDone) {
      await finalizeTicketWin(updated);
    }
  };

  const handleRevealAll = async () => {
    if (!activeTicket || activeTicket.settled) return;
    const updated = {
      ...activeTicket,
      scratched: [true, true, true, true, true, true],
      settled: true
    };
    setActiveTicket(updated);
    await finalizeTicketWin(updated);
  };

  const staryData = leaderboard.stary || createFreshLottoDoc(0);
  const staraData = leaderboard.stara || createFreshLottoDoc(0);

  const staryWon = staryData.totalWon || 0;
  const staraWon = staraData.totalWon || 0;
  const leaderText =
    staryWon === staraWon
      ? 'Remis w wygranych!'
      : staryWon > staraWon
      ? `Prowadzi Stary (+${formatPln(staryWon - staraWon)} wygranych)`
      : `Prowadzi Stara (+${formatPln(staraWon - staryWon)} wygranych)`;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-black p-4 flex flex-col items-center relative overflow-hidden font-sans select-none">
      <Snowfall color="#fde047" snowflakeCount={60} style={{ opacity: 0.3, zIndex: 0 }} />
      {showBigWinConfetti && (
        <Confetti width={width} height={height} recycle={false} numberOfPieces={400} colors={['#fde047', '#10b981', '#ef4444']} />
      )}

      <div className="z-10 w-full max-w-lg flex flex-col items-center pt-4 pb-20">
        {viewState === 'loading' && (
          <div className="mt-24 text-amber-300 font-bold animate-pulse text-lg">
            Łączenie z kontem...
          </div>
        )}

        {/* USTAWIENIE HASŁA DLA KONTA */}
        {viewState === 'auth_setup' && (
          <div className="w-full bg-black/65 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔐</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">
              Konto: {player?.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              Ustaw własne hasło (min. 4 znaki) do swojego konta zdrapek.
            </p>

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-3 text-lg tracking-widest focus:outline-none focus:border-amber-400"
              placeholder="Nowe hasło"
            />
            <input
              type="password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetPin()}
              className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400"
              placeholder="Powtórz hasło"
            />

            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}

            <button
              onClick={handleSetPin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl border border-emerald-400/50 transition-all mb-3"
            >
              Zapisz hasło i wejdź
            </button>
            <button
              onClick={() => { setViewState('menu'); setPlayer(null); }}
              className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10"
            >
              Wróć do wyboru konta
            </button>
          </div>
        )}

        {/* LOGOWANIE HASŁEM DO KONTA */}
        {viewState === 'auth_login' && (
          <div className="w-full bg-black/65 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔑</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">
              Logowanie: {player?.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              Podaj hasło do konta {player?.toUpperCase()}.
            </p>

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoginPin()}
              className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400"
              placeholder="Hasło konta"
            />

            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}

            <button
              onClick={handleLoginPin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl border border-blue-400/50 transition-all mb-3"
            >
              Zaloguj się
            </button>
            <button
              onClick={() => { setViewState('menu'); setPlayer(null); }}
              className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10"
            >
              Wróć do wyboru konta
            </button>
          </div>
        )}

        {/* MENU + TABELA DO 24 GRUDNIA */}
        {viewState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">
              Zdrapki Lotto 🎟️
            </h1>
            <p className="text-emerald-200/80 mb-6 italic text-xs md:text-sm text-center">
              Wyścig trwa do 24 grudnia! Kto wygra więcej na zdrapkach, zgarnia tytuł. Mozesz zejść na minus.
            </p>

            <div className="bg-black/45 border border-amber-400/30 rounded-3xl p-6 w-full mb-7 backdrop-blur-md shadow-xl">
              <h2 className="text-amber-300 font-bold tracking-widest uppercase mb-2 text-sm text-center">
                🏆 Tabela Wyników (do 24.12)
              </h2>
              <p className="text-xs text-center text-emerald-300 font-bold mb-5">{leaderText}</p>

              <div className="flex flex-col gap-4">
                <div className="bg-blue-950/40 border border-blue-400/30 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white uppercase tracking-wider text-base">
                      Stary {staryData.pin ? '🔒' : '🔓'}
                    </span>
                    <span className="text-xl font-mono font-bold text-amber-300">
                      Wygrane: {formatPln(staryWon)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className={staryData.balance < 0 ? 'text-red-400 font-bold' : 'text-emerald-300'}>
                      Saldo: {formatPln(staryData.balance ?? START_BALANCE)}
                    </span>
                    <span>Losów: {staryData.ticketsBought || 0} • Max: {formatPln(staryData.bestWin || 0)}</span>
                  </div>
                </div>

                <div className="bg-pink-950/40 border border-pink-400/30 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white uppercase tracking-wider text-base">
                      Stara {staraData.pin ? '🔒' : '🔓'}
                    </span>
                    <span className="text-xl font-mono font-bold text-amber-300">
                      Wygrane: {formatPln(staraWon)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className={staraData.balance < 0 ? 'text-red-400 font-bold' : 'text-emerald-300'}>
                      Saldo: {formatPln(staraData.balance ?? START_BALANCE)}
                    </span>
                    <span>Losów: {staraData.ticketsBought || 0} • Max: {formatPln(staraData.bestWin || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wybierz gracza:</h3>
            <div className="flex gap-4 w-full">
              <button
                onClick={() => handleSelectPlayer('stary')}
                className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 text-white font-bold py-5 rounded-2xl border border-blue-400/50 shadow-lg transition-all text-xl uppercase"
              >
                Stary
              </button>
              <button
                onClick={() => handleSelectPlayer('stara')}
                className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 text-white font-bold py-5 rounded-2xl border border-pink-400/50 shadow-lg transition-all text-xl uppercase"
              >
                Stara
              </button>
            </div>

            <Link
              to="/"
              className="mt-10 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1"
            >
              Wróć do Kalendarza
            </Link>
          </div>
        )}

        {/* EKRAN ZDRAPEK */}
        {viewState === 'playing' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <div className="bg-black/65 backdrop-blur-xl border-b border-amber-500/30 w-screen fixed top-0 left-0 px-4 py-3 flex justify-between items-center z-20 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-200/70 uppercase tracking-widest font-bold">
                  {player?.toUpperCase()} • Saldo
                </span>
                <span className={`text-2xl font-mono font-bold ${balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatPln(balance)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-amber-300/80 uppercase tracking-widest font-bold">
                  Łącznie wygrano
                </span>
                <span className="text-lg font-mono font-bold text-amber-300">
                  {formatPln(totalWon)}
                </span>
              </div>
            </div>

            <div className="mt-20 w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 mb-5 flex justify-between text-xs text-slate-300">
              <span>Kupione losy: <strong className="text-white">{ticketsBought}</strong></span>
              <span>Wydane: <strong className="text-white">{formatPln(totalSpent)}</strong></span>
              <span>Najwyższa: <strong className="text-amber-300">{formatPln(bestWin)}</strong></span>
            </div>

            {balance < 0 && (
              <div className="w-full bg-red-950/70 border border-red-500/60 text-red-200 rounded-2xl p-3 mb-5 text-xs text-center font-bold">
                ⚠️ Jesteś na minusie ({formatPln(balance)}). Możesz grać dalej i odrabiać straty!
              </div>
            )}

            {/* AKTYWNA ZDRAPKA DO ZDRAPANIA */}
            {activeTicket ? (
              <div className="w-full bg-black/60 border-2 border-amber-400/60 rounded-3xl p-6 mb-6 text-center shadow-2xl">
                <p className="text-xs uppercase tracking-widest text-amber-300 font-bold mb-1">
                  {activeTicket.ticket.name} ({activeTicket.ticket.price} zł)
                </p>
                <p className="text-xs text-slate-300 mb-4">
                  Klikaj pola, aby zdrapać warstwy!
                </p>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {activeTicket.cells.map((amount, idx) => {
                    const isOpen = activeTicket.scratched[idx];
                    return (
                      <button
                        key={idx}
                        onClick={() => handleScratchCell(idx)}
                        className={`h-24 rounded-2xl border font-bold flex flex-col items-center justify-center transition-all ${
                          isOpen
                            ? 'bg-amber-50 text-red-950 border-amber-400 shadow-inner'
                            : 'bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 text-black border-amber-300 shadow-lg cursor-pointer active:scale-95'
                        }`}
                      >
                        {isOpen ? (
                          <span className="text-lg font-mono font-extrabold">{formatPln(amount)}</span>
                        ) : (
                          <>
                            <span className="text-2xl mb-1">🪙</span>
                            <span className="text-[10px] uppercase tracking-wider">Zdrap</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>

                {!activeTicket.settled ? (
                  <button
                    onClick={handleRevealAll}
                    className="w-full bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold uppercase py-3 rounded-xl border border-white/15"
                  >
                    Zdrap od razu wszystkie pola
                  </button>
                ) : (
                  <div className="bg-emerald-950/60 border border-emerald-400/40 rounded-2xl p-4">
                    <p className="text-sm font-bold text-white mb-1">
                      Wynik losu: <span className="text-amber-300">{activeTicket.prize.label}</span>
                    </p>
                    <p className="text-xs text-slate-300 mb-4">
                      {activeTicket.prize.amount > 0
                        ? `Dopisałem ${formatPln(activeTicket.prize.amount)} do Twojego salda i wygranych!`
                        : 'Tym razem bez wygranej – spróbuj kolejny los.'}
                    </p>
                    <button
                      onClick={() => setActiveTicket(null)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider"
                    >
                      Wybierz kolejną zdrapkę
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* SKLEPIK ZE ZDRAPKAMI */
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
                {TICKETS.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-gradient-to-br ${t.accent} backdrop-blur-md border rounded-2xl p-4 flex flex-col justify-between shadow-xl`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase tracking-widest text-amber-200/80 font-bold">
                          {t.badge}
                        </span>
                        <span className="text-sm font-mono font-extrabold text-amber-300">
                          {t.price} zł
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{t.name}</h3>
                      <p className="text-[11px] text-slate-200/85 mb-4">
                        Max wygrana: <strong className="text-amber-200">{formatPln(Math.max(...t.prizes.map((p) => p.amount)))}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => handleBuyTicket(t)}
                      className="w-full bg-black/45 hover:bg-black/65 text-white font-bold py-3 rounded-xl border border-white/15 text-xs uppercase tracking-wider transition-all"
                    >
                      Kup zdrapkę ({t.price} zł)
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={() => { setViewState('menu'); setPlayer(null); setActiveTicket(null); }}
                className="flex-1 bg-white/10 text-white/80 hover:text-white hover:bg-white/20 text-xs font-bold uppercase py-4 rounded-xl border border-white/10 transition-colors"
              >
                Zmień konto / Tabela
              </button>
              <Link
                to="/"
                className="flex-1 bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-bold uppercase py-4 rounded-xl border border-red-500/30 transition-colors flex justify-center items-center"
              >
                Wyjście
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}