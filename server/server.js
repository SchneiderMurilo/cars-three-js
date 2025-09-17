const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });

const players = new Map();
const rooms = new Map();

console.log('Servidor WebSocket rodando na porta 8080');

// Verifica inatividade dos jogadores a cada 10 segundos
setInterval(() => {
    const now = Date.now();
    players.forEach((player, playerId) => {
        // Se não recebeu heartbeat há mais de 15 segundos ou está inativo há mais de 10 segundos
        if (now - player.lastHeartbeat > 15000 || (player.inactive && now - player.inactiveTime > 10000)) {
            console.log(`Kickando jogador inativo: ${player.name}`);

            // Envia mensagem de kick
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
    console.log(`Jogador ${playerId} conectado`);

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
            console.error('Erro ao processar mensagem:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Jogador ${playerId} desconectado`);
        handlePlayerDisconnect(playerId);
    });

    ws.on('error', (error) => {
        console.error('Erro WebSocket:', error);
    });
});

function handlePlayerJoin(ws, playerId, data) {
    const roomId = data.roomId || 'default';

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }

    // Usa quedas salvas se fornecidas, senão inicia com 0
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
        falls: savedFalls, // Usa quedas salvas do localStorage
        lastHeartbeat: Date.now(),
        inactive: false,
        inactiveTime: null
    };

    players.set(playerId, player);
    rooms.get(roomId).add(playerId);

    console.log(`Jogador ${player.name} entrou na sala ${roomId} com ${savedFalls} quedas salvas`);

    // Envia confirmação de join com ID do jogador
    ws.send(JSON.stringify({
        type: 'JOIN_SUCCESS',
        playerId: playerId
    }));

    // Envia lista de jogadores existentes para o novo jogador
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

    // Notifica outros jogadores sobre o novo jogador (inclui quedas salvas)
    broadcastToRoom(roomId, {
        type: 'PLAYER_JOINED',
        player: {
            id: playerId,
            name: player.name,
            position: player.position,
            rotation: player.rotation,
            carModel: String(player.carModel),
            falling: player.falling,
            falls: player.falls // Inclui quedas salvas na notificação
        }
    }, playerId);

    console.log(`Jogador ${player.name} entrou na sala ${roomId}`);
}

function handlePositionUpdate(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation;
    player.carModel = String(data.carModel); // Garante que seja string

    // Broadcast da posição para outros jogadores na mesma sala (sem throttling no servidor)
    broadcastToRoom(player.roomId, {
        type: 'PLAYER_UPDATE',
        playerId: playerId,
        position: data.position,
        rotation: data.rotation,
        carModel: String(data.carModel) // Garante que seja string
    }, playerId);
}

function handlePlayerFell(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    player.falling = true;
    player.falls += 1; // Incrementa contador de quedas

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
    player.carModel = String(data.carModel); // Garante que seja string
    player.falling = false;

    broadcastToRoom(player.roomId, {
        type: 'PLAYER_RESPAWN',
        playerId: playerId,
        position: data.position,
        rotation: data.rotation,
        carModel: String(data.carModel) // Garante que seja string
    }, playerId);
}

function handlePlayerDisconnect(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    // Remove da sala
    if (rooms.has(player.roomId)) {
        rooms.get(player.roomId).delete(playerId);
        if (rooms.get(player.roomId).size === 0) {
            rooms.delete(player.roomId);
        }
    }

    // Notifica outros jogadores
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

    // Se o jogador perdeu o foco da janela
    if (!data.focused && !player.inactive) {
        player.inactive = true;
        player.inactiveTime = Date.now();
        console.log(`Jogador ${player.name} ficou inativo`);
    }

    // Se o jogador recuperou o foco
    if (data.focused && player.inactive) {
        player.inactive = false;
        player.inactiveTime = null;
        console.log(`Jogador ${player.name} voltou a ficar ativo`);
    }

    // Responde ao heartbeat
    player.ws.send(JSON.stringify({ type: 'PONG' }));
}

function handlePlayerInactive(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    player.inactive = true;
    player.inactiveTime = Date.now();
    console.log(`Jogador ${player.name} reportou inatividade`);
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
