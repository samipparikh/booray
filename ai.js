// ============ PROBABILITY & TIPS ============

function getBoorayTips(player, phase, game) {
    const tips = [];
    let riskScore = null;
    const hand = player.hand;
    const trumpSuit = game.trumpSuit;

    if (phase === 'declare') {
        const trumpCards = hand.filter(c => c.suit === trumpSuit);
        const highCards = hand.filter(c => c.value >= 12);
        const highTrumps = trumpCards.filter(c => c.value >= 11);

        let strength = trumpCards.length * 2 + highCards.length + highTrumps.length * 1.5;
        riskScore = Math.max(5, Math.min(95, Math.round(100 - strength * 12)));

        if (trumpCards.length >= 2) {
            tips.push(`Strong hand: ${trumpCards.length} trump cards. Playing is recommended.`);
        } else if (trumpCards.length === 1 && highCards.length >= 2) {
            tips.push(`Decent hand: 1 trump + ${highCards.length} high cards. Playing is reasonable.`);
        } else if (trumpCards.length === 0 && highCards.length < 2) {
            tips.push(`Weak hand: no trumps, few high cards. Folding saves your ante risk.`);
        } else {
            tips.push(`Borderline hand. Consider the pot size vs booray penalty risk.`);
        }

        const potRisk = game.pot;
        tips.push(`Pot is $${potRisk}. Getting booray'd costs you $${potRisk} — fold if your hand can't win at least 1 trick.`);

    } else if (phase === 'draw') {
        const nonTrump = hand.filter(c => c.suit !== trumpSuit);
        const lowCards = nonTrump.filter(c => c.value < 10);
        const midCards = nonTrump.filter(c => c.value >= 10 && c.value < 13);

        tips.push(`Discard low non-trump cards to improve your chances.`);
        if (lowCards.length > 0) {
            tips.push(`You have ${lowCards.length} low non-trump card(s) — good discard candidates.`);
        }
        if (hand.filter(c => c.suit === trumpSuit).length >= 3) {
            tips.push(`Heavy in trumps — discard off-suit cards to maximize trick wins.`);
        }
        riskScore = null;

    } else if (phase === 'play') {
        const validCards = game.getValidCards(player);
        if (validCards.length === 1) {
            tips.push(`Only one legal play — no decision needed.`);
        } else {
            const playableCards = validCards.map(i => hand[i]);
            const trumpPlays = playableCards.filter(c => c.suit === trumpSuit);

            if (game.trickCards.length === 0) {
                if (trumpPlays.length > 0) {
                    tips.push(`Leading with a high trump forces others to beat it or lose the trick.`);
                } else {
                    tips.push(`Lead with your strongest suit to establish control.`);
                }
            } else {
                const canWin = playableCards.some(c => {
                    if (c.suit === trumpSuit && game.trickCards.every(tc => tc.card.suit !== trumpSuit || tc.card.value < c.value)) return true;
                    if (c.suit === game.ledSuit && game.trickCards.every(tc => tc.card.suit !== trumpSuit && (tc.card.suit !== game.ledSuit || tc.card.value < c.value))) return true;
                    return false;
                });
                if (canWin) {
                    tips.push(`You can win this trick. Play your lowest winning card to save high cards.`);
                } else {
                    tips.push(`Unlikely to win this trick. Dump your weakest card.`);
                }
            }
        }
        riskScore = null;
    }

    return { riskScore, tips };
}

// ============ AI LOGIC ============

const AI_NAMES_BR = ['Ace', 'Blaze', 'Shadow', 'Jinx', 'Wildcard'];
const AI_STYLES_BR = ['aggressive', 'conservative', 'balanced', 'tricky', 'cautious'];

function createBRPlayers(humanName, aiCount, chips) {
    const players = [{ name: humanName || 'You', chips: chips, tricks: 0, hand: [], folded: false, isAI: false }];
    for (let i = 0; i < aiCount; i++) {
        players.push({
            name: AI_NAMES_BR[i % AI_NAMES_BR.length],
            chips: chips,
            tricks: 0,
            hand: [],
            folded: false,
            isAI: true,
            style: AI_STYLES_BR[i % AI_STYLES_BR.length]
        });
    }
    return players;
}

function aiDeclareDecision(player, trumpSuit, pot, ante) {
    const hand = player.hand;
    let strength = 0;
    const trumpCards = hand.filter(c => c.suit === trumpSuit);
    strength += trumpCards.length * 2;
    const highCards = hand.filter(c => c.value >= 12);
    strength += highCards.length;
    const highTrumps = trumpCards.filter(c => c.value >= 11);
    strength += highTrumps.length * 1.5;

    let threshold;
    switch (player.style) {
        case 'aggressive': threshold = 2; break;
        case 'conservative': threshold = 5; break;
        case 'tricky': threshold = 3 + (Math.random() * 2 - 1); break;
        case 'cautious': threshold = 4.5; break;
        default: threshold = 3.5;
    }

    return strength >= threshold ? 'play' : 'fold';
}

function aiDrawDecision(player, trumpSuit) {
    const discard = [];
    const hand = player.hand;
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (card.suit === trumpSuit) continue;
        if (card.value >= 13) continue;
        if (card.value < 10) discard.push(i);
        else if (card.value < 12 && Math.random() < 0.4) discard.push(i);
    }
    const maxDiscard = player.style === 'aggressive' ? 3 : player.style === 'conservative' ? 2 : 3;
    return discard.slice(0, maxDiscard);
}

function aiPlayCard(player, validCardIndices, trickCards, ledSuit, trumpSuit) {
    if (validCardIndices.length === 1) return validCardIndices[0];

    const hand = player.hand;
    const validCards = validCardIndices.map(i => ({ index: i, card: hand[i] }));

    if (trickCards.length === 0) {
        const trumps = validCards.filter(c => c.card.suit === trumpSuit);
        if (trumps.length > 0 && (player.style === 'aggressive' || Math.random() < 0.3)) {
            return trumps.sort((a, b) => b.card.value - a.card.value)[0].index;
        }
        const highCards = validCards.filter(c => c.card.value >= 12);
        if (highCards.length > 0) return highCards.sort((a, b) => b.card.value - a.card.value)[0].index;
        return validCards.sort((a, b) => a.card.value - b.card.value)[0].index;
    }

    const currentWinning = getCurrentWinningValue(trickCards, ledSuit, trumpSuit);
    const canWin = validCards.filter(c => wouldBeat(c.card, currentWinning, ledSuit, trumpSuit));

    if (canWin.length > 0) {
        if (player.style === 'conservative') {
            return canWin.sort((a, b) => a.card.value - b.card.value)[0].index;
        }
        return canWin.sort((a, b) => b.card.value - a.card.value)[0].index;
    }

    return validCards.sort((a, b) => a.card.value - b.card.value)[0].index;
}

function getCurrentWinningValue(trickCards, ledSuit, trumpSuit) {
    let best = trickCards[0].card;
    for (let i = 1; i < trickCards.length; i++) {
        const card = trickCards[i].card;
        if (card.suit === trumpSuit && best.suit !== trumpSuit) best = card;
        else if (card.suit === best.suit && card.value > best.value) best = card;
    }
    return best;
}

function wouldBeat(card, current, ledSuit, trumpSuit) {
    if (card.suit === trumpSuit && current.suit !== trumpSuit) return true;
    if (card.suit !== trumpSuit && current.suit === trumpSuit) return false;
    if (card.suit === current.suit) return card.value > current.value;
    return false;
}
