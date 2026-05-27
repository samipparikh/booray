const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

let settings = { startingChips: 100, ante: 5, potLimit: false, potMax: 100 };
function loadSettings() { const s = localStorage.getItem('booray_settings'); if (s) Object.assign(settings, JSON.parse(s)); }
function saveSettings() { localStorage.setItem('booray_settings', JSON.stringify(settings)); }
loadSettings();

function buildDeck() {
    const cards = [];
    for (const suit of SUITS) for (const rank of RANKS) cards.push({ suit, rank, value: RANK_VALUES[rank] });
    return cards;
}
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function cardDisplay(card) { const isRed = card.suit === '♥' || card.suit === '♦'; return `<span class="card-text ${isRed ? 'red' : ''}">${card.rank}${card.suit}</span>`; }

class Game {
    constructor() {
        this.screens = { menu: document.getElementById('menu-screen'), aiSetup: document.getElementById('ai-setup-screen'), game: document.getElementById('game-screen'), roundEnd: document.getElementById('round-end-screen'), gameOver: document.getElementById('game-over-screen'), rules: document.getElementById('rules-screen'), settings: document.getElementById('settings-screen'), feedback: document.getElementById('feedback-screen') };
        this.isAIMode = false;
        this.playerCount = 4;
        this.players = [];
        this.currentRound = 1;
        this.pot = 0;
        this.trumpSuit = null;
        this.trumpCard = null;
        this.dealerIndex = 0;
        this.deck = [];
        this.phase = 'ante';
        this.trickCards = [];
        this.ledSuit = null;
        this.tricksPlayed = 0;
        this.currentPlayerIndex = 0;
        this.playingPlayers = [];
        this.bindEvents();
        this.updatePlayerNames();
        this.updateSettingsUI();
    }

    bindEvents() {
        document.getElementById('btn-minus').addEventListener('click', () => this.changePlayerCount(-1));
        document.getElementById('btn-plus').addEventListener('click', () => this.changePlayerCount(1));
        document.getElementById('btn-start').addEventListener('click', () => this.startGame());
        document.getElementById('btn-ai-game').addEventListener('click', () => this.showScreen('aiSetup'));
        document.getElementById('btn-start-ai').addEventListener('click', () => this.startAIGame());
        document.getElementById('btn-back-ai').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('ai-minus').addEventListener('click', () => { const el = document.getElementById('ai-count'); el.textContent = Math.max(1, parseInt(el.textContent) - 1); });
        document.getElementById('ai-plus').addEventListener('click', () => { const el = document.getElementById('ai-count'); el.textContent = Math.min(5, parseInt(el.textContent) + 1); });
        document.getElementById('btn-play-online').addEventListener('click', () => this.showOnlineMenu());
        document.getElementById('btn-settings').addEventListener('click', () => this.showScreen('settings'));
        document.getElementById('btn-back-settings').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-rules').addEventListener('click', () => this.showScreen('rules'));
        document.getElementById('btn-back-rules').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-feedback').addEventListener('click', () => this.showScreen('feedback'));
        document.getElementById('btn-back-feedback').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-submit-feedback').addEventListener('click', () => this.submitFeedback());
        document.getElementById('btn-play-again').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-next-round').addEventListener('click', () => this.nextRound());
        document.getElementById('btn-chips-minus').addEventListener('click', () => { settings.startingChips = Math.max(10, settings.startingChips - 10); saveSettings(); this.updateSettingsUI(); });
        document.getElementById('btn-chips-plus').addEventListener('click', () => { settings.startingChips = Math.min(500, settings.startingChips + 10); saveSettings(); this.updateSettingsUI(); });
        document.getElementById('btn-ante-minus').addEventListener('click', () => { settings.ante = Math.max(1, settings.ante - 1); saveSettings(); this.updateSettingsUI(); });
        document.getElementById('btn-ante-plus').addEventListener('click', () => { settings.ante = Math.min(50, settings.ante + 1); saveSettings(); this.updateSettingsUI(); });
        document.getElementById('btn-pot-limit-toggle').addEventListener('click', () => { settings.potLimit = !settings.potLimit; saveSettings(); this.updateSettingsUI(); });
        const potMinusEl = document.getElementById('btn-pot-max-minus');
        const potPlusEl = document.getElementById('btn-pot-max-plus');
        if (potMinusEl) potMinusEl.addEventListener('click', () => { settings.potMax = Math.max(10, settings.potMax - 10); saveSettings(); this.updateSettingsUI(); });
        if (potPlusEl) potPlusEl.addEventListener('click', () => { settings.potMax = Math.min(1000, settings.potMax + 10); saveSettings(); this.updateSettingsUI(); });
    }

    updateSettingsUI() {
        document.getElementById('setting-chips').textContent = settings.startingChips;
        document.getElementById('setting-ante').textContent = settings.ante;
        document.getElementById('setting-pot-limit').textContent = settings.potLimit ? 'ON' : 'OFF';
        const row = document.getElementById('pot-limit-amount-row');
        if (row) row.style.display = settings.potLimit ? 'flex' : 'none';
        const maxEl = document.getElementById('setting-pot-max');
        if (maxEl) maxEl.textContent = settings.potMax;
    }

    showOnlineMenu() {
        if (typeof onlineGame !== 'undefined') onlineGame.showOnlineScreen();
        else { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById('online-screen').classList.add('active'); }
    }

    showScreen(name) { Object.values(this.screens).forEach(s => s.classList.remove('active')); if (this.screens[name]) this.screens[name].classList.add('active'); }
    changePlayerCount(delta) { this.playerCount = Math.max(2, Math.min(6, this.playerCount + delta)); document.getElementById('player-count').textContent = this.playerCount; this.updatePlayerNames(); }

    updatePlayerNames() {
        const container = document.getElementById('player-names');
        container.innerHTML = '';
        for (let i = 0; i < this.playerCount; i++) { const input = document.createElement('input'); input.type = 'text'; input.placeholder = `Player ${i + 1}`; input.dataset.index = i; container.appendChild(input); }
    }

    startGame() {
        const inputs = document.querySelectorAll('#player-names input');
        this.players = Array.from(inputs).map((input, i) => ({ name: input.value.trim() || `Player ${i + 1}`, chips: settings.startingChips, tricks: 0, hand: [], folded: false, isAI: false }));
        this.isAIMode = false;
        this.currentRound = 1; this.pot = 0; this.dealerIndex = 0;
        this.startRound();
    }

    startAIGame() {
        const name = document.getElementById('ai-player-name').value.trim() || 'You';
        const aiCount = parseInt(document.getElementById('ai-count').textContent) || 3;
        this.players = createBRPlayers(name, aiCount, settings.startingChips);
        this.isAIMode = true;
        this.currentRound = 1; this.pot = 0; this.dealerIndex = 0;
        this.startRound();
    }

    startRound() {
        this.deck = shuffle(buildDeck());
        this.phase = 'declare';
        this.tricksPlayed = 0;
        this.trickCards = [];
        this.players.forEach(p => { p.tricks = 0; p.folded = false; p.hand = []; });

        // Ante
        const activePlayers = this.players.filter(p => p.chips > 0);
        activePlayers.forEach(p => { const ante = Math.min(settings.ante, p.chips); p.chips -= ante; this.pot += ante; });

        // Deal 5 cards
        activePlayers.forEach(p => { for (let i = 0; i < 5; i++) p.hand.push(this.deck.pop()); });

        // Trump = dealer's 5th card
        const dealer = this.players[this.dealerIndex];
        if (dealer.hand.length > 0) {
            this.trumpCard = dealer.hand[dealer.hand.length - 1];
            this.trumpSuit = this.trumpCard.suit;
        }

        document.getElementById('current-round').textContent = this.currentRound;
        document.getElementById('pot-amount').textContent = this.pot;
        document.getElementById('trump-card').innerHTML = cardDisplay(this.trumpCard);

        this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
        while (this.players[this.currentPlayerIndex].chips <= 0) this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

        this.showScreen('game');
        this.showDeclarePhase();
    }

    showDeclarePhase() {
        document.getElementById('phase-indicator').textContent = 'Declare: Play or Fold';
        this.updateScoreboard();
        const player = this.players[this.currentPlayerIndex];

        if (player.isAI && this.isAIMode) {
            const humanPlayer = this.players.find(p => !p.isAI);
            if (humanPlayer) this.renderHand(humanPlayer);
            document.getElementById('trick-area').innerHTML = '';
            document.getElementById('action-buttons').innerHTML = '';
            document.getElementById('status-message').textContent = `${player.name} 🤖 is deciding...`;
            setTimeout(() => {
                const decision = aiDeclareDecision(player, this.trumpSuit, this.pot, settings.ante);
                if (decision === 'fold') {
                    player.folded = true;
                    document.getElementById('status-message').textContent = `${player.name} 🤖 folds`;
                } else {
                    document.getElementById('status-message').textContent = `${player.name} 🤖 plays`;
                }
                setTimeout(() => this.advanceDeclare(decision === 'fold'), 600);
            }, 800 + Math.random() * 800);
            return;
        }

        this.renderHand(player);
        document.getElementById('trick-area').innerHTML = '';
        const actions = document.getElementById('action-buttons');
        actions.innerHTML = `<button class="btn-bid" id="btn-play-hand">PLAY</button><button class="btn-liar" id="btn-fold-hand">FOLD</button>`;
        document.getElementById('btn-play-hand').addEventListener('click', () => this.declarePlay());
        document.getElementById('btn-fold-hand').addEventListener('click', () => this.declareFold());
        document.getElementById('status-message').textContent = `${player.name}: Play or Fold?`;
        if (this.isAIMode && !player.isAI) this.showTips('declare');
        else this.hideTips();
    }

    declarePlay() {
        this.advanceDeclare(false);
    }

    declareFold() {
        this.players[this.currentPlayerIndex].folded = true;
        this.advanceDeclare(true);
    }

    advanceDeclare(folded) {
        let next = (this.currentPlayerIndex + 1) % this.players.length;
        let checked = 0;
        while (checked < this.players.length) {
            if (next === this.dealerIndex || this.players[next].chips <= 0) { next = (next + 1) % this.players.length; checked++; continue; }
            break;
        }

        if (next === (this.dealerIndex + 1) % this.players.length || checked >= this.players.length) {
            this.startDrawPhase();
            return;
        }
        this.currentPlayerIndex = next;
        this.showDeclarePhase();
    }

    startDrawPhase() {
        this.playingPlayers = this.players.filter(p => !p.folded && p.chips > 0);
        if (this.playingPlayers.length <= 1) {
            if (this.playingPlayers.length === 1) {
                this.playingPlayers[0].chips += this.pot;
                this.pot = 0;
            }
            this.endRound();
            return;
        }
        this.phase = 'draw';
        this.drawPhaseIndex = 0;
        this.showDrawPhase();
    }

    showDrawPhase() {
        if (this.drawPhaseIndex >= this.playingPlayers.length) { this.startPlayPhase(); return; }
        const player = this.playingPlayers[this.drawPhaseIndex];

        if (player.isAI && this.isAIMode) {
            document.getElementById('phase-indicator').textContent = 'Draw: Discard & Draw';
            document.getElementById('status-message').textContent = `${player.name} 🤖 is drawing...`;
            document.getElementById('action-buttons').innerHTML = '';
            setTimeout(() => {
                const discardIndices = aiDrawDecision(player, this.trumpSuit);
                discardIndices.sort((a, b) => b - a).forEach(i => player.hand.splice(i, 1));
                for (let i = 0; i < discardIndices.length && this.deck.length > 0; i++) player.hand.push(this.deck.pop());
                document.getElementById('status-message').textContent = `${player.name} 🤖 drew ${discardIndices.length} cards`;
                setTimeout(() => { this.drawPhaseIndex++; this.showDrawPhase(); }, 500);
            }, 600 + Math.random() * 600);
            return;
        }

        document.getElementById('phase-indicator').textContent = 'Draw: Discard & Draw';
        this.renderHand(player, true);
        document.getElementById('trick-area').innerHTML = '';
        const actions = document.getElementById('action-buttons');
        actions.innerHTML = `<button class="btn-bid" id="btn-draw-done">DONE (Draw ${0})</button>`;
        document.getElementById('btn-draw-done').addEventListener('click', () => this.finishDraw(player));
        document.getElementById('status-message').textContent = `${player.name}: Select cards to discard, then click Done`;
        this.selectedForDiscard = new Set();
        if (this.isAIMode && !player.isAI) this.showTips('draw');
        else this.hideTips();
    }

    showTips(phase) {
        const panel = document.getElementById('tips-panel');
        if (!panel) return;
        const humanPlayer = this.players.find(p => !p.isAI);
        if (!humanPlayer || humanPlayer.folded) { this.hideTips(); return; }
        const { riskScore, tips } = getBoorayTips(humanPlayer, phase, this);
        let html = '';
        if (riskScore !== null) {
            const color = riskScore >= 65 ? '#e74c3c' : riskScore >= 40 ? '#f39c12' : '#27ae60';
            html += `<div class="risk-meter"><span class="risk-label">Booray Risk:</span><span class="risk-score" style="color:${color}">${riskScore}%</span></div>`;
        }
        html += tips.map(t => `<div class="tip-item">${t}</div>`).join('');
        panel.innerHTML = html;
        panel.style.display = 'block';
    }

    hideTips() {
        const panel = document.getElementById('tips-panel');
        if (panel) panel.style.display = 'none';
    }

    renderHand(player, selectable = false) {
        const container = document.getElementById('hand-area');
        player.hand.sort((a, b) => {
            if (a.suit === this.trumpSuit && b.suit !== this.trumpSuit) return 1;
            if (b.suit === this.trumpSuit && a.suit !== this.trumpSuit) return -1;
            const suitOrder = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
            if (suitOrder !== 0) return suitOrder;
            return a.value - b.value;
        });
        container.innerHTML = player.hand.map((card, i) => {
            const isRed = card.suit === '♥' || card.suit === '♦';
            const isTrump = card.suit === this.trumpSuit;
            return `<div class="hand-card ${isRed ? 'red' : ''} ${isTrump ? 'trump' : ''} ${selectable ? 'selectable' : ''}" data-index="${i}">${card.rank}<span class="card-suit">${card.suit}</span></div>`;
        }).join('');

        if (selectable) {
            container.querySelectorAll('.hand-card').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.dataset.index);
                    if (this.selectedForDiscard.has(idx)) { this.selectedForDiscard.delete(idx); el.classList.remove('selected'); }
                    else { this.selectedForDiscard.add(idx); el.classList.add('selected'); }
                    const btn = document.getElementById('btn-draw-done');
                    if (btn) btn.textContent = `DONE (Draw ${this.selectedForDiscard.size})`;
                });
            });
        }
    }

    finishDraw(player) {
        const indices = [...this.selectedForDiscard].sort((a, b) => b - a);
        indices.forEach(i => player.hand.splice(i, 1));
        const drawCount = indices.length;
        for (let i = 0; i < drawCount && this.deck.length > 0; i++) player.hand.push(this.deck.pop());
        this.drawPhaseIndex++;
        this.showDrawPhase();
    }

    startPlayPhase() {
        this.phase = 'play';
        this.tricksPlayed = 0;
        this.trickCards = [];
        this.ledSuit = null;
        this.trickLeaderIndex = 0;
        this.trickPlayerIndex = 0;
        this.showPlayPhase();
    }

    showPlayPhase() {
        if (this.tricksPlayed >= 5) { this.resolveTricks(); return; }
        const player = this.playingPlayers[this.trickPlayerIndex];
        document.getElementById('phase-indicator').textContent = `Trick ${this.tricksPlayed + 1} of 5`;
        this.updateScoreboard();
        document.getElementById('pot-amount').textContent = this.pot;

        const trickArea = document.getElementById('trick-area');
        trickArea.innerHTML = this.trickCards.map(tc => `<div class="trick-card-played"><span class="trick-player-name">${tc.playerName}</span>${cardDisplay(tc.card)}</div>`).join('');

        if (player.isAI && this.isAIMode) {
            const humanPlayer = this.players.find(p => !p.isAI);
            if (humanPlayer && !humanPlayer.folded) this.renderPlayableHand(humanPlayer);
            document.getElementById('action-buttons').innerHTML = '';
            document.getElementById('status-message').textContent = `${player.name} 🤖 is playing...`;
            setTimeout(() => {
                const validCards = this.getValidCards(player);
                const cardIdx = aiPlayCard(player, validCards, this.trickCards, this.ledSuit, this.trumpSuit);
                this.playCard(player, cardIdx);
            }, 700 + Math.random() * 800);
            return;
        }

        this.renderPlayableHand(player);
        document.getElementById('action-buttons').innerHTML = '';
        document.getElementById('status-message').textContent = `${player.name}'s turn to play`;
        if (this.isAIMode && !player.isAI) this.showTips('play');
        else this.hideTips();
    }

    renderPlayableHand(player) {
        const validCards = this.getValidCards(player);
        const container = document.getElementById('hand-area');
        container.innerHTML = player.hand.map((card, i) => {
            const isRed = card.suit === '♥' || card.suit === '♦';
            const isTrump = card.suit === this.trumpSuit;
            const playable = validCards.includes(i);
            return `<div class="hand-card ${isRed ? 'red' : ''} ${isTrump ? 'trump' : ''} ${playable ? 'playable' : 'dimmed'}" data-index="${i}">${card.rank}<span class="card-suit">${card.suit}</span></div>`;
        }).join('');

        container.querySelectorAll('.hand-card.playable').forEach(el => {
            el.addEventListener('click', () => this.playCard(player, parseInt(el.dataset.index)));
        });
    }

    getValidCards(player) {
        const hand = player.hand;
        if (this.trickCards.length === 0) return hand.map((_, i) => i);

        const suitCards = hand.map((c, i) => ({ c, i })).filter(x => x.c.suit === this.ledSuit);
        if (suitCards.length > 0) return suitCards.map(x => x.i);

        const trumpCards = hand.map((c, i) => ({ c, i })).filter(x => x.c.suit === this.trumpSuit);
        if (trumpCards.length > 0) {
            const highestTrumpPlayed = Math.max(...this.trickCards.filter(tc => tc.card.suit === this.trumpSuit).map(tc => tc.card.value), 0);
            const beaters = trumpCards.filter(x => x.c.value > highestTrumpPlayed);
            if (beaters.length > 0) return beaters.map(x => x.i);
            return trumpCards.map(x => x.i);
        }

        return hand.map((_, i) => i);
    }

    playCard(player, cardIndex) {
        const card = player.hand.splice(cardIndex, 1)[0];
        if (this.trickCards.length === 0) this.ledSuit = card.suit;
        this.trickCards.push({ card, playerName: player.name, playerIndex: this.playingPlayers.indexOf(player) });

        this.trickPlayerIndex++;
        if (this.trickPlayerIndex >= this.playingPlayers.length) {
            this.resolveTrick();
        } else {
            this.showPlayPhase();
        }
    }

    resolveTrick() {
        let winnerIndex = 0;
        let winningCard = this.trickCards[0].card;
        for (let i = 1; i < this.trickCards.length; i++) {
            const card = this.trickCards[i].card;
            if (this.beats(card, winningCard)) { winningCard = card; winnerIndex = i; }
        }
        const winner = this.playingPlayers[this.trickCards[winnerIndex].playerIndex];
        winner.tricks++;
        document.getElementById('status-message').textContent = `${winner.name} wins the trick!`;
        this.trickLeaderIndex = this.trickCards[winnerIndex].playerIndex;

        setTimeout(() => {
            this.tricksPlayed++;
            this.trickCards = [];
            this.ledSuit = null;
            this.trickPlayerIndex = this.trickLeaderIndex;
            this.showPlayPhase();
        }, 1500);
    }

    beats(card, current) {
        if (card.suit === this.trumpSuit && current.suit !== this.trumpSuit) return true;
        if (card.suit !== this.trumpSuit && current.suit === this.trumpSuit) return false;
        if (card.suit === current.suit) return card.value > current.value;
        return false;
    }

    resolveTricks() {
        const maxTricks = Math.max(...this.playingPlayers.map(p => p.tricks));
        const winners = this.playingPlayers.filter(p => p.tricks === maxTricks);
        const boorayd = this.playingPlayers.filter(p => p.tricks === 0);

        if (winners.length === 1) {
            winners[0].chips += this.pot;
            this.pot = 0;
        }

        let boorayPenalty = this.pot;
        if (settings.potLimit) boorayPenalty = Math.min(boorayPenalty, settings.potMax);
        boorayd.forEach(p => { p.chips -= boorayPenalty; this.pot += boorayPenalty; });

        this.endRound();
    }

    endRound() {
        const container = document.getElementById('round-scores');
        container.innerHTML = this.players.filter(p => p.chips > 0 || p.tricks > 0).map(p => {
            const boorayd = !p.folded && p.tricks === 0 && this.playingPlayers.includes(p);
            return `<div class="score-row ${boorayd ? 'boorayd' : ''}"><span class="name">${p.name} ${boorayd ? '💀 BOORAY!' : ''}</span><span class="points">${p.chips} chips (${p.tricks} tricks)</span></div>`;
        }).join('');
        this.showScreen('roundEnd');
    }

    nextRound() {
        const alive = this.players.filter(p => p.chips > 0);
        if (alive.length <= 1) { this.endGame(); return; }
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        while (this.players[this.dealerIndex].chips <= 0) this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        this.currentRound++;
        this.startRound();
    }

    endGame() {
        const sorted = [...this.players].sort((a, b) => b.chips - a.chips);
        document.getElementById('final-scores').innerHTML = sorted.map((p, i) => `<div class="score-row ${i === 0 ? 'winner' : ''}"><span class="name">${i === 0 ? '👑 ' : ''}${p.name}</span><span class="points">${p.chips} chips</span></div>`).join('');
        this.showScreen('gameOver');
    }

    updateScoreboard() {
        const container = document.getElementById('scoreboard');
        container.innerHTML = this.players.map((p, i) => {
            const isDealer = i === this.dealerIndex;
            const isOut = p.chips <= 0;
            return `<div class="score-chip ${isOut ? 'eliminated' : ''}"><span class="chip-name">${p.name}${isDealer ? ' 🃏' : ''}</span><span class="chip-score">${p.chips}${p.folded ? ' (folded)' : ''}</span></div>`;
        }).join('');
    }

    submitFeedback() {
        const description = document.getElementById('feedback-description').value.trim();
        const steps = document.getElementById('feedback-steps').value.trim();
        const category = document.getElementById('feedback-category').value;
        if (!description) { alert('Please describe the bug.'); return; }
        const title = `[Bug] [${category}] ${description.substring(0, 60)}`;
        const body = `**Category:** ${category}\n\n**Description:**\n${description}\n\n**Steps to reproduce:**\n${steps || 'N/A'}\n\n**Browser:** ${navigator.userAgent}`;
        window.open(`https://github.com/samipparikh/booray/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`, '_blank');
        document.getElementById('feedback-description').value = '';
        document.getElementById('feedback-steps').value = '';
        this.showScreen('menu');
    }
}

new Game();
