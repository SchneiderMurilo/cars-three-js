const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8888 });

const players = new Map();
const rooms = new Map();
const gameStates = new Map();
const gameIntervals = new Map(); // Adicionar para controlar intervalos


setInterval(() => {
    const now = Date.now();
    players.forEach((player, playerId) => {
        if (now - player.lastHeartbeat > 15000) {

            if (player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify({ type: 'KICKED' }));
                player.ws.close();
            }

            handlePlayerDisconnect(playerId);
        }
    });
}, 10000);

wss.on('connection', (ws) => {
    const playerId = uuidv4();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'JOIN':
                    handlePlayerJoin(ws, playerId, data);
                    break;
                case 'UPDATE_POSITION':
                    handlePositionUpdate(playerId, data);
                    break;
                case 'PLAYER_FELL':
                    handlePlayerFell(playerId, data);
                    break;
                case 'RESPAWN':
                    handlePlayerRespawn(playerId, data);
                    break;
                case 'HEARTBEAT':
                    handleHeartbeat(playerId, data);
                    break;
                case 'PING':
                    ws.send(JSON.stringify({ type: 'PONG' }));
                    break;
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Erro ao processar mensagem:`, error);
        }
    });

    ws.on('close', () => {
        handlePlayerDisconnect(playerId);
    });

    ws.on('error', (error) => {
    });
});

function initializeGameState(roomId) {

    // Limpar intervalo anterior se existir
    if (gameIntervals.has(roomId)) {
        clearInterval(gameIntervals.get(roomId));
        gameIntervals.delete(roomId);
    }

    const gameState = {
        platformSize: 200,
        minPlatformSize: 0,
        shrinkRate: 3.33, // 200/60 = 3.33 para chegar a 0 em 60 segundos
        gameStartTime: Date.now(),
        isActive: false, // Começa inativo
        isWaitingToStart: true,
        waitStartTime: Date.now(),
        waitDuration: 5000, // 5 segundos de espera
        roundNumber: 0
    };

    gameStates.set(roomId, gameState);
    startGameCycle(roomId);
}

function startGameCycle(roomId) {

    // Verificar se já existe um intervalo ativo
    if (gameIntervals.has(roomId)) {
        return;
    }

    const gameInterval = setInterval(() => {
        const gameState = gameStates.get(roomId);
        const room = rooms.get(roomId);

        if (!gameState || !room) {
            clearInterval(gameInterval);
            gameIntervals.delete(roomId);
            return;
        }

        // Se não há jogadores, pausar o ciclo
        if (room.size === 0) {
            return;
        }

        // Fase de espera antes de iniciar nova rodada
        if (gameState.isWaitingToStart) {
            const waitElapsed = Date.now() - gameState.waitStartTime;
            const remainingWait = Math.max(0, Math.ceil((gameState.waitDuration - waitElapsed) / 1000));

            // Broadcast do countdown
            broadcastToRoom(roomId, {
                type: 'WAITING_NEW_ROUND',
                countdown: remainingWait,
                roundNumber: gameState.roundNumber + 1
            });

            if (waitElapsed >= gameState.waitDuration) {
                // Iniciar nova rodada
                startNewRound(roomId);
            }
            return;
        }

        // Fase ativa - diminuir plataforma
        if (gameState.isActive) {
            const oldSize = gameState.platformSize;
            gameState.platformSize = Math.max(
                gameState.minPlatformSize,
                gameState.platformSize - gameState.shrinkRate
            );


            broadcastToRoom(roomId, {
                type: 'PLATFORM_UPDATE',
                platformSize: gameState.platformSize,
                roundNumber: gameState.roundNumber
            });

            // Quando a plataforma chegar a 0
            if (gameState.platformSize <= 0) {
                endCurrentRound(roomId);
            }
        }
    }, 1000);

    // Armazenar o intervalo
    gameIntervals.set(roomId, gameInterval);
}

function startNewRound(roomId) {
    const gameState = gameStates.get(roomId);
    const room = rooms.get(roomId);

    if (!gameState || !room) return;


    // Resetar estado do jogo
    gameState.platformSize = 200;
    gameState.isActive = true;
    gameState.isWaitingToStart = false;
    gameState.gameStartTime = Date.now();
    gameState.roundNumber += 1;

    // Resetar todos os jogadores
    room.forEach(playerId => {
        const player = players.get(playerId);
        if (player) {
            const randomX = (Math.random() - 0.5) * 120;
            const randomZ = (Math.random() - 0.5) * 120;
            const randomAngle = Math.random() * Math.PI * 2;

            player.position = [randomX, 1, randomZ];
            player.rotation = randomAngle;
            player.falling = false;
            player.survivalTime = 0;
            player.joinTime = Date.now();
            player.isWaitingForRound = false;
        }
    });

    // Notificar todos os jogadores
    broadcastToRoom(roomId, {
        type: 'NEW_ROUND_STARTED',
        platformSize: 200,
        roundNumber: gameState.roundNumber
    });
}

function endCurrentRound(roomId) {
    const gameState = gameStates.get(roomId);
    const room = rooms.get(roomId);

    if (!gameState || !room) return;


    // Marcar todos os jogadores vivos como caídos
    room.forEach(playerId => {
        const player = players.get(playerId);
        if (player && !player.falling) {
            player.falling = true;
            player.survivalTime = Date.now() - gameState.gameStartTime;
            player.isWaitingForRound = true;

            broadcastToRoom(roomId, {
                type: 'PLAYER_FELL',
                playerId: playerId,
                survivalTime: player.survivalTime
            });
        }
    });

    // Preparar para próxima rodada
    gameState.isActive = false;
    gameState.isWaitingToStart = true;
    gameState.waitStartTime = Date.now();

    broadcastToRoom(roomId, {
        type: 'ROUND_ENDED',
        roundNumber: gameState.roundNumber
    });
}

function handlePlayerJoin(ws, playerId, data) {
    const roomId = data.roomId || 'default';

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
        initializeGameState(roomId);
    }

    const gameState = gameStates.get(roomId);
    const isWaitingForRound = gameState.isWaitingToStart || !gameState.isActive;

    const player = {
        id: playerId,
        name: data.playerName,
        ws: ws,
        roomId: roomId,
        position: [0, 1, 0],
        rotation: 0,
        carModel: String(data.carModel),
        falling: false,
        survivalTime: 0,
        joinTime: Date.now(),
        lastHeartbeat: Date.now(),
        inactive: false,
        inactiveTime: null,
        isWaitingForRound: isWaitingForRound
    };

    players.set(playerId, player);
    rooms.get(roomId).add(playerId);

    ws.send(JSON.stringify({
        type: 'JOIN_SUCCESS',
        playerId: playerId,
        platformSize: gameState ? gameState.platformSize : 200,
        isWaitingForRound: isWaitingForRound,
        roundNumber: gameState ? gameState.roundNumber : 0
    }));

    const existingPlayers = Array.from(rooms.get(roomId))
        .filter(id => id !== playerId)
        .map(id => {
            const p = players.get(id);
            const currentSurvivalTime = p.falling ? p.survivalTime : (Date.now() - p.joinTime);
            return {
                id: p.id,
                name: p.name,
                position: p.position,
                rotation: p.rotation,
                carModel: String(p.carModel),
                falling: p.falling,
                survivalTime: currentSurvivalTime,
                isWaitingForRound: p.isWaitingForRound
            };
        });

    ws.send(JSON.stringify({
        type: 'EXISTING_PLAYERS',
        players: existingPlayers
    }));

    broadcastToRoom(roomId, {
        type: 'PLAYER_JOINED',
        player: {
            id: playerId,
            name: player.name,
            position: player.position,
            rotation: player.rotation,
            carModel: String(player.carModel),
            falling: player.falling,
            survivalTime: 0,
            isWaitingForRound: isWaitingForRound
        }
    }, playerId);
}

function handlePositionUpdate(playerId, data) {
    const player = players.get(playerId);
    if (!player || player.isWaitingForRound) return; // Não atualizar se estiver esperando

    player.position = data.position;
    player.rotation = data.rotation;
    player.carModel = String(data.carModel);

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_UPDATE',
        playerId: playerId,
        position: data.position,
        rotation: data.rotation,
        carModel: String(data.carModel)
    }, playerId);
}

function handlePlayerFell(playerId, data) {
    const player = players.get(playerId);
    if (!player || player.falling) return;

    player.falling = true;
    player.survivalTime = Date.now() - player.joinTime;
    player.isWaitingForRound = true; // Esperar próxima rodada

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_FELL',
        playerId: playerId,
        survivalTime: player.survivalTime
    }, playerId);

    // Verificar se todos caíram
    checkGameEnd(player.roomId);
}

function checkGameEnd(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const alivePlayers = Array.from(room).filter(playerId => {
        const player = players.get(playerId);
        return player && !player.falling;
    });

    if (alivePlayers.length === 0) {
        // Todos caíram, preparar para próxima rodada
        const gameState = gameStates.get(roomId);
        if (gameState) {
            gameState.isActive = false;
            gameState.isWaitingToStart = true;
            gameState.waitStartTime = Date.now();

            broadcastToRoom(roomId, {
                type: 'ROUND_ENDED',
                roundNumber: gameState.roundNumber
            });
        }
    }
}

function restartGame(roomId) {
    // Esta função não é mais necessária, pois o ciclo do jogo gerencia tudo
    // Remover ou deixar vazia para compatibilidade
    console.log(`[${new Date().toISOString()}] restartGame chamado para sala: ${roomId} - gerenciado pelo ciclo`);
}

function handlePlayerRespawn(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation;
    player.carModel = String(data.carModel);
    player.falling = false;

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_RESPAWN',
        playerId: playerId,
        position: data.position,
        rotation: data.rotation,
        carModel: String(data.carModel)
    }, playerId);
}

function handlePlayerDisconnect(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    if (rooms.has(player.roomId)) {
        rooms.get(player.roomId).delete(playerId);
        if (rooms.get(player.roomId).size === 0) {
            // Limpar intervalo quando sala fica vazia
            if (gameIntervals.has(player.roomId)) {
                clearInterval(gameIntervals.get(player.roomId));
                gameIntervals.delete(player.roomId);
            }
            rooms.delete(player.roomId);
            gameStates.delete(player.roomId);
        }
    }

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_LEFT',
        playerId: playerId
    });

    players.delete(playerId);
}

function handleHeartbeat(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    player.lastHeartbeat = Date.now();
    player.ws.send(JSON.stringify({ type: 'PONG' }));
}

function broadcastToRoom(roomId, message, excludePlayerId = null) {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    room.forEach(playerId => {
        if (playerId === excludePlayerId) return;

        const player = players.get(playerId);
        if (player && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}
