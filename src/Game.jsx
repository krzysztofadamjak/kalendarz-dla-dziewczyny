import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import Snowfall from 'react-snowfall';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const RESET_FLAG_KEY = 'factory_hard_reset_v5_2026';

const UPGRADES = {
  elf: {
    id: 'elf',
    name: 'Scenic',
    baseCost: 90,
    cps: 1,
    upkeepPerMin: 2,
    repairCost: 220,
    faultLabel: 'Usterka elektroniki w Scenicu',
    icon: '🚐',
    desc: '+1 Magia/s • Utrzymanie: 2/min'
  },
  reindeer: {
    id: 'reindeer',
    name: 'Meganka',
    baseCost: 1400,
    cps: 9,
    upkeepPerMin: 22,
    repairCost: 2400,
    faultLabel: 'Wyciek w Megance',
    icon: '🚗',
    desc: '+9 Magii/s • Utrzymanie: 22/min'
  },
  maverick: {
    id: 'maverick',
    name: 'Maverick w LPG',
    baseCost: 12000,
    cps: 55,
    upkeepPerMin: 140,
    repairCost: 16500,
    faultLabel: 'Zatkany katalizator w Mavericku',
    icon: '🛻',
    desc: '+55 Magii/s • Utrzymanie: 140/min'
  },
  lexus: {
    id: 'lexus',
    name: 'Lexus Hybryda',
    baseCost: 85000,
    cps: 260,
    upkeepPerMin: 720,
    repairCost: 95000,
    faultLabel: 'Błąd falownika hybrydy w Lexusie',
    icon: '🏎️',
    desc: '+260 Magii/s • Utrzymanie: 720/min'
  }
};

const GLOVES_BASE_COST = 750;
const CASINO_COST = 4500;
const CASINO_COOLDOWN_MS = 3 * 60 * 60 * 1000;
const PRESTIGE_THRESHOLD = 240000;
const SHIELD_COST = 6000;
const SHIELD_DURATION_MS = 20 * 60 * 1000;
const TRAP_COST = 5500;
const TRAP_DURATION_MS = 25 * 60 * 1000;
const RECON_COST = 2400;
const TENDER_COST = 25000;

const QUEST_TEMPLATES = [
  { id: 'taps_600', title: 'Odmrażanie palców', target: 600, reward: 1100, field: 'sessionTaps' },
  { id: 'buys_5', title: 'Kosmiczny serwis', target: 5, reward: 3200, field: 'sessionBuys' },
  { id: 'spins_2', title: 'Stały bywalec Kasyna', target: 2, reward: 4200, field: 'sessionSpins' },
  { id: 'taps_1400', title: 'Żelazny nadgarstek', target: 1400, reward: 5200, field: 'sessionTaps' }
];

const HARDCORE_CONTRACTS = [
  {
    id: 'sprint_1200',
    title: 'Szybki rozruch',
    desc: 'Nabij 1200 kliknięć w 7 minut.',
    durationMs: 7 * 60 * 1000,
    targetTaps: 1200,
    rewardMagic: 11000,
    penaltyMagic: 5500
  },
  {
    id: 'marathon_2400',
    title: 'Maraton na mrozie',
    desc: 'Nabij 2400 kliknięć w 14 minut.',
    durationMs: 14 * 60 * 1000,
    targetTaps: 2400,
    rewardMagic: 24000,
    penaltyMagic: 11500
  }
];

const ACHIEVEMENTS = [
  { id: 'taps_2000', name: 'Rozgrzany Palec', icon: '👆', desc: 'Kliknij prezent 2000 razy.', check: (s) => (s.taps || 0) >= 2000 },
  { id: 'taps_8000', name: 'Weteran Klikania', icon: '⚡', desc: 'Kliknij prezent 8000 razy.', check: (s) => (s.taps || 0) >= 8000 },
  { id: 'magic_200k', name: 'Świąteczny Przedsiębiorca', icon: '💼', desc: 'Zbierz łącznie 200 000 Magii.', check: (s) => (s.totalMagicEarned || 0) >= 200000 },
  { id: 'magic_1m', name: 'Magnat Bieguna', icon: '💰', desc: 'Zbierz łącznie 1 000 000 Magii.', check: (s) => (s.totalMagicEarned || 0) >= 1000000 },
  { id: 'maverick_25', name: 'Konwój na LPG', icon: '🛻', desc: 'Posiadaj 25 Mavericków w LPG.', check: (s) => (s.maverick || 0) >= 25 },
  { id: 'saboteur_12', name: 'Mistrz Sabotażu', icon: '🧌', desc: 'Wykonaj 12 akcji specjalnych na rywalu.', check: (s) => (s.actionsUsed || 0) >= 12 },
  { id: 'prestige_3', name: 'Potrójny Dzwonek', icon: '🔔', desc: 'Zdobądź łącznie 3 Złote Dzwonki.', check: (s) => (s.bells || 0) >= 3 }
];

const emptyFaults = () => ({ elf: false, reindeer: false, maverick: false, lexus: false });

const createFreshPlayerDoc = (ts = Date.now()) => ({
  pin: '',
  magic: 0,
  elf: 0,
  reindeer: 0,
  maverick: 0,
  lexus: 0,
  faults: emptyFaults(),
  glovesLevel: 0,
  bells: 0,
  taps: 0,
  totalMagicEarned: 0,
  actionsUsed: 0,
  casinoLastSpin: 0,
  achievements: [],
  frozenUntil: 0,
  boostUntil: 0,
  icedUntil: 0,
  shieldUntil: 0,
  trapUntil: 0,
  underfunded: false,
  lastUpdate: ts
});

export default function Game() {
  const { width, height } = useWindowSize();

  // STANY: 'menu', 'auth_setup', 'auth_login', 'manual', 'loading', 'playing'
  const [gameState, setGameState] = useState('menu');
  const [manualReturnState, setManualReturnState] = useState('menu');
  const [player, setPlayer] = useState(null);

  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [authError, setAuthError] = useState('');

  const [magic, setMagic] = useState(0);
  const [inventory, setInventory] = useState({ elf: 0, reindeer: 0, maverick: 0, lexus: 0 });
  const [faults, setFaults] = useState(emptyFaults());
  const [glovesLevel, setGlovesLevel] = useState(0);
  const [bells, setBells] = useState(0);
  const [casinoLastSpin, setCasinoLastSpin] = useState(0);
  const [shieldUntil, setShieldUntil] = useState(0);
  const [trapUntil, setTrapUntil] = useState(0);
  const [underfunded, setUnderfunded] = useState(false);
  const [stats, setStats] = useState({ taps: 0, totalMagicEarned: 0, actionsUsed: 0, achievements: [] });

  // SERIA KLIKNIĘĆ (COMBO)
  const [comboCount, setComboCount] = useState(0);
  const [lastTapTs, setLastTapTs] = useState(0);

  const [questIndex, setQuestIndex] = useState(0);
  const [questProgress, setQuestProgress] = useState({ sessionTaps: 0, sessionBuys: 0, sessionSpins: 0 });

  const [activeContract, setActiveContract] = useState(null);
  const [reconReport, setReconReport] = useState(null);
  const [eventsLog, setEventsLog] = useState([]);

  const [leaderboard, setLeaderboard] = useState({
    stary: createFreshPlayerDoc(0),
    stara: createFreshPlayerDoc(0)
  });

  const [offlineSummary, setOfflineSummary] = useState(null);
  const [frenzyUntil, setFrenzyUntil] = useState(0);
  const [goldenReindeer, setGoldenReindeer] = useState(null);
  const [actionToast, setActionToast] = useState('');
  const [celebrateMedal, setCelebrateMedal] = useState(null);
  const [now, setNow] = useState(Date.now());

  const stateRef = useRef({ magic, inventory, faults, glovesLevel, bells, casinoLastSpin, shieldUntil, trapUntil, underfunded, stats, player });
  useEffect(() => {
    stateRef.current = { magic, inventory, faults, glovesLevel, bells, casinoLastSpin, shieldUntil, trapUntil, underfunded, stats, player };
  }, [magic, inventory, faults, glovesLevel, bells, casinoLastSpin, shieldUntil, trapUntil, underfunded, stats, player]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset serii kliknięć przy bezczynności > 2.2s
  useEffect(() => {
    if (comboCount === 0) return;
    const checkCombo = setInterval(() => {
      if (Date.now() - lastTapTs > 2200) {
        setComboCount(0);
      }
    }, 500);
    return () => clearInterval(checkCombo);
  }, [comboCount, lastTapTs]);

  // Twardy reset v5 + nasłuch rankingu i dziennika zdarzeń
  useEffect(() => {
    let active = true;
    let unsubPlayers = null;
    let unsubLog = null;

    const syncAndMaybeReset = async () => {
      const currentNow = Date.now();
      if (!localStorage.getItem(RESET_FLAG_KEY)) {
        try {
          const fresh = createFreshPlayerDoc(currentNow);
          await Promise.all([
            setDoc(doc(db, "factory", "stary"), fresh),
            setDoc(doc(db, "factory", "stara"), fresh),
            setDoc(doc(db, "factory", "events_log"), {
              items: [{ id: currentNow, text: '🔥 Rozpoczęto nowy sezon Ultra Hardcore w Fabryce Mikołaja!' }]
            })
          ]);
          localStorage.setItem(RESET_FLAG_KEY, 'done');
        } catch (e) {}
      }

      if (!active) return;
      unsubPlayers = onSnapshot(collection(db, "factory"), (snapshot) => {
        const lb = {
          stary: createFreshPlayerDoc(0),
          stara: createFreshPlayerDoc(0)
        };
        snapshot.forEach(d => {
          if (d.id === 'events_log') {
            setEventsLog(Array.isArray(d.data().items) ? d.data().items : []);
          } else {
            const data = d.data();
            lb[d.id] = {
              ...lb[d.id],
              ...data,
              faults: { ...emptyFaults(), ...(data.faults || {}) }
            };
          }
        });
        setLeaderboard(lb);
      });
    };

    syncAndMaybeReset();
    return () => {
      active = false;
      if (unsubPlayers) unsubPlayers();
      if (unsubLog) unsubLog();
    };
  }, []);

  const pushEventLog = async (text) => {
    const entry = { id: Date.now() + Math.random(), text };
    const nextList = [entry, ...eventsLog].slice(0, 8);
    setEventsLog(nextList);
    try {
      await setDoc(doc(db, "factory", "events_log"), { items: nextList }, { merge: true });
    } catch (e) {}
  };

  const openManual = (returnTo) => {
    setManualReturnState(returnTo || gameState);
    setGameState('manual');
  };

  const opponent = player === 'stary' ? 'stara' : 'stary';
  const myData = player ? leaderboard[player] : null;
  const isFrozen = !!(myData && myData.frozenUntil && myData.frozenUntil > now);
  const hasChocolateBoost = !!(myData && myData.boostUntil && myData.boostUntil > now);
  const isIced = !!(myData && myData.icedUntil && myData.icedUntil > now);
  const hasShield = shieldUntil > now || !!(myData && myData.shieldUntil && myData.shieldUntil > now);
  const hasTrap = trapUntil > now || !!(myData && myData.trapUntil && myData.trapUntil > now);
  const hasFrenzy = frenzyUntil > now;

  const getUpkeepPerMin = (inv = inventory) => {
    return (inv.elf * UPGRADES.elf.upkeepPerMin) +
           (inv.reindeer * UPGRADES.reindeer.upkeepPerMin) +
           (inv.maverick * UPGRADES.maverick.upkeepPerMin) +
           (inv.lexus * UPGRADES.lexus.upkeepPerMin);
  };

  const getBaseCPS = (inv = inventory, flt = faults, bellCount = bells, isLowFuel = underfunded) => {
    const raw = (!flt.elf ? inv.elf * UPGRADES.elf.cps : 0) +
                (!flt.reindeer ? inv.reindeer * UPGRADES.reindeer.cps : 0) +
                (!flt.maverick ? inv.maverick * UPGRADES.maverick.cps : 0) +
                (!flt.lexus ? inv.lexus * UPGRADES.lexus.cps : 0);
    const prestigeMult = 1 + (bellCount * 0.06);
    const fuelMult = isLowFuel ? 0.45 : 1;
    return Math.floor(raw * prestigeMult * fuelMult);
  };

  const getCurrentCPS = () => {
    if (isFrozen) return 0;
    let mult = 1;
    if (hasChocolateBoost) mult *= 2;
    if (hasFrenzy) mult *= 4;
    return Math.floor(getBaseCPS() * mult);
  };

  const getComboBonus = (currentCombo = comboCount) => {
    if (currentCombo >= 25) return 3;
    if (currentCombo >= 12) return 1;
    return 0;
  };

  const getTapPower = (currentCombo = comboCount) => {
    if (isIced) return 1;
    const baseCps = getBaseCPS();
    const passiveBonus = Math.floor(baseCps * 0.006 * glovesLevel);
    const power = Math.floor((1 + (glovesLevel * 0.9) + passiveBonus + getComboBonus(currentCombo)) * (1 + (bells * 0.06)));
    const mult = hasFrenzy ? 4 : 1;
    return Math.max(1, power * mult);
  };

  const getCost = (id) => Math.floor(UPGRADES[id].baseCost * Math.pow(1.31, inventory[id]));
  const getGlovesCost = () => Math.floor(GLOVES_BASE_COST * Math.pow(1.65, glovesLevel));

  const showToast = (msg) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4200);
  };

  // Kontrola wygaśnięcia Kontraktu Hardcore
  useEffect(() => {
    if (!activeContract || gameState !== 'playing') return;
    if (now >= activeContract.expiresAt) {
      const penalty = Math.min(stateRef.current.magic, activeContract.penaltyMagic);
      const nextMagic = Math.max(0, stateRef.current.magic - penalty);
      setMagic(nextMagic);
      setActiveContract(null);
      showToast(`Kontrakt "${activeContract.title}" nieudany! Kara: -${penalty} ✨`);
      if (player) {
        updateDoc(doc(db, "factory", player), { magic: nextMagic, lastUpdate: Date.now() }).catch(() => {});
      }
    }
  }, [now, activeContract, gameState, player]);

  // Losowa awaria pojazdu
  useEffect(() => {
    if (gameState !== 'playing' || !player) return;
    const faultTimer = setInterval(async () => {
      const snap = stateRef.current;
      const ownedIds = Object.keys(UPGRADES).filter(k => (snap.inventory[k] || 0) > 0 && !snap.faults[k]);
      if (ownedIds.length === 0) return;
      if (Math.random() < 0.36) {
        const chosen = ownedIds[Math.floor(Math.random() * ownedIds.length)];
        const nextFaults = { ...snap.faults, [chosen]: true };
        setFaults(nextFaults);
        showToast(`Awaria! ${UPGRADES[chosen].faultLabel} – brak produkcji do naprawy!`);
        try {
          await updateDoc(doc(db, "factory", snap.player), { faults: nextFaults });
        } catch (e) {}
      }
    }, 50000);
    return () => clearInterval(faultTimer);
  }, [gameState, player]);

  const evaluateAchievements = async (candidateStats, currentInv, currentBells = bells) => {
    const ctx = { ...candidateStats, ...currentInv, bells: currentBells };
    const unlockedIds = new Set(candidateStats.achievements || []);
    let newlyUnlocked = null;

    for (const ach of ACHIEVEMENTS) {
      if (!unlockedIds.has(ach.id) && ach.check(ctx)) {
        unlockedIds.add(ach.id);
        newlyUnlocked = ach;
      }
    }

    if (newlyUnlocked) {
      const updatedList = Array.from(unlockedIds);
      const nextStats = { ...candidateStats, achievements: updatedList };
      setStats(nextStats);
      setCelebrateMedal(newlyUnlocked);
      setTimeout(() => setCelebrateMedal(null), 4000);
      if (player) {
        try {
          await updateDoc(doc(db, "factory", player), { achievements: updatedList });
        } catch (e) {}
      }
      return nextStats;
    }
    return candidateStats;
  };

  const loadPlayerSession = async (selectedPlayer, rawData, currentNow) => {
    const d = rawData || createFreshPlayerDoc(currentNow);
    const savedInv = {
      elf: d.elf || 0,
      reindeer: d.reindeer || 0,
      maverick: d.maverick || 0,
      lexus: d.lexus || 0
    };
    const savedFaults = { ...emptyFaults(), ...(d.faults || {}) };
    const savedGloves = d.glovesLevel || 0;
    const savedBells = d.bells || 0;
    const savedSpin = d.casinoLastSpin || 0;
    const savedShield = d.shieldUntil || 0;
    const savedTrap = d.trapUntil || 0;
    const savedStats = {
      taps: d.taps || 0,
      totalMagicEarned: d.totalMagicEarned || d.magic || 0,
      actionsUsed: d.actionsUsed || 0,
      achievements: d.achievements || []
    };

    setInventory(savedInv);
    setFaults(savedFaults);
    setGlovesLevel(savedGloves);
    setBells(savedBells);
    setCasinoLastSpin(savedSpin);
    setShieldUntil(savedShield);
    setTrapUntil(savedTrap);
    setStats(savedStats);

    const lastTs = d.lastUpdate || currentNow;
    const wasFrozen = d.frozenUntil && d.frozenUntil > lastTs;
    const effectiveEnd = wasFrozen ? Math.min(currentNow, d.frozenUntil) : currentNow;
    const diffSeconds = Math.max(0, Math.floor((effectiveEnd - lastTs) / 1000));
    const elapsedMinutes = Math.floor(Math.max(0, currentNow - lastTs) / 60000);

    const upkeepPerMin = getUpkeepPerMin(savedInv);
    const totalUpkeep = elapsedMinutes * upkeepPerMin;

    const rawCps = (!savedFaults.elf ? savedInv.elf * UPGRADES.elf.cps : 0) +
                   (!savedFaults.reindeer ? savedInv.reindeer * UPGRADES.reindeer.cps : 0) +
                   (!savedFaults.maverick ? savedInv.maverick * UPGRADES.maverick.cps : 0) +
                   (!savedFaults.lexus ? savedInv.lexus * UPGRADES.lexus.cps : 0);
    const prestigeMult = 1 + (savedBells * 0.06);
    const mult = (d.boostUntil && d.boostUntil > currentNow) ? 2 : 1;
    const grossEarned = wasFrozen ? 0 : Math.floor(diffSeconds * rawCps * prestigeMult * mult);

    let finalMagic = (d.magic || 0) + grossEarned - totalUpkeep;
    let isLow = false;
    if (finalMagic < 0) {
      finalMagic = 0;
      isLow = true;
    }

    const updatedTotal = savedStats.totalMagicEarned + grossEarned;
    setMagic(finalMagic);
    setUnderfunded(isLow);
    const nextStats = { ...savedStats, totalMagicEarned: updatedTotal };
    setStats(nextStats);

    if (grossEarned > 0 || totalUpkeep > 0) {
      setOfflineSummary({ earned: grossEarned, upkeep: totalUpkeep, isLow });
    } else {
      setOfflineSummary(null);
    }

    await updateDoc(doc(db, "factory", selectedPlayer), {
      magic: finalMagic,
      totalMagicEarned: updatedTotal,
      underfunded: isLow,
      lastUpdate: currentNow
    });

    await evaluateAchievements(nextStats, savedInv, savedBells);
    setGameState('playing');
  };

  const handleSelectPlayer = async (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setPinInput('');
    setPinConfirm('');
    setAuthError('');
    setReconReport(null);
    setGameState('loading');

    const currentNow = Date.now();
    const docRef = doc(db, "factory", selectedPlayer);
    const docSnap = await getDoc(docRef);

    let data = createFreshPlayerDoc(currentNow);
    if (docSnap.exists()) {
      data = { ...data, ...docSnap.data() };
    } else {
      await setDoc(docRef, data);
    }

    if (data.pin && String(data.pin).length > 0) {
      setGameState('auth_login');
    } else {
      setGameState('auth_setup');
    }
  };

  const handleSetAccountPin = async () => {
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
    setGameState('loading');
    const currentNow = Date.now();
    const docRef = doc(db, "factory", player);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? docSnap.data() : createFreshPlayerDoc(currentNow);

    await setDoc(docRef, { ...existing, pin: cleanPin, lastUpdate: currentNow }, { merge: true });
    setPinInput('');
    setPinConfirm('');
    await loadPlayerSession(player, { ...existing, pin: cleanPin }, currentNow);
  };

  const handleLoginAccountPin = async () => {
    setGameState('loading');
    const currentNow = Date.now();
    const docRef = doc(db, "factory", player);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? docSnap.data() : createFreshPlayerDoc(currentNow);

    if (pinInput === existing.pin) {
      setAuthError('');
      setPinInput('');
      await loadPlayerSession(player, existing, currentNow);
    } else {
      setPinInput('');
      setAuthError('Nieprawidłowe hasło do konta!');
      setGameState('auth_login');
    }
  };

  const handleLogoutToMenu = () => {
    setGameState('menu');
    setPlayer(null);
    setActiveContract(null);
    setReconReport(null);
    setComboCount(0);
    setPinInput('');
    setPinConfirm('');
    setAuthError('');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      const cps = getCurrentCPS();
      if (cps > 0) {
        setMagic(prev => prev + cps);
        setStats(prev => {
          const next = { ...prev, totalMagicEarned: (prev.totalMagicEarned || 0) + cps };
          evaluateAchievements(next, stateRef.current.inventory, stateRef.current.bells);
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, inventory, faults, bells, underfunded, isFrozen, hasChocolateBoost, hasFrenzy]);

  useEffect(() => {
    if (gameState !== 'playing' || !player) return;
    const upkeepTimer = setInterval(async () => {
      const snap = stateRef.current;
      const costPerMin = getUpkeepPerMin(snap.inventory);
      if (costPerMin <= 0) return;

      setMagic(prev => {
        if (prev >= costPerMin) {
          setUnderfunded(false);
          return prev - costPerMin;
        }
        setUnderfunded(true);
        showToast(`Brakuje Magii na utrzymanie floty (-${costPerMin}/min)! Produkcja spadła o 55%! ⚠️`);
        return 0;
      });
    }, 60000);
    return () => clearInterval(upkeepTimer);
  }, [gameState, player]);

  useEffect(() => {
    if (gameState !== 'playing' || !player) return;
    const saveTimer = setInterval(async () => {
      const snap = stateRef.current;
      try {
        await updateDoc(doc(db, "factory", snap.player), {
          magic: snap.magic,
          totalMagicEarned: snap.stats.totalMagicEarned,
          taps: snap.stats.taps,
          underfunded: snap.underfunded,
          lastUpdate: Date.now()
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [gameState, player]);

  useEffect(() => {
    if (gameState !== 'playing') {
      setGoldenReindeer(null);
      return;
    }
    let hideTimeout;
    const scheduleReindeer = () => {
      const delay = 80000 + Math.floor(Math.random() * 80000);
      return setTimeout(() => {
        setGoldenReindeer({
          top: 24 + Math.floor(Math.random() * 42),
          left: 12 + Math.floor(Math.random() * 68)
        });
        hideTimeout = setTimeout(() => {
          setGoldenReindeer(null);
        }, 3200);
        nextSpawn = scheduleReindeer();
      }, delay);
    };
    let nextSpawn = scheduleReindeer();
    return () => {
      clearTimeout(nextSpawn);
      clearTimeout(hideTimeout);
    };
  }, [gameState]);

  const advanceQuestIfDone = async (nextProgress, currentMagic) => {
    const activeQuest = QUEST_TEMPLATES[questIndex];
    const currentVal = nextProgress[activeQuest.field] || 0;
    if (currentVal >= activeQuest.target) {
      const reward = activeQuest.reward;
      const nextMagic = currentMagic + reward;
      const nextTotal = (stats.totalMagicEarned || 0) + reward;
      setMagic(nextMagic);
      setUnderfunded(false);
      const nextStats = { ...stats, totalMagicEarned: nextTotal };
      setStats(nextStats);
      setQuestProgress({ sessionTaps: 0, sessionBuys: 0, sessionSpins: 0 });
      setQuestIndex((prev) => (prev + 1) % QUEST_TEMPLATES.length);
      showToast(`Zlecenie "${activeQuest.title}" ukończone! +${reward} Magii 📦`);
      await evaluateAchievements(nextStats, inventory, bells);
      if (player) {
        try {
          await updateDoc(doc(db, "factory", player), {
            magic: nextMagic,
            totalMagicEarned: nextTotal,
            underfunded: false,
            lastUpdate: Date.now()
          });
        } catch (e) {}
      }
      return nextMagic;
    }
    return currentMagic;
  };

  const handleCatchReindeer = async () => {
    if (!goldenReindeer) return;
    setGoldenReindeer(null);
    if (Math.random() < 0.45) {
      const instantBonus = Math.max(300, getBaseCPS() * 50);
      const nextMagic = magic + instantBonus;
      const nextTotal = (stats.totalMagicEarned || 0) + instantBonus;
      setMagic(nextMagic);
      setUnderfunded(false);
      const nextStats = { ...stats, totalMagicEarned: nextTotal };
      setStats(nextStats);
      showToast(`Złoty Renifer! +${instantBonus} Magii! 🦌✨`);
      await pushEventLog(`🦌 ${player?.toUpperCase()} złapał Złotego Renifera (+${instantBonus} ✨).`);
      await evaluateAchievements(nextStats, inventory, bells);
      if (player) {
        try {
          await updateDoc(doc(db, "factory", player), {
            magic: nextMagic,
            totalMagicEarned: nextTotal,
            underfunded: false,
            lastUpdate: Date.now()
          });
        } catch (e) {}
      }
    } else {
      setFrenzyUntil(Date.now() + 14000);
      showToast("GORĄCZKA ŚWIĄT! x4 produkcji i kliknięć przez 14s! 🔥");
    }
  };

  const handleTap = async () => {
    const tapNow = Date.now();
    const nextCombo = (tapNow - lastTapTs <= 2200) ? comboCount + 1 : 1;
    setComboCount(nextCombo);
    setLastTapTs(tapNow);

    const gain = getTapPower(nextCombo);
    const nextMagic = magic + gain;
    setMagic(nextMagic);
    if (underfunded && nextMagic >= getUpkeepPerMin()) {
      setUnderfunded(false);
    }

    const nextTapsCount = (stats.taps || 0) + 1;
    const nextStats = {
      ...stats,
      taps: nextTapsCount,
      totalMagicEarned: (stats.totalMagicEarned || 0) + gain
    };
    setStats(nextStats);

    let magicAfterContract = nextMagic;
    let totalAfterContract = nextStats.totalMagicEarned;
    if (activeContract) {
      const doneTaps = nextTapsCount - activeContract.startTaps;
      if (doneTaps >= activeContract.targetTaps && Date.now() < activeContract.expiresAt) {
        magicAfterContract = nextMagic + activeContract.rewardMagic;
        totalAfterContract += activeContract.rewardMagic;
        setMagic(magicAfterContract);
        setStats(prev => ({ ...prev, totalMagicEarned: totalAfterContract }));
        setActiveContract(null);
        showToast(`Kontrakt "${activeContract.title}" wykonany! +${activeContract.rewardMagic} ✨`);
      }
    }

    const nextProg = { ...questProgress, sessionTaps: questProgress.sessionTaps + 1 };
    setQuestProgress(nextProg);

    await evaluateAchievements({ ...nextStats, totalMagicEarned: totalAfterContract }, inventory, bells);
    await advanceQuestIfDone(nextProg, magicAfterContract);
  };

  const handleStartContract = (contract) => {
    if (activeContract) return;
    setActiveContract({
      ...contract,
      startTaps: stats.taps || 0,
      expiresAt: Date.now() + contract.durationMs
    });
    showToast(`Przyjęto kontrakt: ${contract.title}!`);
  };

  const handleRepairFault = async (id) => {
    const cost = UPGRADES[id].repairCost;
    if (!faults[id] || magic < cost) return;
    const nextMagic = magic - cost;
    const nextFaults = { ...faults, [id]: false };
    setMagic(nextMagic);
    setFaults(nextFaults);
    showToast(`Naprawiono: ${UPGRADES[id].name}!`);
    try {
      await updateDoc(doc(db, "factory", player), {
        magic: nextMagic,
        faults: nextFaults,
        lastUpdate: Date.now()
      });
    } catch (e) {}
  };

  const handleBuyShield = async () => {
    if (magic < SHIELD_COST || hasShield) return;
    const nextMagic = magic - SHIELD_COST;
    const nextShieldUntil = Date.now() + SHIELD_DURATION_MS;
    setMagic(nextMagic);
    setShieldUntil(nextShieldUntil);
    showToast("Tarcza Antysabotażowa aktywna przez 20 minut! 🛡️");
    try {
      await updateDoc(doc(db, "factory", player), {
        magic: nextMagic,
        shieldUntil: nextShieldUntil,
        lastUpdate: Date.now()
      });
    } catch (e) {}
  };

  const handleBuyTrap = async () => {
    if (magic < TRAP_COST || hasTrap) return;
    const nextMagic = magic - TRAP_COST;
    const nextTrapUntil = Date.now() + TRAP_DURATION_MS;
    setMagic(nextMagic);
    setTrapUntil(nextTrapUntil);
    showToast("Kontr-Pułapka uzbrojona na 25 minut! 🧨");
    try {
      await updateDoc(doc(db, "factory", player), {
        magic: nextMagic,
        trapUntil: nextTrapUntil,
        lastUpdate: Date.now()
      });
    } catch (e) {}
  };

  const handleBuyRecon = async () => {
    if (magic < RECON_COST || !opponent) return;
    const nextMagic = magic - RECON_COST;
    setMagic(nextMagic);
    const oppSnap = await getDoc(doc(db, "factory", opponent));
    const d = oppSnap.exists() ? oppSnap.data() : leaderboard[opponent];
    setReconReport({
      target: opponent.toUpperCase(),
      elf: d.elf || 0,
      reindeer: d.reindeer || 0,
      maverick: d.maverick || 0,
      lexus: d.lexus || 0,
      bells: d.bells || 0,
      magic: Math.floor(d.magic || 0)
    });
    try {
      await updateDoc(doc(db, "factory", player), { magic: nextMagic, lastUpdate: Date.now() });
    } catch (e) {}
  };

  const handleBuyUpgrade = async (id) => {
    const cost = getCost(id);
    if (magic < cost) return;
    const nextMagic = magic - cost;
    const nextInv = { ...inventory, [id]: inventory[id] + 1 };
    setMagic(nextMagic);
    setInventory(nextInv);
    setUnderfunded(false);

    const nextProg = { ...questProgress, sessionBuys: questProgress.sessionBuys + 1 };
    setQuestProgress(nextProg);

    await evaluateAchievements(stats, nextInv, bells);
    const finalMagic = await advanceQuestIfDone(nextProg, nextMagic);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: finalMagic,
        [id]: nextInv[id],
        underfunded: false,
        lastUpdate: Date.now()
      });
    } catch (e) {}
  };

  const handleBuyGloves = async () => {
    const cost = getGlovesCost();
    if (magic < cost) return;
    const nextMagic = magic - cost;
    const nextLevel = glovesLevel + 1;
    setMagic(nextMagic);
    setGlovesLevel(nextLevel);
    setUnderfunded(false);

    const nextProg = { ...questProgress, sessionBuys: questProgress.sessionBuys + 1 };
    setQuestProgress(nextProg);
    const finalMagic = await advanceQuestIfDone(nextProg, nextMagic);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: finalMagic,
        glovesLevel: nextLevel,
        underfunded: false,
        lastUpdate: Date.now()
      });
    } catch (e) {}
  };

  const handleSabotage = async (type) => {
    const costs = { freeze: 6500, ice: 5000, breakdown: 5500, tax: 6000, chocolate: 4000 };
    const cost = costs[type];
    if (!cost || magic < cost || !opponent) return;

    const oppRef = doc(db, "factory", opponent);
    const oppSnap = await getDoc(oppRef);
    const oppData = oppSnap.exists() ? oppSnap.data() : createFreshPlayerDoc(Date.now());
    const currentNow = Date.now();

    if (type !== 'chocolate' && oppData.shieldUntil && oppData.shieldUntil > currentNow) {
      showToast(`Tarcza rywala (${opponent.toUpperCase()}) zablokowała sabotaż! 🛡️`);
      return;
    }

    const nextMagic = magic - cost;
    const nextStats = { ...stats, actionsUsed: (stats.actionsUsed || 0) + 1 };
    setMagic(nextMagic);
    setStats(nextStats);

    // Sprawdzenie Kontr-Pułapki u przeciwnika przy atakach ofensywnych
    if (type !== 'chocolate' && oppData.trapUntil && oppData.trapUntil > currentNow) {
      const counterLoss = Math.min(nextMagic, 4000);
      const myAfterCounter = Math.max(0, nextMagic - counterLoss);
      setMagic(myAfterCounter);
      try {
        await updateDoc(doc(db, "factory", player), {
          magic: myAfterCounter,
          actionsUsed: nextStats.actionsUsed,
          frozenUntil: currentNow + (10 * 60 * 1000),
          lastUpdate: currentNow
        });
        await setDoc(oppRef, { trapUntil: 0, lastUpdate: currentNow }, { merge: true });
      } catch (e) {}
      showToast(`🧨 PUŁAPKA! ${opponent.toUpperCase()} odbija atak: tracisz ${counterLoss} ✨ i masz 10 min zamrożenia!`);
      await pushEventLog(`🧨 Pułapka ${opponent.toUpperCase()} odbiła atak ${player?.toUpperCase()}!`);
      await evaluateAchievements(nextStats, inventory, bells);
      return;
    }

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: nextMagic,
        actionsUsed: nextStats.actionsUsed,
        lastUpdate: currentNow
      });

      if (type === 'freeze') {
        const baseFrozen = oppData.frozenUntil > currentNow ? oppData.frozenUntil : currentNow;
        await setDoc(oppRef, { frozenUntil: baseFrozen + (25 * 60 * 1000), lastUpdate: currentNow }, { merge: true });
        showToast(`Atak Grincha! Zamrożono produkcję (${opponent.toUpperCase()}) na 25 min! 🧌❄️`);
        await pushEventLog(`❄️ ${player?.toUpperCase()} zamroził fabrykę ${opponent.toUpperCase()} na 25 min.`);
      } else if (type === 'ice') {
        await setDoc(oppRef, { icedUntil: currentNow + (10 * 60 * 1000), lastUpdate: currentNow }, { merge: true });
        showToast(`Oblodzony Ekran dla (${opponent.toUpperCase()})! Kliknięcia spadają do +1 na 10 min! 🧊`);
        await pushEventLog(`🧊 ${player?.toUpperCase()} oblodził ekran ${opponent.toUpperCase()}.`);
      } else if (type === 'breakdown') {
        const oppFaults = { ...emptyFaults(), ...(oppData.faults || {}) };
        const owned = Object.keys(UPGRADES).filter(k => (oppData[k] || 0) > 0 && !oppFaults[k]);
        if (owned.length > 0) {
          const targetCar = owned[Math.floor(Math.random() * owned.length)];
          oppFaults[targetCar] = true;
          await setDoc(oppRef, { faults: oppFaults, lastUpdate: currentNow }, { merge: true });
          showToast(`Sabotaż serwisowy! Zepsuto pojazd (${UPGRADES[targetCar].name}) u ${opponent.toUpperCase()}! 🔧`);
          await pushEventLog(`🔧 ${player?.toUpperCase()} wywołał awarię (${UPGRADES[targetCar].name}) u ${opponent.toUpperCase()}.`);
        } else {
          showToast(`Rywal nie ma sprawnego pojazdu do zepsucia, ale akcja zaliczona.`);
        }
      } else if (type === 'tax') {
        const oppMagic = Math.floor(oppData.magic || 0);
        const stolen = Math.min(14000, Math.floor(oppMagic * 0.18));
        await setDoc(oppRef, { magic: Math.max(0, oppMagic - stolen), lastUpdate: currentNow }, { merge: true });
        showToast(`Podatek Grincha! Rywal (${opponent.toUpperCase()}) traci ${stolen} ✨! 💸`);
        await pushEventLog(`💸 ${player?.toUpperCase()} nałożył podatek na ${opponent.toUpperCase()} (-${stolen} ✨).`);
      } else if (type === 'chocolate') {
        const baseBoost = oppData.boostUntil > currentNow ? oppData.boostUntil : currentNow;
        await setDoc(oppRef, { boostUntil: baseBoost + (30 * 60 * 1000), lastUpdate: currentNow }, { merge: true });
        showToast(`Gorąca Czekolada dla (${opponent.toUpperCase()})! Produkcja x2 przez 30 min! ☕✨`);
      }
    } catch (e) {
      showToast("Nie udało się wysłać akcji do bazy.");
    }

    await evaluateAchievements(nextStats, inventory, bells);
  };

  const handleTender = async () => {
    if (magic < TENDER_COST || !player) return;
    const tenderNow = Date.now();
    const afterStake = magic - TENDER_COST;
    const roll = Math.random();

    if (roll < 0.15) {
      const nextBells = bells + 1;
      setBells(nextBells);
      setMagic(afterStake);
      showToast("SZALONY PRZETARG WYGRANY! +1 Złoty Dzwonek! 🔔✨");
      await pushEventLog(`🔔 ${player.toUpperCase()} wygrał w Przetargu +1 Złoty Dzwonek!`);
      await evaluateAchievements(stats, inventory, nextBells);
      try {
        await updateDoc(doc(db, "factory", player), {
          magic: afterStake,
          bells: nextBells,
          lastUpdate: tenderNow
        });
      } catch (e) {}
    } else if (roll < 0.35) {
      const bonus = 35000;
      const nextMagic = afterStake + bonus;
      const nextTotal = (stats.totalMagicEarned || 0) + bonus;
      setMagic(nextMagic);
      const nextStats = { ...stats, totalMagicEarned: nextTotal };
      setStats(nextStats);
      showToast(`SZALONY PRZETARG WYGRANY! +${bonus} Magii! 💰`);
      await evaluateAchievements(nextStats, inventory, bells);
      try {
        await updateDoc(doc(db, "factory", player), {
          magic: nextMagic,
          totalMagicEarned: nextTotal,
          lastUpdate: tenderNow
        });
      } catch (e) {}
    } else {
      const extraLoss = Math.min(afterStake, 18000);
      const nextMagic = Math.max(0, afterStake - extraLoss);
      setMagic(nextMagic);
      showToast(`PRZETARG PRZEGRANY! Strata dodatkowych ${extraLoss} ✨ i zamrożenie 12 min! 💀`);
      await pushEventLog(`💀 ${player.toUpperCase()} przegrał Szalony Przetarg!`);
      try {
        await updateDoc(doc(db, "factory", player), {
          magic: nextMagic,
          frozenUntil: tenderNow + (12 * 60 * 1000),
          lastUpdate: tenderNow
        });
      } catch (e) {}
    }
  };

  const casinoCooldownLeft = Math.max(0, (casinoLastSpin + CASINO_COOLDOWN_MS) - now);

  const handleSpinCasino = async () => {
    if (magic < CASINO_COST || casinoCooldownLeft > 0) return;
    const spinNow = Date.now();
    const afterCost = magic - CASINO_COST;
    setCasinoLastSpin(spinNow);

    const roll = Math.random();
    let outcomeMagic = afterCost;
    let nextTotal = stats.totalMagicEarned || 0;

    if (roll < 0.16) {
      const win = 7000;
      outcomeMagic = afterCost + win;
      nextTotal += win;
      showToast(`Kasyno Elfa: Worek Magii! +${win} ✨`);
    } else if (roll < 0.28) {
      setFrenzyUntil(spinNow + 90000);
      outcomeMagic = afterCost;
      showToast("Kasyno Elfa: JACKPOT! x4 przez 90s! 🎰🔥");
    } else if (roll < 0.70) {
      outcomeMagic = afterCost;
      showToast("Kasyno Elfa: Pudło... Elf zwinął resztę. 🍪");
    } else {
      const penaltyLoss = Math.min(afterCost, 2200);
      outcomeMagic = afterCost - penaltyLoss;
      try {
        await updateDoc(doc(db, "factory", player), {
          frozenUntil: spinNow + (12 * 60 * 1000)
        });
      } catch (e) {}
      showToast(`Przekleństwo Grincha! Zamrożenie 12 min i strata ${penaltyLoss} ✨! 🧌❄️`);
    }

    setMagic(outcomeMagic);
    const nextStats = { ...stats, totalMagicEarned: nextTotal };
    setStats(nextStats);

    const nextProg = { ...questProgress, sessionSpins: questProgress.sessionSpins + 1 };
    setQuestProgress(nextProg);

    await evaluateAchievements(nextStats, inventory, bells);
    const finalMagic = await advanceQuestIfDone(nextProg, outcomeMagic);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: finalMagic,
        totalMagicEarned: nextTotal,
        casinoLastSpin: spinNow,
        lastUpdate: spinNow
      });
    } catch (e) {}
  };

  const earnedBellsPreview = Math.floor(magic / PRESTIGE_THRESHOLD);

  const handlePrestige = async () => {
    if (earnedBellsPreview < 1 || !player) return;
    if (!window.confirm(`Wykonujesz Prestiż? Zresetuje to budynki i bieżącą Magię, ale zdobędziesz +${earnedBellsPreview} Złoty Dzwonek (+6% za każdy dzwonek na stałe).`)) {
      return;
    }

    const nextBells = bells + earnedBellsPreview;
    const emptyInv = { elf: 0, reindeer: 0, maverick: 0, lexus: 0 };
    const cleanFaults = emptyFaults();
    const ts = Date.now();

    setBells(nextBells);
    setMagic(0);
    setInventory(emptyInv);
    setFaults(cleanFaults);
    setGlovesLevel(0);
    setUnderfunded(false);
    setFrenzyUntil(0);

    showToast(`Prestiż ukończony! Masz teraz ${nextBells} Złote Dzwonki (+${nextBells * 6}%)! 🔔✨`);
    await pushEventLog(`🔔 ${player.toUpperCase()} wykonał Prestiż (łącznie dzwonków: ${nextBells}).`);
    await evaluateAchievements(stats, emptyInv, nextBells);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: 0,
        elf: 0,
        reindeer: 0,
        maverick: 0,
        lexus: 0,
        faults: cleanFaults,
        glovesLevel: 0,
        bells: nextBells,
        frozenUntil: 0,
        icedUntil: 0,
        underfunded: false,
        lastUpdate: ts
      });
    } catch (e) {}
  };

  const formatTimer = (targetMs) => {
    const left = Math.max(0, Math.floor((targetMs - now) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatCooldown = (ms) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const staryMagic = Math.floor(leaderboard.stary?.magic || 0);
  const staraMagic = Math.floor(leaderboard.stara?.magic || 0);
  const totalBattleMagic = staryMagic + staraMagic;
  const staryShare = totalBattleMagic > 0 ? Math.round((staryMagic / totalBattleMagic) * 100) : 50;
  const staraShare = 100 - staryShare;
  const leaderDiff = Math.abs(staryMagic - staraMagic);
  const leaderLabel = staryMagic === staraMagic ? 'Remis w Magii' : staryMagic > staraMagic ? `Prowadzi Stary (+${leaderDiff} ✨)` : `Prowadzi Stara (+${leaderDiff} ✨)`;

  const unlockedSet = new Set(stats.achievements || []);
  const activeQuest = QUEST_TEMPLATES[questIndex];
  const currentQuestVal = questProgress[activeQuest.field] || 0;
  const currentUpkeep = getUpkeepPerMin();
  const activeFaultIds = Object.keys(UPGRADES).filter(k => faults[k]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950 via-slate-900 to-black p-4 flex flex-col items-center relative overflow-hidden font-sans select-none">
      <Snowfall color="#ffffff" snowflakeCount={60} style={{ opacity: 0.3, zIndex: 0 }} />

      {celebrateMedal && (
        <Confetti width={width} height={height} recycle={false} numberOfPieces={350} colors={['#fde047', '#10b981', '#38bdf8']} />
      )}

      {gameState === 'playing' && goldenReindeer && (
        <button
          onClick={handleCatchReindeer}
          style={{ top: `${goldenReindeer.top}%`, left: `${goldenReindeer.left}%` }}
          className="fixed z-40 text-6xl animate-bounce filter drop-shadow-[0_0_25px_rgba(250,204,21,0.95)] cursor-pointer hover:scale-125 transition-transform"
          title="Złap Złotego Renifera!"
        >
          🦌✨
        </button>
      )}

      {actionToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-400 text-amber-200 px-5 py-3 rounded-2xl shadow-2xl text-xs md:text-sm font-bold text-center max-w-sm backdrop-blur-md">
          {actionToast}
        </div>
      )}

      {celebrateMedal && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-900/95 to-emerald-950/95 border-2 border-amber-400 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm w-[92%]">
          <span className="text-4xl">{celebrateMedal.icon}</span>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Nowe Osiągnięcie!</p>
            <p className="font-bold text-base">{celebrateMedal.name}</p>
            <p className="text-xs text-slate-300">{celebrateMedal.desc}</p>
          </div>
        </div>
      )}

      <div className="z-10 w-full max-w-lg flex flex-col items-center pt-4 pb-24">

        {gameState === 'loading' && (
          <div className="mt-24 text-amber-300 font-bold animate-pulse text-lg">
            Łączenie z kontem...
          </div>
        )}

        {/* INSTRUKCJA DO GRY */}
        {gameState === 'manual' && (
          <div className="w-full bg-black/70 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-6 mt-4 text-slate-200 shadow-2xl">
            <h2 className="text-2xl font-bold text-amber-300 font-serif text-center mb-1">
              📖 Instrukcja Gry – Fabryka Mikołaja
            </h2>
            <p className="text-xs text-red-300 text-center italic mb-5">
              Edycja Ultra Hardcore • Liczy się zarządzanie Magią i czas reakcji
            </p>

            <div className="space-y-4 text-xs leading-relaxed">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <p className="font-bold text-amber-300 uppercase tracking-wider mb-1">1. Konta i Hasła</p>
                <p>Każde konto (<strong>Stary</strong> oraz <strong>Stara</strong>) ma własne hasło zapisane w bazie. Przy pierwszym wejściu ustawiasz hasło (min. 4 znaki), a przy kolejnych logowaniach wpisujesz je, aby wejść do swojej fabryki.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <p className="font-bold text-emerald-300 uppercase tracking-wider mb-1">2. Produkcja, Seria i Utrzymanie</p>
                <p>Klikaj prezent (szybkie klikanie buduje serię combo), ulepszaj <strong>Świąteczne Rękawice</strong> i kupuj flotę: <strong>Scenic</strong>, <strong>Meganka</strong>, <strong>Maverick w LPG</strong> oraz <strong>Lexus Hybryda</strong>. Co minutę flota pobiera koszt utrzymania – brak Magii obniża produkcję o 55%.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <p className="font-bold text-red-300 uppercase tracking-wider mb-1">3. Awarie, Zlecenia i Kontrakty</p>
                <p>Pojazdy mogą złapać awarię, która blokuje ich produkcję do czasu opłacenia naprawy. Wykonuj zlecenia oraz ryzykowne <strong>Kontrakty na czas</strong> – wyrobisz limit w terminie, dostajesz premię; spóźnisz się, płacisz karę.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <p className="font-bold text-purple-300 uppercase tracking-wider mb-1">4. Sabotaż, Tarcze, Pułapki, Kasyno i Przetarg</p>
                <p>Możesz zamrozić produkcję rywala, oblodzić mu ekran (+1/tap), wywołać awarię pojazdu lub ściągnąć Podatek Grincha. Bronisz się <strong>Tarczą</strong> lub uzbrajasz <strong>Kontr-Pułapkę</strong>, która odbija atak. <strong>Kasyno Elfa</strong> i <strong>Szalony Przetarg</strong> dają wielkie nagrody kosztem dużego ryzyka.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <p className="font-bold text-yellow-300 uppercase tracking-wider mb-1">5. Prestiż i Osiągnięcia</p>
                <p>Po zebraniu co najmniej <strong>240 000 ✨</strong> możesz wykonać Prestiż – resetuje on budynki i bieżącą Magię, ale daje stałe <strong>Złote Dzwonki</strong> (+6% do produkcji i kliknięć za każdy dzwonek).</p>
              </div>
            </div>

            <button
              onClick={() => setGameState(manualReturnState)}
              className="mt-6 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3.5 rounded-xl border border-amber-400/50 transition-all text-sm uppercase tracking-wider"
            >
              Wróć
            </button>
          </div>
        )}

        {/* USTAWIENIE HASŁA DLA KONTA */}
        {gameState === 'auth_setup' && (
          <div className="w-full bg-black/60 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔐</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">
              Konto: {player?.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              To konto nie ma jeszcze hasła. Ustaw własne hasło (min. 4 znaki).
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
              onKeyDown={(e) => e.key === 'Enter' && handleSetAccountPin()}
              className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400"
              placeholder="Powtórz hasło"
            />

            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}

            <button
              onClick={handleSetAccountPin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl border border-emerald-400/50 transition-all mb-3"
            >
              Zapisz hasło i wejdź
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => openManual('auth_setup')}
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold uppercase py-3 rounded-xl border border-amber-400/40"
              >
                📖 Instrukcja Gry
              </button>
              <button
                onClick={handleLogoutToMenu}
                className="flex-1 bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10"
              >
                Zmień konto
              </button>
            </div>
          </div>
        )}

        {/* LOGOWANIE HASŁEM DO KONTA */}
        {gameState === 'auth_login' && (
          <div className="w-full bg-black/60 backdrop-blur-xl border border-amber-400/40 rounded-3xl p-7 mt-10 text-center shadow-2xl">
            <span className="text-5xl mb-3 block">🔑</span>
            <h2 className="text-2xl font-bold text-amber-300 uppercase tracking-wider mb-1">
              Logowanie: {player?.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              Podaj hasło przypisane do konta {player?.toUpperCase()}.
            </p>

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoginAccountPin()}
              className="w-full bg-slate-900 border border-white/20 text-white text-center rounded-xl p-3.5 mb-4 text-lg tracking-widest focus:outline-none focus:border-amber-400"
              placeholder="Hasło konta"
            />

            {authError && <p className="text-red-400 text-xs font-bold mb-4">{authError}</p>}

            <button
              onClick={handleLoginAccountPin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl border border-blue-400/50 transition-all mb-3"
            >
              Zaloguj się
            </button>

            <button
              onClick={() => openManual('auth_login')}
              className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold py-3 rounded-xl border border-amber-400/40 transition-all mb-3 text-xs uppercase tracking-wider"
            >
              📖 Instrukcja Gry
            </button>

            <button
              onClick={handleLogoutToMenu}
              className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase py-3 rounded-xl border border-white/10"
            >
              Wróć do wyboru konta
            </button>
          </div>
        )}

        {gameState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">
              Fabryka Mikołaja 🏭
            </h1>
            <p className="text-red-300/80 mb-5 italic text-xs md:text-sm text-center">
              Ultra Hardcore: pułapki, przetarg, awarie, wyższe koszty i zacięta rywalizacja.
            </p>

            <button
              onClick={() => openManual('menu')}
              className="mb-6 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
            >
              📖 Instrukcja Gry
            </button>

            <div className="bg-black/45 border border-white/10 rounded-2xl p-4 w-full mb-6 backdrop-blur-md">
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span className="text-blue-300">Stary ({staryShare}%)</span>
                <span className="text-amber-300">{leaderLabel}</span>
                <span className="text-pink-300">Stara ({staraShare}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex border border-white/10">
                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${staryShare}%` }} />
                <div className="bg-pink-500 h-full transition-all duration-500" style={{ width: `${staraShare}%` }} />
              </div>
            </div>

            <div className="bg-black/40 border border-amber-500/30 rounded-3xl p-6 w-full mb-7 backdrop-blur-md shadow-[0_0_30px_rgba(251,191,36,0.1)]">
              <h2 className="text-amber-400 font-bold tracking-widest uppercase mb-5 text-sm text-center flex justify-center items-center gap-2">
                <span>🏆</span> Wyścig Zbrojeń <span>🏆</span>
              </h2>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-blue-900/30 p-4 rounded-xl border border-blue-500/30">
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider text-lg block">Stary</span>
                    <span className="text-[11px] text-slate-300">
                      {leaderboard.stary?.pin ? '🔒 Hasło' : '🔓 Brak'} • 🔔 {leaderboard.stary?.bells || 0} • Medale: {(leaderboard.stary?.achievements || []).length}/{ACHIEVEMENTS.length}
                      {leaderboard.stary?.shieldUntil > now && <span className="ml-2 text-emerald-300 font-bold">🛡️ Tarcza</span>}
                      {leaderboard.stary?.trapUntil > now && <span className="ml-2 text-rose-300 font-bold">🧨 Pułapka</span>}
                      {leaderboard.stary?.frozenUntil > now && <span className="ml-2 text-cyan-300 font-bold">❄️ Zamrożony</span>}
                      {leaderboard.stary?.icedUntil > now && <span className="ml-2 text-sky-300 font-bold">🧊 Oblodzony</span>}
                    </span>
                  </div>
                  <span className="text-2xl font-mono text-amber-400 font-bold">{staryMagic} ✨</span>
                </div>

                <div className="flex justify-between items-center bg-pink-900/30 p-4 rounded-xl border border-pink-500/30">
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider text-lg block">Stara</span>
                    <span className="text-[11px] text-slate-300">
                      {leaderboard.stara?.pin ? '🔒 Hasło' : '🔓 Brak'} • 🔔 {leaderboard.stara?.bells || 0} • Medale: {(leaderboard.stara?.achievements || []).length}/{ACHIEVEMENTS.length}
                      {leaderboard.stara?.shieldUntil > now && <span className="ml-2 text-emerald-300 font-bold">🛡️ Tarcza</span>}
                      {leaderboard.stara?.trapUntil > now && <span className="ml-2 text-rose-300 font-bold">🧨 Pułapka</span>}
                      {leaderboard.stara?.frozenUntil > now && <span className="ml-2 text-cyan-300 font-bold">❄️ Zamrożona</span>}
                      {leaderboard.stara?.icedUntil > now && <span className="ml-2 text-sky-300 font-bold">🧊 Oblodzona</span>}
                    </span>
                  </div>
                  <span className="text-2xl font-mono text-amber-400 font-bold">{staraMagic} ✨</span>
                </div>
              </div>
            </div>

            {/* DZIENNIK ZDARZEŃ */}
            {eventsLog.length > 0 && (
              <div className="bg-black/40 border border-white/10 rounded-3xl p-4 w-full mb-7 backdrop-blur-md">
                <h3 className="text-amber-200 font-bold uppercase tracking-widest text-xs mb-2.5 text-center">
                  📉 Dziennik Zdarzeń
                </h3>
                <div className="space-y-1.5 text-[11px] text-slate-300">
                  {eventsLog.slice(0, 5).map(ev => (
                    <div key={ev.id} className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/5">
                      {ev.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ŚCIANA CHWAŁY */}
            <div className="bg-black/40 border border-white/10 rounded-3xl p-5 w-full mb-7 backdrop-blur-md">
              <h3 className="text-amber-300 font-bold tracking-widest uppercase mb-4 text-xs text-center">
                🎖️ Ściana Chwały (Ultra Hardcore)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ACHIEVEMENTS.map(ach => {
                  const earnedByMe = unlockedSet.has(ach.id);
                  const earnedByStary = (leaderboard.stary?.achievements || []).includes(ach.id);
                  const earnedByStara = (leaderboard.stara?.achievements || []).includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`p-3 rounded-xl border flex items-center gap-3 ${earnedByMe ? 'bg-amber-500/15 border-amber-400/50' : 'bg-slate-900/60 border-white/5 opacity-65'}`}
                    >
                      <span className="text-2xl">{ach.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{ach.name}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">{ach.desc}</p>
                        <p className="text-[10px] text-amber-300/80 mt-0.5">
                          {earnedByStary && earnedByStara ? 'Stary i Stara' : earnedByStary ? 'Zdobył: Stary' : earnedByStara ? 'Zdobyła: Stara' : 'Niezdobyte'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wybierz swoje konto:</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => handleSelectPlayer('stary')} className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 text-white font-bold py-5 rounded-2xl border border-blue-400/50 shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition-all text-xl uppercase">Stary</button>
              <button onClick={() => handleSelectPlayer('stara')} className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 text-white font-bold py-5 rounded-2xl border border-pink-400/50 shadow-[0_10px_20px_rgba(219,39,119,0.3)] transition-all text-xl uppercase">Stara</button>
            </div>

            <Link to="/" className="mt-10 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1">Wróć do Kalendarza</Link>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center animate-fade-in">

            <div className="bg-black/60 backdrop-blur-xl border-b border-amber-500/30 w-screen fixed top-0 left-0 px-4 py-3 flex justify-between items-center z-20 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-200/60 uppercase tracking-widest font-bold">
                  {player?.toUpperCase()} • 🔔 {bells} (+{bells * 6}%) • 🛠️ -{currentUpkeep}/min
                </span>
                <span className="text-2xl md:text-3xl text-amber-400 font-mono font-bold">
                  {Math.floor(magic)} ✨
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-emerald-300/70 uppercase tracking-widest font-bold">
                  Produkcja / Klik
                </span>
                <span className="text-sm md:text-base text-emerald-400 font-mono font-bold">
                  +{getCurrentCPS()}/s • +{getTapPower()}/tap
                </span>
              </div>
            </div>

            <div className="mt-20 w-full flex flex-wrap gap-2 justify-center">
              {hasShield && (
                <div className="bg-emerald-950/90 border border-emerald-400 text-emerald-200 px-4 py-2 rounded-full text-xs font-bold">
                  🛡️ Tarcza aktywna! ({formatTimer(Math.max(shieldUntil, myData?.shieldUntil || 0))})
                </div>
              )}
              {hasTrap && (
                <div className="bg-rose-950/90 border border-rose-400 text-rose-200 px-4 py-2 rounded-full text-xs font-bold">
                  🧨 Pułapka uzbrojona! ({formatTimer(Math.max(trapUntil, myData?.trapUntil || 0))})
                </div>
              )}
              {underfunded && (
                <div className="bg-red-950/90 border border-red-500 text-red-200 px-4 py-2 rounded-full text-xs font-bold">
                  ⚠️ Brak paliwa na utrzymanie! Produkcja -55%
                </div>
              )}
              {isFrozen && (
                <div className="bg-cyan-950/90 border border-cyan-400 text-cyan-200 px-4 py-2 rounded-full text-xs font-bold">
                  ❄️ Zamrożony! ({formatTimer(myData.frozenUntil)})
                </div>
              )}
              {isIced && (
                <div className="bg-sky-950/90 border border-sky-400 text-sky-200 px-4 py-2 rounded-full text-xs font-bold">
                  🧊 Oblodzony Ekran (+1/tap)! ({formatTimer(myData.icedUntil)})
                </div>
              )}
              {hasChocolateBoost && (
                <div className="bg-amber-950/90 border border-amber-400 text-amber-200 px-4 py-2 rounded-full text-xs font-bold">
                  ☕ Gorąca Czekolada x2! ({formatTimer(myData.boostUntil)})
                </div>
              )}
              {hasFrenzy && (
                <div className="bg-orange-950/90 border border-orange-400 text-orange-200 px-4 py-2 rounded-full text-xs font-bold animate-pulse">
                  🔥 GORĄCZKA x4! ({formatTimer(frenzyUntil)})
                </div>
              )}
            </div>

            {offlineSummary && (
              <div className="bg-slate-900/90 border border-amber-400/60 text-slate-100 p-4 rounded-2xl w-full mt-3 text-center shadow-lg">
                <p className="font-bold text-xs uppercase tracking-widest mb-1 text-amber-300">Raport Nieobecności</p>
                <p className="text-xs">
                  Wyprodukowano: <strong>+{offlineSummary.earned} ✨</strong> • Koszt utrzymania: <strong className="text-red-300">-{offlineSummary.upkeep} ✨</strong>
                </p>
                <button onClick={() => setOfflineSummary(null)} className="mt-3 bg-amber-600 hover:bg-amber-500 text-white text-xs px-6 py-2 rounded-full font-bold">Przyjąłem</button>
              </div>
            )}

            {activeFaultIds.length > 0 && (
              <div className="w-full bg-red-950/60 border border-red-500/60 rounded-2xl p-4 mt-3">
                <h3 className="text-red-300 font-bold uppercase tracking-widest text-xs mb-2">
                  🛠️ Awarie w Garażu (Zablokowana produkcja)
                </h3>
                <div className="flex flex-col gap-2">
                  {activeFaultIds.map(id => (
                    <div key={id} className="bg-black/40 border border-red-500/30 rounded-xl p-2.5 flex justify-between items-center">
                      <span className="text-xs text-red-200 font-medium">{UPGRADES[id].faultLabel}</span>
                      <button
                        onClick={() => handleRepairFault(id)}
                        disabled={magic < UPGRADES[id].repairCost}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${magic >= UPGRADES[id].repairCost ? 'bg-red-600/30 border-red-400 text-white hover:bg-red-600/50' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50'}`}
                      >
                        Napraw ({UPGRADES[id].repairCost} ✨)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full bg-indigo-950/50 border border-indigo-400/30 rounded-2xl p-3.5 mt-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">📦 Bieżące Zlecenie</p>
                <p className="text-sm font-bold text-white">{activeQuest.title}</p>
                <p className="text-xs text-slate-300">Postęp: {Math.min(currentQuestVal, activeQuest.target)} / {activeQuest.target}</p>
              </div>
              <span className="text-xs font-mono font-bold bg-indigo-500/20 border border-indigo-400/40 text-amber-300 px-3 py-1.5 rounded-xl">
                +{activeQuest.reward} ✨
              </span>
            </div>

            <div className="w-full bg-rose-950/35 border border-rose-500/30 rounded-2xl p-3.5 mt-3">
              <h3 className="text-rose-300 font-bold uppercase tracking-widest text-xs mb-2">
                🎯 Kontrakty na Czas (Premia albo Kara)
              </h3>
              {activeContract ? (
                <div className="bg-black/40 border border-rose-400/40 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-white">{activeContract.title}</p>
                    <p className="text-[11px] text-slate-300">
                      Kliknięcia: {Math.max(0, (stats.taps || 0) - activeContract.startTaps)} / {activeContract.targetTaps} • Kara: -{activeContract.penaltyMagic} ✨
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold text-rose-300">
                    {formatTimer(activeContract.expiresAt)}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HARDCORE_CONTRACTS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleStartContract(c)}
                      className="bg-black/40 hover:bg-rose-950/50 border border-white/10 rounded-xl p-2.5 text-left transition-all"
                    >
                      <p className="text-xs font-bold text-white">{c.title}</p>
                      <p className="text-[10px] text-slate-300 my-0.5">{c.desc}</p>
                      <p className="text-[10px] font-mono text-emerald-300">
                        +{c.rewardMagic} ✨ / <span className="text-rose-400">-{c.penaltyMagic} ✨</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="my-7 flex flex-col items-center">
              <button
                onClick={handleTap}
                className="text-[115px] md:text-[138px] filter drop-shadow-[0_20px_50px_rgba(239,68,68,0.5)] transform active:scale-90 transition-transform cursor-pointer hover:rotate-3"
              >
                🎁
              </button>
              <span className="text-[11px] text-slate-400 mt-1">
                Kliknięć: {stats.taps || 0} {comboCount >= 12 && <span className="text-amber-300 font-bold ml-1">• Seria x{comboCount} (+{getComboBonus(comboCount)})</span>}
              </span>
            </div>

            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-white/10 shadow-xl mb-5">
              <h3 className="text-sky-300 font-bold mb-3 uppercase tracking-widest text-xs px-1">
                💪 Mocarny Palec
              </h3>
              <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="text-3xl bg-white/5 p-2 rounded-xl border border-white/10">🧤</div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">Świąteczne Rękawice (Poz. {glovesLevel})</span>
                    <span className="text-[10px] text-slate-400">+0.9 mocy tapnięcia i +0.6% produkcji/s za poziom.</span>
                    <span className="text-xs text-sky-400 font-bold mt-1">Moc kliknięcia: +{getTapPower()}</span>
                  </div>
                </div>
                <button
                  onClick={handleBuyGloves}
                  disabled={magic < getGlovesCost()}
                  className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl font-bold min-w-[92px] transition-all border ${magic >= getGlovesCost() ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 hover:bg-sky-500/35' : 'bg-slate-800 text-slate-500 border-slate-700 opacity-50'}`}
                >
                  <span className="text-[10px] uppercase">Kup za</span>
                  <span>{getGlovesCost()} ✨</span>
                </button>
              </div>
            </div>

            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-white/10 shadow-2xl mb-5">
              <h3 className="text-white/80 font-bold mb-4 uppercase tracking-widest text-xs flex justify-between px-2">
                <span>Sklep Ulepszeń</span>
                <span className="text-red-400/80">Wysokie utrzymanie</span>
              </h3>

              <div className="flex flex-col gap-3">
                {Object.values(UPGRADES).map(upg => {
                  const cost = getCost(upg.id);
                  const canAfford = magic >= cost;
                  const count = inventory[upg.id];
                  const hasFault = !!faults[upg.id];

                  return (
                    <div key={upg.id} className={`bg-black/40 border rounded-2xl p-3 flex justify-between items-center ${hasFault ? 'border-red-500/60' : 'border-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-4xl bg-white/5 p-2 rounded-xl border border-white/10">{upg.icon}</div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white">
                            {upg.name} {hasFault && <span className="text-xs text-red-400">(AWARIA)</span>}
                          </span>
                          <span className="text-[10px] text-slate-400">{upg.desc}</span>
                          <span className="text-xs text-emerald-400 font-bold mt-1">Posiadasz: {count} szt.</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleBuyUpgrade(upg.id)}
                        disabled={!canAfford}
                        className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl font-bold min-w-[90px] transition-all border ${canAfford ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/40' : 'bg-slate-800 text-slate-500 border-slate-700 opacity-50'}`}
                      >
                        <span className="text-[10px] uppercase">Kup za</span>
                        <span>{cost} ✨</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-amber-500/25 shadow-xl mb-5">
              <h3 className="text-amber-300 font-bold mb-2 uppercase tracking-widest text-xs px-1">
                🎰 Kasyno Elfa i Szalony Przetarg
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 px-1">
                W kasynie grozi zamrożenie 12 min i strata 2200 ✨. Przetarg kosztuje {TENDER_COST} ✨, daje szansę na Dzwonek lub 35 000 ✨, ale przy porażce zabiera kolejne 18 000 ✨ i zamraża na 12 min.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleSpinCasino}
                  disabled={magic < CASINO_COST || casinoCooldownLeft > 0}
                  className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm border transition-all flex justify-between items-center ${magic >= CASINO_COST && casinoCooldownLeft === 0 ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-60'}`}
                >
                  <span>🎲 Kręć Kołem Elfa</span>
                  <span className="font-mono text-xs">
                    {casinoCooldownLeft > 0 ? `Za ${formatCooldown(casinoCooldownLeft)}` : `${CASINO_COST} ✨`}
                  </span>
                </button>

                <button
                  onClick={handleTender}
                  disabled={magic < TENDER_COST}
                  className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm border transition-all flex justify-between items-center ${magic >= TENDER_COST ? 'bg-yellow-500/20 border-yellow-400/60 text-yellow-200 hover:bg-yellow-500/30' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-60'}`}
                >
                  <span>⚖️ Szalony Przetarg</span>
                  <span className="font-mono text-xs">{TENDER_COST} ✨</span>
                </button>
              </div>
            </div>

            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-emerald-500/20 shadow-xl mb-5">
              <h3 className="text-emerald-300 font-bold mb-3 uppercase tracking-widest text-xs px-1">
                🛡️ Obrona, Pułapki i Wywiad
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleBuyShield}
                  disabled={magic < SHIELD_COST || hasShield}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= SHIELD_COST && !hasShield ? 'bg-emerald-950/50 border-emerald-500/50 hover:bg-emerald-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🛡️ Tarcza (20 min)</div>
                  <div className="text-[10px] text-slate-300 my-1">Blokuje ataki sabotażowe rywala.</div>
                  <div className="text-xs font-mono font-bold text-emerald-300">
                    {hasShield ? 'AKTYWNA' : `${SHIELD_COST} ✨`}
                  </div>
                </button>

                <button
                  onClick={handleBuyTrap}
                  disabled={magic < TRAP_COST || hasTrap}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= TRAP_COST && !hasTrap ? 'bg-rose-950/50 border-rose-500/50 hover:bg-rose-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🧨 Kontr-Pułapka (25 min)</div>
                  <div className="text-[10px] text-slate-300 my-1">Odbija atak rywala (-4000 ✨ i mróz).</div>
                  <div className="text-xs font-mono font-bold text-rose-300">
                    {hasTrap ? 'UZBROJONA' : `${TRAP_COST} ✨`}
                  </div>
                </button>

                <button
                  onClick={handleBuyRecon}
                  disabled={magic < RECON_COST}
                  className={`sm:col-span-2 p-3 rounded-2xl border text-left transition-all ${magic >= RECON_COST ? 'bg-indigo-950/50 border-indigo-500/50 hover:bg-indigo-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🕵️ Raport Wywiadu</div>
                  <div className="text-[10px] text-slate-300 my-1">Podgląd floty i dzwonków ({opponent?.toUpperCase()}).</div>
                  <div className="text-xs font-mono font-bold text-indigo-300">{RECON_COST} ✨</div>
                </button>
              </div>

              {reconReport && (
                <div className="mt-3 bg-black/50 border border-indigo-400/30 rounded-xl p-3 text-xs text-slate-200">
                  <p className="font-bold text-indigo-300 mb-1">Wywiad – {reconReport.target}:</p>
                  <p>Magia: <strong>{reconReport.magic} ✨</strong> • Dzwonki: <strong>🔔 {reconReport.bells}</strong></p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    🚐 Scenic: {reconReport.elf} • 🚗 Meganka: {reconReport.reindeer} • 🛻 Maverick: {reconReport.maverick} • 🏎️ Lexus: {reconReport.lexus}
                  </p>
                </div>
              )}
            </div>

            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-purple-500/20 shadow-xl mb-5">
              <h3 className="text-purple-300 font-bold mb-3 uppercase tracking-widest text-xs px-1">
                ⚔️ Sabotaż i Utrudnienia ({opponent?.toUpperCase()})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSabotage('freeze')}
                  disabled={magic < 6500}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= 6500 ? 'bg-cyan-950/50 border-cyan-500/50 hover:bg-cyan-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🧌 Atak Grincha</div>
                  <div className="text-[10px] text-slate-300 my-1">Zamraża produkcję na 25 min.</div>
                  <div className="text-xs font-mono font-bold text-cyan-300">6500 ✨</div>
                </button>

                <button
                  onClick={() => handleSabotage('ice')}
                  disabled={magic < 5000}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= 5000 ? 'bg-sky-950/50 border-sky-500/50 hover:bg-sky-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🧊 Oblodzony Ekran</div>
                  <div className="text-[10px] text-slate-300 my-1">Kliknięcia rywala dają tylko +1 przez 10 min.</div>
                  <div className="text-xs font-mono font-bold text-sky-300">5000 ✨</div>
                </button>

                <button
                  onClick={() => handleSabotage('breakdown')}
                  disabled={magic < 5500}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= 5500 ? 'bg-red-950/50 border-red-500/50 hover:bg-red-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🔧 Sabotaż Serwisowy</div>
                  <div className="text-[10px] text-slate-300 my-1">Wywołuje awarię pojazdu u rywala.</div>
                  <div className="text-xs font-mono font-bold text-red-300">5500 ✨</div>
                </button>

                <button
                  onClick={() => handleSabotage('tax')}
                  disabled={magic < 6000}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= 6000 ? 'bg-fuchsia-950/50 border-fuchsia-500/50 hover:bg-fuchsia-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">💸 Podatek Grincha</div>
                  <div className="text-[10px] text-slate-300 my-1">Zabiera rywalowi 18% Magii (do 14 000).</div>
                  <div className="text-xs font-mono font-bold text-fuchsia-300">6000 ✨</div>
                </button>

                <button
                  onClick={() => handleSabotage('chocolate')}
                  disabled={magic < 4000}
                  className={`sm:col-span-2 p-3 rounded-2xl border text-left transition-all ${magic >= 4000 ? 'bg-amber-950/50 border-amber-500/50 hover:bg-amber-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">☕ Gorąca Czekolada</div>
                  <div className="text-[10px] text-slate-300 my-1">Daje przeciwnikowi x2 produkcji na 30 min.</div>
                  <div className="text-xs font-mono font-bold text-amber-300">4000 ✨</div>
                </button>
              </div>
            </div>

            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-yellow-500/30 shadow-xl mb-6">
              <h3 className="text-yellow-300 font-bold mb-1 uppercase tracking-widest text-xs px-1">
                🔔 Prestiż – Złote Dzwonki
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 px-1">
                Próg: {PRESTIGE_THRESHOLD} Magii = 1 Złoty Dzwonek (+6% stałej premii do produkcji i kliknięć).
              </p>
              <button
                onClick={handlePrestige}
                disabled={earnedBellsPreview < 1}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm border transition-all ${earnedBellsPreview >= 1 ? 'bg-yellow-500/20 border-yellow-400 text-yellow-200 hover:bg-yellow-500/30' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-60'}`}
              >
                {earnedBellsPreview >= 1 ? `Zdobądź +${earnedBellsPreview} Złoty Dzwonek` : `Brakuje ${PRESTIGE_THRESHOLD - Math.floor(magic)} ✨ do Prestiżu`}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 w-full">
              <button onClick={() => openManual('playing')} className="flex-1 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs font-bold uppercase py-4 rounded-xl border border-amber-400/40 transition-colors">📖 Instrukcja</button>
              <button onClick={handleLogoutToMenu} className="flex-1 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 text-xs font-bold uppercase py-4 rounded-xl border border-white/10 transition-colors">Zmień konto</button>
              <Link to="/" className="flex-1 bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-bold uppercase py-4 rounded-xl border border-red-500/30 transition-colors flex justify-center items-center">Wyjście</Link>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}