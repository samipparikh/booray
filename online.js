class OnlineGame {
    constructor() {
        this.db = firebase.database();
        this.roomRef = null;
        this.roomCode = null;
        this.playerId = null;
        this.playerName = null;
        this.isHost = false;
        this.activeGamesListener = null;
        this.screens = { menu: document.getElementById('menu-screen'), online: document.getElementById('online-screen'), lobby: document.getElementById('lobby-screen'), onlineGame: document.getElementById('online-game-screen'), onlineRoundEnd: document.getElementById('online-round-end-screen'), onlineGameOver: document.getElementById('online-game-over-screen') };
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-create-room').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('btn-join-room').addEventListener('click', () => this.showJoinRoom());
        document.getElementById('btn-back-online').addEventListener('click', () => { this.stopListeningForActiveGames(); this.showScreen('menu'); });
        document.getElementById('btn-confirm-create').addEventListener('click', () => this.createRoom());
        document.getElementById('btn-confirm-join').addEventListener('click', () => this.joinRoom());
        document.getElementById('btn-start-online').addEventListener('click', () => this.startOnlineGame());
        document.getElementById('btn-leave-room').addEventListener('click', () => this.leaveRoom());
        document.getElementById('btn-online-next-round').addEventListener('click', () => this.onlineNextRound());
        document.getElementById('btn-online-play-again').addEventListener('click', () => this.leaveRoom());
    }

    showScreen(name) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); if (this.screens[name]) this.screens[name].classList.add('active'); else document.getElementById('menu-screen').classList.add('active'); }
    showOnlineScreen() { this.showScreen('online'); this.startListeningForActiveGames(); }
    showCreateRoom() { document.getElementById('online-mode-title').textContent = 'Create Room'; document.getElementById('join-code-group').style.display = 'none'; document.getElementById('btn-confirm-create').style.display = 'block'; document.getElementById('btn-confirm-join').style.display = 'none'; }
    showJoinRoom() { document.getElementById('online-mode-title').textContent = 'Join Room'; document.getElementById('join-code-group').style.display = 'block'; document.getElementById('btn-confirm-create').style.display = 'none'; document.getElementById('btn-confirm-join').style.display = 'block'; }

    startListeningForActiveGames() {
        if (this.activeGamesListener) return;
        const roomsRef = this.db.ref('booray-rooms');
        this.activeGamesListener = roomsRef.orderByChild('state').equalTo('lobby').on('value', (snapshot) => {
            const container = document.getElementById('active-games-list');
            if (!snapshot.exists()) { container.innerHTML = '<p class="no-games">No active games right now</p>'; return; }
            const rooms = snapshot.val();
            const entries = Object.entries(rooms).filter(([c, r]) => Object.keys(r.players || {}).length < 6);
            if (entries.length === 0) { container.innerHTML = '<p class="no-games">No active games right now</p>'; return; }
            container.innerHTML = entries.map(([code, room]) => `<div class="active-game-card" data-code="${code}"><div><span class="active-game-code">${code}</span></div><div class="active-game-players">${Object.keys(room.players || {}).length}/6</div></div>`).join('');
            container.querySelectorAll('.active-game-card').forEach(card => { card.addEventListener('click', () => { document.getElementById('join-code-input').value = card.dataset.code; this.showJoinRoom(); }); });
        });
    }
    stopListeningForActiveGames() { if (this.activeGamesListener) { this.db.ref('booray-rooms').off('value', this.activeGamesListener); this.activeGamesListener = null; } }

    generateRoomCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]; return code; }
    generatePlayerId() { return 'p_' + Math.random().toString(36).substr(2, 9); }

    async createRoom() {
        const name = document.getElementById('online-player-name').value.trim();
        if (!name) { document.getElementById('online-status').textContent = 'Please enter your name'; return; }
        this.playerName = name; this.playerId = this.generatePlayerId(); this.isHost = true; this.roomCode = this.generateRoomCode();
        this.roomRef = this.db.ref('booray-rooms/' + this.roomCode);
        await this.roomRef.set({ code: this.roomCode, host: this.playerId, state: 'lobby', players: { [this.playerId]: { name: this.playerName, connected: true } }, createdAt: firebase.database.ServerValue.TIMESTAMP });
        this.roomRef.child('players/' + this.playerId + '/connected').onDisconnect().set(false);
        this.showLobby(); this.listenToRoom();
    }

    async joinRoom() {
        const name = document.getElementById('online-player-name').value.trim();
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        if (!name) { document.getElementById('online-status').textContent = 'Please enter your name'; return; }
        if (!code) { document.getElementById('online-status').textContent = 'Please enter a room code'; return; }
        this.playerName = name; this.playerId = this.generatePlayerId(); this.isHost = false; this.roomCode = code;
        this.roomRef = this.db.ref('booray-rooms/' + this.roomCode);
        const snapshot = await this.roomRef.once('value');
        if (!snapshot.exists()) { document.getElementById('online-status').textContent = 'Room not found'; return; }
        const room = snapshot.val();
        if (room.state !== 'lobby') { document.getElementById('online-status').textContent = 'Game in progress'; return; }
        if (Object.keys(room.players || {}).length >= 6) { document.getElementById('online-status').textContent = 'Room is full'; return; }
        await this.roomRef.child('players/' + this.playerId).set({ name: this.playerName, connected: true });
        this.roomRef.child('players/' + this.playerId + '/connected').onDisconnect().set(false);
        this.showLobby(); this.listenToRoom();
    }

    showLobby() { document.getElementById('lobby-room-code').textContent = this.roomCode; document.getElementById('btn-start-online').style.display = this.isHost ? 'block' : 'none'; this.showScreen('lobby'); }

    listenToRoom() {
        this.roomRef.on('value', (snapshot) => {
            if (!snapshot.exists()) { this.leaveRoom(); return; }
            const room = snapshot.val();
            this.updateLobbyPlayers(room.players || {});
            if (room.state === 'playing') this.handleGameState(room);
            else if (room.state === 'round_end') this.handleRoundEnd(room);
            else if (room.state === 'game_over') this.handleGameOver(room);
        });
    }

    updateLobbyPlayers(players) {
        const list = document.getElementById('lobby-players');
        list.innerHTML = Object.entries(players).map(([id, p]) => `<div class="lobby-player ${id === this.playerId ? 'me' : ''}">${p.name}${id === this.playerId && this.isHost ? ' (Host)' : ''}</div>`).join('');
        document.getElementById('btn-start-online').disabled = Object.keys(players).length < 2;
    }

    async startOnlineGame() {
        if (!this.isHost) return;
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const playerIds = Object.keys(room.players);
        const chips = {}; playerIds.forEach(id => chips[id] = settings.startingChips);
        await this.roomRef.update({ state: 'playing', currentRound: 1, turnOrder: playerIds, chips, pot: 0, phase: 'waiting', gameSettings: { ante: settings.ante, potLimit: settings.potLimit, potMax: settings.potMax } });
    }

    handleGameState(room) {
        this.showScreen('onlineGame');
        const players = room.players || {};
        const chips = room.chips || {};
        document.getElementById('online-round-info').textContent = `Round ${room.currentRound || 1}`;
        document.getElementById('online-pot-amount').textContent = room.pot || 0;
        document.getElementById('online-phase-indicator').textContent = room.phase || '';
        document.getElementById('online-trump-card').innerHTML = room.trumpCard ? cardDisplay(room.trumpCard) : '';
        const scoreboard = document.getElementById('online-scoreboard');
        const turnOrder = room.turnOrder || [];
        scoreboard.innerHTML = turnOrder.map(id => `<div class="score-chip"><span class="chip-name">${(players[id] || {}).name}</span><span class="chip-score">${chips[id] || 0}</span></div>`).join('');
        document.getElementById('online-status-message').textContent = room.statusMessage || 'Waiting for host to manage the round...';

        const myHand = room.hands ? room.hands[this.playerId] : null;
        const handArea = document.getElementById('online-hand-area');
        if (myHand && Array.isArray(myHand)) {
            handArea.innerHTML = myHand.map((card, i) => {
                const isRed = card.suit === '♥' || card.suit === '♦';
                return `<div class="hand-card ${isRed ? 'red' : ''}" data-index="${i}">${card.rank}<span class="card-suit">${card.suit}</span></div>`;
            }).join('');
        } else {
            handArea.innerHTML = '';
        }
    }

    handleRoundEnd(room) {
        this.showScreen('onlineRoundEnd');
        document.getElementById('online-round-number').textContent = `Round ${room.currentRound || 1} Complete!`;
        const players = room.players || {};
        const chips = room.chips || {};
        const turnOrder = room.turnOrder || [];
        document.getElementById('online-round-scores').innerHTML = turnOrder.map(id => `<div class="score-row"><span class="name">${(players[id] || {}).name}</span><span class="points">${chips[id] || 0} chips</span></div>`).join('');
        document.getElementById('btn-online-next-round').style.display = this.isHost ? 'block' : 'none';
        document.getElementById('online-wait-msg').style.display = this.isHost ? 'none' : 'block';
    }

    async onlineNextRound() { if (!this.isHost) return; await this.roomRef.update({ state: 'playing', currentRound: ((await this.roomRef.once('value')).val().currentRound || 1) + 1, phase: 'waiting', statusMessage: 'New round starting...' }); }

    handleGameOver(room) {
        this.showScreen('onlineGameOver');
        const players = room.players || {};
        const chips = room.chips || {};
        const sorted = Object.entries(chips).sort((a, b) => b[1] - a[1]);
        document.getElementById('online-final-scores').innerHTML = sorted.map(([id, c], i) => `<div class="score-row ${i === 0 ? 'winner' : ''}"><span class="name">${i === 0 ? '👑 ' : ''}${(players[id] || {}).name}</span><span class="points">${c} chips</span></div>`).join('');
    }

    async leaveRoom() {
        if (this.roomRef && this.playerId) { if (this.isHost) await this.roomRef.remove(); else await this.roomRef.child('players/' + this.playerId + '/connected').set(false); }
        this.roomRef = null; this.roomCode = null; this.playerId = null; this.isHost = false; this.showScreen('menu');
    }
}

let onlineGame;
document.addEventListener('DOMContentLoaded', () => { onlineGame = new OnlineGame(); });
