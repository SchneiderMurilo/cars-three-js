const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });

const players = new Map();
const rooms = new Map();


setInterval(() => {
    const now = Date.now();
    players.forEach((player, playerId) => {
        if (now - player.lastHeartbeat > 15000 || (player.inactive && now - player.inactiveTime > 10000)) {

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
                case 'INACTIVE':
                    handlePlayerInactive(playerId);
                    break;
                case 'PING':
                    ws.send(JSON.stringify({ type: 'PONG' }));
                    break;
            }
        } catch (error) {
        }
    });

    ws.on('close', () => {
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

    if (!data.focused && !player.inactive) {
        player.inactive = true;
        player.inactiveTime = Date.now();
    }

    if (data.focused && player.inactive) {
        player.inactive = false;
        player.inactiveTime = null;
    }

    player.ws.send(JSON.stringify({ type: 'PONG' }));
}

function handlePlayerInactive(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    player.inactive = true;
    player.inactiveTime = Date.now();
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
