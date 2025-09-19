const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8888 });

const players = new Map();
const rooms = new Map();


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
    console.log(`[${new Date().toISOString()}] Novo jogador conectado. ID: ${playerId}`);

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
        console.log(`[${new Date().toISOString()}] Jogador desconectado. ID: ${playerId}`);
        handlePlayerDisconnect(playerId);
    });

    ws.on('error', (error) => {
    });
});

function handlePlayerJoin(ws, playerId, data) {
    const roomId = data.roomId || 'default';

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }

    const savedFalls = typeof data.savedFalls === 'number' ? data.savedFalls : 0;

    const player = {
        id: playerId,
        name: data.playerName,
        ws: ws,
        roomId: roomId,
        position: [0, 1, 0],
        rotation: 0,
        carModel: String(data.carModel),
        falling: false,
        falls: savedFalls,
        lastHeartbeat: Date.now(),
        inactive: false,
        inactiveTime: null
    };

    players.set(playerId, player);
    rooms.get(roomId).add(playerId);


    ws.send(JSON.stringify({
        type: 'JOIN_SUCCESS',
        playerId: playerId
    }));

    const existingPlayers = Array.from(rooms.get(roomId))
        .filter(id => id !== playerId)
        .map(id => {
            const p = players.get(id);
            return {
                id: p.id,
                name: p.name,
                position: p.position,
                rotation: p.rotation,
                carModel: String(p.carModel),
                falling: p.falling,
                falls: p.falls
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
            falls: player.falls
        }
    }, playerId);

}

function handlePositionUpdate(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    // Agora incluímos a altura (y) na posição
    player.position = data.position;
    player.rotation = data.rotation;
    player.carModel = String(data.carModel);

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_UPDATE',
        playerId: playerId,
        position: data.position, // Isso já inclui a altura do pulo
        rotation: data.rotation,
        carModel: String(data.carModel)
    }, playerId);
}

function handlePlayerFell(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    player.falling = true;
    player.falls += 1;

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_FELL',
        playerId: playerId,
        falls: player.falls
    }, playerId);
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
            rooms.delete(player.roomId);
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
