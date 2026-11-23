import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import Snowfall from 'react-snowfall';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const RESET_FLAG_KEY = 'factory_hard_reset_v2_2026';

const UPGRADES = {
  elf: { id: 'elf', name: 'Scenic', baseCost: 35, cps: 1, icon: '🚐', desc: 'Produkuje 1 Magię/sek.' },
  reindeer: { id: 'reindeer', name: 'Meganka', baseCost: 450, cps: 12, icon: '🚗', desc: 'Produkuje 12 Magii/sek.' },
  maverick: { id: 'maverick', name: 'Maverick w LPG', baseCost: 3500, cps: 75, icon: '🛻', desc: 'Produkuje 75 Magii/sek.' },
  lexus: { id: 'lexus', name: 'Lexus Hybryda', baseCost: 24000, cps: 360, icon: '🏎️', desc: 'Produkuje 360 Magii/sek.' }
};

const GLOVES_BASE_COST = 250;
const CASINO_COST = 1800;
const CASINO_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const PRESTIGE_THRESHOLD = 75000;

const QUEST_TEMPLATES = [
  { id: 'taps_200', title: 'Rozgrzewka na mrozie', target: 200, reward: 650, field: 'sessionTaps' },
  { id: 'buys_3', title: 'Rozbudowa warsztatu', target: 3, reward: 1200, field: 'sessionBuys' },
  { id: 'spins_1', title: 'Wizyta u Elfa', target: 1, reward: 1500, field: 'sessionSpins' },
  { id: 'taps_500', title: 'Wytrzymały nadgarstek', target: 500, reward: 1900, field: 'sessionTaps' }
];

const ACHIEVEMENTS = [
  { id: 'taps_500', name: 'Rozgrzany Palec', icon: '👆', desc: 'Kliknij prezent 500 razy.', check: (s) => (s.taps || 0) >= 500 },
  { id: 'taps_2500', name: 'Weteran Klikania', icon: '⚡', desc: 'Kliknij prezent 2500 razy.', check: (s) => (s.taps || 0) >= 2500 },
  { id: 'magic_50k', name: 'Świąteczny Przedsiębiorca', icon: '💼', desc: 'Zbierz łącznie 50 000 Magii.', check: (s) => (s.totalMagicEarned || 0) >= 50000 },
  { id: 'magic_250k', name: 'Magnat Bieguna', icon: '💰', desc: 'Zbierz łącznie 250 000 Magii.', check: (s) => (s.totalMagicEarned || 0) >= 250000 },
  { id: 'maverick_12', name: 'Konwój na LPG', icon: '🛻', desc: 'Posiadaj 12 Mavericków w LPG.', check: (s) => (s.maverick || 0) >= 12 },
  { id: 'saboteur_5', name: 'Mistrz Sabotażu', icon: '🧌', desc: 'Wykonaj 5 akcji specjalnych na rywalu.', check: (s) => (s.actionsUsed || 0) >= 5 },
  { id: 'prestige_1', name: 'Pierwszy Dzwonek', icon: '🔔', desc: 'Wykonaj Prestiż i zdobądź Złoty Dzwonek.', check: (s) => (s.bells || 0) >= 1 }
];

const createFreshPlayerDoc = (ts = Date.now()) => ({
  magic: 0,
  elf: 0,
  reindeer: 0,
  maverick: 0,
  lexus: 0,
  glovesLevel: 0,
  bells: 0,
  taps: 0,
  totalMagicEarned: 0,
  actionsUsed: 0,
  casinoLastSpin: 0,
  achievements: [],
  frozenUntil: 0,
  boostUntil: 0,
  lastUpdate: ts
});

export default function Game() {
  const { width, height } = useWindowSize();

  const [gameState, setGameState] = useState('menu');
  const [player, setPlayer] = useState(null);

  const [magic, setMagic] = useState(0);
  const [inventory, setInventory] = useState({ elf: 0, reindeer: 0, maverick: 0, lexus: 0 });
  const [glovesLevel, setGlovesLevel] = useState(0);
  const [bells, setBells] = useState(0);
  const [casinoLastSpin, setCasinoLastSpin] = useState(0);
  const [stats, setStats] = useState({ taps: 0, totalMagicEarned: 0, actionsUsed: 0, achievements: [] });

  const [questIndex, setQuestIndex] = useState(0);
  const [questProgress, setQuestProgress] = useState({ sessionTaps: 0, sessionBuys: 0, sessionSpins: 0 });

  const [leaderboard, setLeaderboard] = useState({
    stary: createFreshPlayerDoc(0),
    stara: createFreshPlayerDoc(0)
  });

  const [offlineGains, setOfflineGains] = useState(0);
  const [frenzyUntil, setFrenzyUntil] = useState(0);
  const [goldenReindeer, setGoldenReindeer] = useState(null);
  const [actionToast, setActionToast] = useState('');
  const [celebrateMedal, setCelebrateMedal] = useState(null);
  const [now, setNow] = useState(Date.now());

  const stateRef = useRef({ magic, inventory, glovesLevel, bells, casinoLastSpin, stats, player });
  useEffect(() => {
    stateRef.current = { magic, inventory, glovesLevel, bells, casinoLastSpin, stats, player };
  }, [magic, inventory, glovesLevel, bells, casinoLastSpin, stats, player]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Jednorazowe wyzerowanie statystyk w bazie pod nową, trudniejszą ekonomię
  useEffect(() => {
    let active = true;
    const syncAndMaybeReset = async () => {
      const currentNow = Date.now();
      if (!localStorage.getItem(RESET_FLAG_KEY)) {
        try {
          const fresh = createFreshPlayerDoc(currentNow);
          await Promise.all([
            setDoc(doc(db, "factory", "stary"), fresh),
            setDoc(doc(db, "factory", "stara"), fresh)
          ]);
          localStorage.setItem(RESET_FLAG_KEY, 'done');
        } catch (e) {}
      }

      if (!active) return;
      onSnapshot(collection(db, "factory"), (snapshot) => {
        const lb = {
          stary: createFreshPlayerDoc(0),
          stara: createFreshPlayerDoc(0)
        };
        snapshot.forEach(d => {
          lb[d.id] = { ...lb[d.id], ...d.data() };
        });
        setLeaderboard(lb);
      });
    };

    syncAndMaybeReset();
    return () => { active = false; };
  }, []);

  const opponent = player === 'stary' ? 'stara' : 'stary';
  const myData = player ? leaderboard[player] : null;
  const isFrozen = !!(myData && myData.frozenUntil && myData.frozenUntil > now);
  const hasChocolateBoost = !!(myData && myData.boostUntil && myData.boostUntil > now);
  const hasFrenzy = frenzyUntil > now;

  const getBaseCPS = () => {
    const raw = (inventory.elf * UPGRADES.elf.cps) +
                (inventory.reindeer * UPGRADES.reindeer.cps) +
                (inventory.maverick * UPGRADES.maverick.cps) +
                (inventory.lexus * UPGRADES.lexus.cps);
    const prestigeMult = 1 + (bells * 0.15);
    return Math.floor(raw * prestigeMult);
  };

  const getCurrentCPS = () => {
    if (isFrozen) return 0;
    let mult = 1;
    if (hasChocolateBoost) mult *= 2;
    if (hasFrenzy) mult *= 5;
    return Math.floor(getBaseCPS() * mult);
  };

  const getTapPower = () => {
    const baseCps = getBaseCPS();
    const passiveBonus = Math.floor(baseCps * 0.012 * glovesLevel);
    let power = Math.floor((1 + (glovesLevel * 1.5) + passiveBonus) * (1 + (bells * 0.15)));
    if (hasFrenzy) power *= 5;
    return Math.max(1, power);
  };

  const getCost = (id) => Math.floor(UPGRADES[id].baseCost * Math.pow(1.22, inventory[id]));
  const getGlovesCost = () => Math.floor(GLOVES_BASE_COST * Math.pow(1.48, glovesLevel));

  const showToast = (msg) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 3800);
  };

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

  const handleStart = async (selectedPlayer) => {
    setPlayer(selectedPlayer);
    setGameState('loading');

    const docRef = doc(db, "factory", selectedPlayer);
    const docSnap = await getDoc(docRef);
    const currentNow = Date.now();

    if (docSnap.exists()) {
      const d = docSnap.data();
      const savedInv = {
        elf: d.elf || 0,
        reindeer: d.reindeer || 0,
        maverick: d.maverick || 0,
        lexus: d.lexus || 0
      };
      const savedGloves = d.glovesLevel || 0;
      const savedBells = d.bells || 0;
      const savedSpin = d.casinoLastSpin || 0;
      const savedStats = {
        taps: d.taps || 0,
        totalMagicEarned: d.totalMagicEarned || d.magic || 0,
        actionsUsed: d.actionsUsed || 0,
        achievements: d.achievements || []
      };

      setInventory(savedInv);
      setGlovesLevel(savedGloves);
      setBells(savedBells);
      setCasinoLastSpin(savedSpin);
      setStats(savedStats);

      const lastTs = d.lastUpdate || currentNow;
      const wasFrozen = d.frozenUntil && d.frozenUntil > lastTs;
      const effectiveEnd = wasFrozen ? Math.min(currentNow, d.frozenUntil) : currentNow;
      const diffSeconds = Math.max(0, Math.floor((effectiveEnd - lastTs) / 1000));

      const rawCps = (savedInv.elf * UPGRADES.elf.cps) +
                     (savedInv.reindeer * UPGRADES.reindeer.cps) +
                     (savedInv.maverick * UPGRADES.maverick.cps) +
                     (savedInv.lexus * UPGRADES.lexus.cps);
      const prestigeMult = 1 + (savedBells * 0.15);
      const mult = (d.boostUntil && d.boostUntil > currentNow) ? 2 : 1;
      const earned = wasFrozen ? 0 : Math.floor(diffSeconds * rawCps * prestigeMult * mult);

      const updatedMagic = (d.magic || 0) + earned;
      const updatedTotal = savedStats.totalMagicEarned + earned;

      setMagic(updatedMagic);
      setOfflineGains(earned);
      const nextStats = { ...savedStats, totalMagicEarned: updatedTotal };
      setStats(nextStats);

      await updateDoc(docRef, {
        magic: updatedMagic,
        totalMagicEarned: updatedTotal,
        lastUpdate: currentNow
      });

      await evaluateAchievements(nextStats, savedInv, savedBells);
    } else {
      const fresh = createFreshPlayerDoc(currentNow);
      await setDoc(docRef, fresh);
      setMagic(0);
      setInventory({ elf: 0, reindeer: 0, maverick: 0, lexus: 0 });
      setGlovesLevel(0);
      setBells(0);
      setCasinoLastSpin(0);
      setStats({ taps: 0, totalMagicEarned: 0, actionsUsed: 0, achievements: [] });
      setOfflineGains(0);
    }

    setGameState('playing');
  };

  // Produkcja pasywna co sekundę
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
  }, [gameState, inventory, bells, isFrozen, hasChocolateBoost, hasFrenzy]);

  // Okresowy zapis do chmury
  useEffect(() => {
    if (gameState !== 'playing' || !player) return;
    const saveTimer = setInterval(async () => {
      const snap = stateRef.current;
      try {
        await updateDoc(doc(db, "factory", snap.player), {
          magic: snap.magic,
          totalMagicEarned: snap.stats.totalMagicEarned,
          taps: snap.stats.taps,
          lastUpdate: Date.now()
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [gameState, player]);

  // Złoty Renifer
  useEffect(() => {
    if (gameState !== 'playing') {
      setGoldenReindeer(null);
      return;
    }
    let hideTimeout;
    const scheduleReindeer = () => {
      const delay = 55000 + Math.floor(Math.random() * 55000);
      return setTimeout(() => {
        setGoldenReindeer({
          top: 24 + Math.floor(Math.random() * 42),
          left: 12 + Math.floor(Math.random() * 68)
        });
        hideTimeout = setTimeout(() => {
          setGoldenReindeer(null);
        }, 5000);
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
    if (Math.random() < 0.5) {
      const instantBonus = Math.max(250, getBaseCPS() * 90);
      const nextMagic = magic + instantBonus;
      const nextTotal = (stats.totalMagicEarned || 0) + instantBonus;
      setMagic(nextMagic);
      const nextStats = { ...stats, totalMagicEarned: nextTotal };
      setStats(nextStats);
      showToast(`Złoty Renifer! +${instantBonus} Magii! 🦌✨`);
      await evaluateAchievements(nextStats, inventory, bells);
      if (player) {
        try {
          await updateDoc(doc(db, "factory", player), {
            magic: nextMagic,
            totalMagicEarned: nextTotal,
            lastUpdate: Date.now()
          });
        } catch (e) {}
      }
    } else {
      setFrenzyUntil(Date.now() + 18000);
      showToast("GORĄCZKA ŚWIĄT! x5 produkcji i kliknięć przez 18s! 🔥");
    }
  };

  const handleTap = async () => {
    const gain = getTapPower();
    const nextMagic = magic + gain;
    setMagic(nextMagic);
    const nextStats = {
      ...stats,
      taps: (stats.taps || 0) + 1,
      totalMagicEarned: (stats.totalMagicEarned || 0) + gain
    };
    setStats(nextStats);

    const nextProg = { ...questProgress, sessionTaps: questProgress.sessionTaps + 1 };
    setQuestProgress(nextProg);

    await evaluateAchievements(nextStats, inventory, bells);
    await advanceQuestIfDone(nextProg, nextMagic);
  };

  const handleBuyUpgrade = async (id) => {
    const cost = getCost(id);
    if (magic < cost) return;
    const nextMagic = magic - cost;
    const nextInv = { ...inventory, [id]: inventory[id] + 1 };
    setMagic(nextMagic);
    setInventory(nextInv);

    const nextProg = { ...questProgress, sessionBuys: questProgress.sessionBuys + 1 };
    setQuestProgress(nextProg);

    await evaluateAchievements(stats, nextInv, bells);
    const finalMagic = await advanceQuestIfDone(nextProg, nextMagic);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: finalMagic,
        [id]: nextInv[id],
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

    const nextProg = { ...questProgress, sessionBuys: questProgress.sessionBuys + 1 };
    setQuestProgress(nextProg);
    const finalMagic = await advanceQuestIfDone(nextProg, nextMagic);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: finalMagic,
        glovesLevel: nextLevel,
        lastUpdate: Date.now()
      });
    } catch (e) {}
  };

  const handleSabotage = async (type) => {
    const cost = type === 'freeze' ? 4000 : 2500;
    if (magic < cost || !opponent) return;

    const nextMagic = magic - cost;
    const nextStats = { ...stats, actionsUsed: (stats.actionsUsed || 0) + 1 };
    setMagic(nextMagic);
    setStats(nextStats);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: nextMagic,
        actionsUsed: nextStats.actionsUsed,
        lastUpdate: Date.now()
      });

      const oppRef = doc(db, "factory", opponent);
      const oppSnap = await getDoc(oppRef);
      const currentNow = Date.now();

      if (type === 'freeze') {
        const baseFrozen = oppSnap.exists() && oppSnap.data().frozenUntil > currentNow
          ? oppSnap.data().frozenUntil
          : currentNow;
        await setDoc(oppRef, { frozenUntil: baseFrozen + (15 * 60 * 1000), lastUpdate: currentNow }, { merge: true });
        showToast(`Atak Grincha! Fabryka (${opponent.toUpperCase()}) zamrożona na 15 min! 🧌❄️`);
      } else {
        const baseBoost = oppSnap.exists() && oppSnap.data().boostUntil > currentNow
          ? oppSnap.data().boostUntil
          : currentNow;
        await setDoc(oppRef, { boostUntil: baseBoost + (45 * 60 * 1000), lastUpdate: currentNow }, { merge: true });
        showToast(`Gorąca Czekolada dla (${opponent.toUpperCase()})! Produkcja x2 przez 45 min! ☕✨`);
      }
    } catch (e) {
      showToast("Nie udało się wysłać akcji do bazy.");
    }

    await evaluateAchievements(nextStats, inventory, bells);
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

    if (roll < 0.25) {
      const win = 4200;
      outcomeMagic = afterCost + win;
      nextTotal += win;
      showToast(`Kasyno Elfa: Worek Magii! +${win} ✨`);
    } else if (roll < 0.45) {
      setFrenzyUntil(spinNow + 120000);
      outcomeMagic = afterCost;
      showToast("Kasyno Elfa: JACKPOT! x3 produkcji i kliknięć przez 2 min! 🎰🔥");
    } else if (roll < 0.75) {
      outcomeMagic = afterCost;
      showToast("Kasyno Elfa: Pudło... Elf zjadł ciastko. 🍪");
    } else {
      outcomeMagic = afterCost;
      try {
        await updateDoc(doc(db, "factory", player), {
          frozenUntil: spinNow + (5 * 60 * 1000)
        });
      } catch (e) {}
      showToast("Kasyno Elfa: Przekleństwo Grincha! Zamrożenie na 5 min! 🧌❄️");
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
    if (!window.confirm(`Wykonujesz Prestiż? Zresetuje to budynki i bieżącą Magię, ale zdobędziesz +${earnedBellsPreview} Złoty Dzwonek (+15% za każdy dzwonek na stałe).`)) {
      return;
    }

    const nextBells = bells + earnedBellsPreview;
    const emptyInv = { elf: 0, reindeer: 0, maverick: 0, lexus: 0 };
    const ts = Date.now();

    setBells(nextBells);
    setMagic(0);
    setInventory(emptyInv);
    setGlovesLevel(0);
    setFrenzyUntil(0);

    showToast(`Prestiż ukończony! Masz teraz ${nextBells} Złote Dzwonki (+${nextBells * 15}%)! 🔔✨`);
    await evaluateAchievements(stats, emptyInv, nextBells);

    try {
      await updateDoc(doc(db, "factory", player), {
        magic: 0,
        elf: 0,
        reindeer: 0,
        maverick: 0,
        lexus: 0,
        glovesLevel: 0,
        bells: nextBells,
        frozenUntil: 0,
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

        {gameState === 'menu' && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <h1 className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 font-extrabold mb-2 font-serif text-center drop-shadow-md">
              Fabryka Mikołaja 🏭
            </h1>
            <p className="text-blue-200/70 mb-6 italic text-xs md:text-sm text-center">
              Nowy sezon, wyższe stawki i twardsza ekonomia. Liczy się strategia!
            </p>

            {/* PASEK PRZEWAGI */}
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

            {/* RANKING */}
            <div className="bg-black/40 border border-amber-500/30 rounded-3xl p-6 w-full mb-7 backdrop-blur-md shadow-[0_0_30px_rgba(251,191,36,0.1)]">
              <h2 className="text-amber-400 font-bold tracking-widest uppercase mb-5 text-sm text-center flex justify-center items-center gap-2">
                <span>🏆</span> Wyścig Zbrojeń <span>🏆</span>
              </h2>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-blue-900/30 p-4 rounded-xl border border-blue-500/30">
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider text-lg block">Stary</span>
                    <span className="text-[11px] text-slate-300">
                      🔔 {leaderboard.stary?.bells || 0} • Medale: {(leaderboard.stary?.achievements || []).length}/{ACHIEVEMENTS.length}
                      {leaderboard.stary?.frozenUntil > now && <span className="ml-2 text-cyan-300 font-bold">❄️ Zamrożony</span>}
                      {leaderboard.stary?.boostUntil > now && <span className="ml-2 text-amber-300 font-bold">☕ x2</span>}
                    </span>
                  </div>
                  <span className="text-2xl font-mono text-amber-400 font-bold">{staryMagic} ✨</span>
                </div>

                <div className="flex justify-between items-center bg-pink-900/30 p-4 rounded-xl border border-pink-500/30">
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider text-lg block">Stara</span>
                    <span className="text-[11px] text-slate-300">
                      🔔 {leaderboard.stara?.bells || 0} • Medale: {(leaderboard.stara?.achievements || []).length}/{ACHIEVEMENTS.length}
                      {leaderboard.stara?.frozenUntil > now && <span className="ml-2 text-cyan-300 font-bold">❄️ Zamrożona</span>}
                      {leaderboard.stara?.boostUntil > now && <span className="ml-2 text-amber-300 font-bold">☕ x2</span>}
                    </span>
                  </div>
                  <span className="text-2xl font-mono text-amber-400 font-bold">{staraMagic} ✨</span>
                </div>
              </div>
            </div>

            {/* ŚCIANA CHWAŁY */}
            <div className="bg-black/40 border border-white/10 rounded-3xl p-5 w-full mb-7 backdrop-blur-md">
              <h3 className="text-amber-300 font-bold tracking-widest uppercase mb-4 text-xs text-center">
                🎖️ Ściana Chwały (Trudne Osiągnięcia)
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

            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Wybierz swoją fabrykę:</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => handleStart('stary')} className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 text-white font-bold py-5 rounded-2xl border border-blue-400/50 shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition-all text-xl uppercase">Stary</button>
              <button onClick={() => handleStart('stara')} className="flex-1 bg-gradient-to-b from-pink-600 to-pink-800 hover:from-pink-500 text-white font-bold py-5 rounded-2xl border border-pink-400/50 shadow-[0_10px_20px_rgba(219,39,119,0.3)] transition-all text-xl uppercase">Stara</button>
            </div>

            <Link to="/" className="mt-10 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors border-b border-white/20 pb-1">Wróć do Kalendarza</Link>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center animate-fade-in">

            {/* HEADER */}
            <div className="bg-black/60 backdrop-blur-xl border-b border-amber-500/30 w-screen fixed top-0 left-0 px-4 py-3 flex justify-between items-center z-20 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-200/60 uppercase tracking-widest font-bold">
                  {player?.toUpperCase()} • 🔔 {bells} (+{bells * 15}%)
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

            {/* AKTYWNE EFEKTY */}
            <div className="mt-20 w-full flex flex-wrap gap-2 justify-center">
              {isFrozen && (
                <div className="bg-cyan-950/90 border border-cyan-400 text-cyan-200 px-4 py-2 rounded-full text-xs font-bold">
                  ❄️ Zamrożony! ({formatTimer(myData.frozenUntil)})
                </div>
              )}
              {hasChocolateBoost && (
                <div className="bg-amber-950/90 border border-amber-400 text-amber-200 px-4 py-2 rounded-full text-xs font-bold">
                  ☕ Gorąca Czekolada x2! ({formatTimer(myData.boostUntil)})
                </div>
              )}
              {hasFrenzy && (
                <div className="bg-orange-950/90 border border-orange-400 text-orange-200 px-4 py-2 rounded-full text-xs font-bold animate-pulse">
                  🔥 GORĄCZKA x5! ({formatTimer(frenzyUntil)})
                </div>
              )}
            </div>

            {/* ZYSKI OFFLINE */}
            {offlineGains > 0 && (
              <div className="bg-emerald-900/80 border border-emerald-400 text-emerald-100 p-4 rounded-2xl w-full mt-3 text-center shadow-lg">
                <p className="font-bold text-xs uppercase tracking-widest mb-1">Zyski Offline!</p>
                <p className="text-xs">Podczas nieobecności fabryka wyprodukowała <strong>{offlineGains}</strong> magii! ✨</p>
                <button onClick={() => setOfflineGains(0)} className="mt-3 bg-emerald-700 hover:bg-emerald-600 text-xs px-6 py-2 rounded-full font-bold">Odbierz</button>
              </div>
            )}

            {/* BIEŻĄCE ZLECENIE */}
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

            {/* GŁÓWNY PRZYCISK (TAP) */}
            <div className="my-7 flex flex-col items-center">
              <button
                onClick={handleTap}
                className="text-[115px] md:text-[138px] filter drop-shadow-[0_20px_50px_rgba(239,68,68,0.5)] transform active:scale-90 transition-transform cursor-pointer hover:rotate-3"
              >
                🎁
              </button>
              <span className="text-[11px] text-slate-400 mt-1">Kliknięć: {stats.taps || 0}</span>
            </div>

            {/* MOCARNY PALEC */}
            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-white/10 shadow-xl mb-5">
              <h3 className="text-sky-300 font-bold mb-3 uppercase tracking-widest text-xs px-1">
                💪 Mocarny Palec
              </h3>
              <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="text-3xl bg-white/5 p-2 rounded-xl border border-white/10">🧤</div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">Świąteczne Rękawice (Poz. {glovesLevel})</span>
                    <span className="text-[10px] text-slate-400">+1.5 mocy tapnięcia i +1.2% produkcji/s za poziom.</span>
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

            {/* SKLEP ULEPSZEŃ */}
            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-white/10 shadow-2xl mb-5">
              <h3 className="text-white/80 font-bold mb-4 uppercase tracking-widest text-xs flex justify-between px-2">
                <span>Sklep Ulepszeń</span>
                <span className="text-amber-500/70">Produkcja pasywna</span>
              </h3>

              <div className="flex flex-col gap-3">
                {Object.values(UPGRADES).map(upg => {
                  const cost = getCost(upg.id);
                  const canAfford = magic >= cost;
                  const count = inventory[upg.id];

                  return (
                    <div key={upg.id} className="bg-black/40 border border-white/5 rounded-2xl p-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl bg-white/5 p-2 rounded-xl border border-white/10">{upg.icon}</div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{upg.name}</span>
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

            {/* KASYNO ELFA */}
            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-amber-500/25 shadow-xl mb-5">
              <h3 className="text-amber-300 font-bold mb-2 uppercase tracking-widest text-xs px-1">
                🎰 Kasyno Elfa (Ryzyko)
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 px-1">
                Możesz wygrać worek Magii lub x3 na 2 min, ale grozi też pudło albo 5-minutowe zamrożenie.
              </p>
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
            </div>

            {/* SABOTAŻ I WSPARCIE */}
            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-purple-500/20 shadow-xl mb-5">
              <h3 className="text-purple-300 font-bold mb-3 uppercase tracking-widest text-xs px-1">
                ⚔️ Sabotaż i Wsparcie ({opponent?.toUpperCase()})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSabotage('freeze')}
                  disabled={magic < 4000}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= 4000 ? 'bg-cyan-950/50 border-cyan-500/50 hover:bg-cyan-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">🧌 Atak Grincha</div>
                  <div className="text-[10px] text-slate-300 my-1">Zamraża produkcję przeciwnika na 15 min.</div>
                  <div className="text-xs font-mono font-bold text-cyan-300">4000 ✨</div>
                </button>

                <button
                  onClick={() => handleSabotage('chocolate')}
                  disabled={magic < 2500}
                  className={`p-3 rounded-2xl border text-left transition-all ${magic >= 2500 ? 'bg-amber-950/50 border-amber-500/50 hover:bg-amber-900/50 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-50'}`}
                >
                  <div className="font-bold text-sm">☕ Gorąca Czekolada</div>
                  <div className="text-[10px] text-slate-300 my-1">Daje przeciwnikowi x2 produkcji na 45 min.</div>
                  <div className="text-xs font-mono font-bold text-amber-300">2500 ✨</div>
                </button>
              </div>
            </div>

            {/* PRESTIŻ (ZŁOTE DZWONKI) */}
            <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 border border-yellow-500/30 shadow-xl mb-6">
              <h3 className="text-yellow-300 font-bold mb-1 uppercase tracking-widest text-xs px-1">
                🔔 Prestiż – Złote Dzwonki
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 px-1">
                Próg: {PRESTIGE_THRESHOLD} Magii = 1 Złoty Dzwonek (+15% stałej premii do produkcji i kliknięć).
              </p>
              <button
                onClick={handlePrestige}
                disabled={earnedBellsPreview < 1}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm border transition-all ${earnedBellsPreview >= 1 ? 'bg-yellow-500/20 border-yellow-400 text-yellow-200 hover:bg-yellow-500/30' : 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-60'}`}
              >
                {earnedBellsPreview >= 1 ? `Zdobądź +${earnedBellsPreview} Złoty Dzwonek` : `Brakuje ${PRESTIGE_THRESHOLD - Math.floor(magic)} ✨ do Prestiżu`}
              </button>
            </div>

            <div className="mt-2 flex gap-4 w-full">
              <button onClick={() => setGameState('menu')} className="flex-1 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 text-xs font-bold uppercase py-4 rounded-xl border border-white/10 transition-colors">Wróć do Menu</button>
              <Link to="/" className="flex-1 bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-bold uppercase py-4 rounded-xl border border-red-500/30 transition-colors flex justify-center items-center">Wyjście</Link>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}