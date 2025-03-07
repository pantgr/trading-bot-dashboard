// services/consensusService.js
/**
 * Υπηρεσία που αναλύει σήματα από πολλαπλούς δείκτες και δημιουργεί μια ενιαία απόφαση συναλλαγής
 */

// Βαθμολογία για κάθε τύπο σήματος
const SIGNAL_SCORES = {
  // BUY signals
  RSI_BUY: 2,        // RSI oversold
  BOLLINGER_BUY: 1,  // Price at lower Bollinger band
  EMA_CROSSOVER_BUY: 2, // Golden cross (EMA9 crosses above EMA21)
  FIBONACCI_BUY: 1,  // Price bounce from Fibonacci support

  // SELL signals
  RSI_SELL: -2,      // RSI overbought
  BOLLINGER_SELL: -1, // Price at upper Bollinger band
  EMA_CROSSOVER_SELL: -2, // Death cross (EMA9 crosses below EMA21)
  FIBONACCI_SELL: -1 // Price breaks below Fibonacci support
};

// Όριο βαθμολογίας για εκτέλεση συναλλαγής
const BUY_THRESHOLD = 3;
const SELL_THRESHOLD = -3;
const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 λεπτά

/**
 * Ανάλυση σημάτων για τη δημιουργία consensus
 * @param {Array} signals - Πίνακας με σήματα
 * @param {number} currentTime - Τρέχον timestamp
 * @returns {Object|null} - Σήμα consensus ή null αν δεν υπάρχει αρκετή συναίνεση
 */
const analyzeSignals = (signals, currentTime = Date.now()) => {
  if (!signals || signals.length === 0) {
    return null;
  }

  // Φιλτράρισμα σημάτων που βρίσκονται εντός του χρονικού παραθύρου
  const recentSignals = signals.filter(signal => {
    return (currentTime - signal.time) <= TIME_WINDOW_MS;
  });

  if (recentSignals.length === 0) {
    return null;
  }

  // Αθροισμός των βαθμολογιών
  let totalScore = 0;
  
  recentSignals.forEach(signal => {
    const signalType = `${signal.indicator}_${signal.action}`;
    const score = SIGNAL_SCORES[signalType] || 0;
    totalScore += score;
  });

  // Καταμέτρηση σημάτων ανά ένδειξη και τύπο
  const signalCounts = {
    BUY: {
      RSI: 0,
      BOLLINGER: 0,
      EMA_CROSSOVER: 0,
      FIBONACCI: 0,
      TOTAL: 0
    },
    SELL: {
      RSI: 0,
      BOLLINGER: 0,
      EMA_CROSSOVER: 0,
      FIBONACCI: 0,
      TOTAL: 0
    }
  };

  recentSignals.forEach(signal => {
    signalCounts[signal.action][signal.indicator] += 1;
    signalCounts[signal.action].TOTAL += 1;
  });

  // Προσδιορισμός της τελικής απόφασης
  let consensusAction = null;
  let consensusStrength = 0;
  let consensusReason = '';

  if (totalScore >= BUY_THRESHOLD) {
    consensusAction = 'BUY';
    consensusStrength = totalScore;
    consensusReason = `Strong buy signals (${signalCounts.BUY.TOTAL}) with consensus score ${totalScore}`;
  } else if (totalScore <= SELL_THRESHOLD) {
    consensusAction = 'SELL';
    consensusStrength = Math.abs(totalScore);
    consensusReason = `Strong sell signals (${signalCounts.SELL.TOTAL}) with consensus score ${totalScore}`;
  }

  // Έλεγχος για αντικρουόμενα σήματα
  const conflictRatio = Math.min(signalCounts.BUY.TOTAL, signalCounts.SELL.TOTAL) / 
                         Math.max(signalCounts.BUY.TOTAL, signalCounts.SELL.TOTAL);
                         
  // Αν υπάρχει υψηλό ποσοστό αντικρουόμενων σημάτων, αποφεύγουμε τη συναλλαγή
  if (conflictRatio > 0.5 && Math.max(signalCounts.BUY.TOTAL, signalCounts.SELL.TOTAL) > 1) {
    return null; // Πολλά αντικρουόμενα σήματα, δεν παίρνουμε απόφαση
  }

  // Έλεγχος για diversity στους δείκτες
  let diversityCount = 0;
  for (const indicator of ['RSI', 'BOLLINGER', 'EMA_CROSSOVER', 'FIBONACCI']) {
    if (consensusAction === 'BUY' && signalCounts.BUY[indicator] > 0) {
      diversityCount++;
    } else if (consensusAction === 'SELL' && signalCounts.SELL[indicator] > 0) {
      diversityCount++;
    }
  }

  // Ενισχυμένη απόφαση αν υπάρχει ποικιλία δεικτών
  if (diversityCount >= 2) {
    consensusStrength += diversityCount - 1;
    consensusReason += ` with confirmation from ${diversityCount} different indicators`;
  }

  if (!consensusAction) {
    return null;
  }

  // Δημιουργία του σήματος consensus
  return {
    action: consensusAction,
    strength: consensusStrength,
    reason: consensusReason,
    signals: recentSignals,
    time: currentTime,
    score: totalScore
  };
};

// Δημιουργία του κρίσιμου σήματος
const createConsensusSignal = (consensus, symbol, price) => {
  if (!consensus) return null;

  return {
    symbol,
    time: consensus.time,
    indicator: 'CONSENSUS',
    action: consensus.action,
    price,
    value: consensus.strength.toString(),
    reason: consensus.reason
  };
};

module.exports = {
  analyzeSignals,
  createConsensusSignal,
  SIGNAL_SCORES,
  BUY_THRESHOLD,
  SELL_THRESHOLD,
  TIME_WINDOW_MS
};
