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
