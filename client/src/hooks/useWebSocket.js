import { useEffect, useRef, useState } from 'react';

export function useWebSocket(playerName) {
    const ws = useRef(null);
    const [players, setPlayers] = useState(new Map());
    const [connected, setConnected] = useState(false);
    const [currentPlayerId, setCurrentPlayerId] = useState(null);
    const [playerStats, setPlayerStats] = useState(new Map());
    const [platformSize, setPlatformSize] = useState(200);
    const [isWaitingForRound, setIsWaitingForRound] = useState(true);
    const [waitingCountdown, setWaitingCountdown] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const heartbeatInterval = useRef(null);

    const savePlayerRecord = (playerName, survivalTime) => {
        try {
            const records = JSON.parse(localStorage.getItem('playerRecords') || '{}');
            if (!records[playerName] || survivalTime > records[playerName]) {
                records[playerName] = survivalTime;
                localStorage.setItem('playerRecords', JSON.stringify(records));
            }
        } catch (error) {
            console.error('Erro ao salvar recorde:', error);
        }
    };

    const getPlayerRecord = (playerName) => {
        try {
            const records = JSON.parse(localStorage.getItem('playerRecords') || '{}');
            return records[playerName] || 0;
        } catch (error) {
            console.error('Erro ao carregar recorde:', error);
            return 0;
        }
    };

    useEffect(() => {
        if (!playerName) return;

        ws.current = new WebSocket('wss://ioficina.iopoint.com.br/ws/');
        // ws.current = new WebSocket('ws://localhost:8888/');

        heartbeatInterval.current = setInterval(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: 'HEARTBEAT'
                }));
            }
        }, 5000);

        ws.current.onopen = () => {
            setConnected(true);

            ws.current.send(JSON.stringify({
                type: 'JOIN',
                playerName: playerName,
                roomId: 'default',
                carModel: Math.floor(Math.random() * 4) + 1
            }));
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'JOIN_SUCCESS':
                    setCurrentPlayerId(data.playerId);
                    setPlatformSize(data.platformSize);
                    setIsWaitingForRound(data.isWaitingForRound);
                    setCurrentRound(data.roundNumber);

                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        newMap.set(data.playerId, {
                            id: data.playerId,
                            name: playerName,
                            position: [0, 1, 0],
                            rotation: 0,
                            carModel: Math.floor(Math.random() * 4) + 1,
                            falling: false,
                            isWaitingForRound: data.isWaitingForRound
                        });
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        newStats.set(data.playerId, {
                            name: playerName,
                            currentTime: 0,
                            bestTime: getPlayerRecord(playerName),
                            totalRounds: 0
                        });
                        return newStats;
                    });
                    break;

                case 'EXISTING_PLAYERS':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        data.players.forEach(player => {
                            newMap.set(player.id, player);
                        });
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        data.players.forEach(player => {
                            const existingStat = newStats.get(player.id);
                            newStats.set(player.id, {
                                name: player.name,
                                currentTime: player.survivalTime || 0,
                                bestTime: existingStat ? existingStat.bestTime : getPlayerRecord(player.name),
                                totalRounds: existingStat ? existingStat.totalRounds : 0
                            });
                        });
                        return newStats;
                    });
                    break;

                case 'WAITING_NEW_ROUND':
                    setIsWaitingForRound(true);
                    setWaitingCountdown(data.countdown);
                    setCurrentRound(data.roundNumber);
                    break;

                case 'NEW_ROUND_STARTED':
                    setPlatformSize(data.platformSize);
                    setCurrentRound(data.roundNumber);
                    setIsWaitingForRound(false);
                    setWaitingCountdown(0);

                    setPlayers(prev => {
                        const newMap = new Map();
                        prev.forEach((player, id) => {
                            newMap.set(id, {
                                ...player,
                                falling: false,
                                position: [0, 1, 0],
                                isWaitingForRound: false
                            });
                        });
                        return newMap;
                    });

                    // Não limpar os stats, apenas resetar o tempo atual
                    setPlayerStats(prev => {
                        const newStats = new Map();
                        prev.forEach((stat, id) => {
                            newStats.set(id, {
                                ...stat,
                                currentTime: 0
                            });
                        });
                        return newStats;
                    });
                    break;

                case 'ROUND_ENDED':
                    setIsWaitingForRound(true);
                    break;

                case 'PLAYER_JOINED':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        newMap.set(data.player.id, data.player);
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        newStats.set(data.player.id, {
                            name: data.player.name,
                            currentTime: 0,
                            bestTime: getPlayerRecord(data.player.name),
                            totalRounds: 0
                        });
                        return newStats;
                    });
                    break;

                case 'PLAYER_FELL':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        const player = newMap.get(data.playerId);
                        if (player) {
                            newMap.set(data.playerId, {
                                ...player,
                                falling: true,
                                isWaitingForRound: true
                            });
                        }
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        const playerStat = newStats.get(data.playerId);
                        if (playerStat) {
                            const survivalTime = data.survivalTime || 0;
                            const newTotalRounds = playerStat.totalRounds + 1;

                            // Verificar se é um novo recorde
                            const isNewRecord = survivalTime > playerStat.bestTime;
                            const newBestTime = isNewRecord ? survivalTime : playerStat.bestTime;

                            // Salvar recorde se necessário
                            if (isNewRecord) {
                                savePlayerRecord(playerStat.name, survivalTime);
                            }

                            newStats.set(data.playerId, {
                                ...playerStat,
                                currentTime: survivalTime,
                                bestTime: newBestTime,
                                totalRounds: newTotalRounds
                            });
                        }
                        return newStats;
                    });

                    if (data.playerId === currentPlayerId) {
                        setIsWaitingForRound(true);
                    }
                    break;

                case 'PLATFORM_UPDATE':
                    setPlatformSize(data.platformSize);
                    setCurrentRound(data.roundNumber);
                    break;

                case 'GAME_RESTART':
                    setPlatformSize(data.platformSize);
                    setPlayers(prev => {
                        const newMap = new Map();
                        prev.forEach((player, id) => {
                            newMap.set(id, {
                                ...player,
                                falling: false,
                                position: [0, 1, 0]
                            });
                        });
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map();
                        prev.forEach((stat, id) => {
                            newStats.set(id, {
                                ...stat,
                                survivalTime: 0
                            });
                        });
                        return newStats;
                    });
                    break;

                case 'PLAYER_UPDATE':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        const player = newMap.get(data.playerId);
                        if (player) {
                            newMap.set(data.playerId, {
                                ...player,
                                position: data.position,
                                rotation: data.rotation,
                                carModel: data.carModel
                            });
                        }
                        return newMap;
                    });
                    break;

                case 'PLAYER_RESPAWN':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        const player = newMap.get(data.playerId);
                        if (player) {
                            newMap.set(data.playerId, {
                                ...player,
                                position: data.position,
                                rotation: data.rotation,
                                carModel: data.carModel,
                                falling: false
                            });
                        }
                        return newMap;
                    });
                    break;

                case 'PLAYER_LEFT':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(data.playerId);
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        newStats.delete(data.playerId);
                        return newStats;
                    });
                    break;

                case 'KICKED':
                    window.location.reload();
                    break;

                case 'PONG':
                    break;
            }
        };

        ws.current.onclose = () => {
            setConnected(false);
        };

        ws.current.onerror = (error) => {
            console.error('Erro WebSocket:', error);
        };

        return () => {
            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [playerName]);

    const sendPositionUpdate = (position, rotation, carModel) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'UPDATE_POSITION',
                position,
                rotation,
                carModel
            }));
        }
    };

    const sendPlayerFell = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'PLAYER_FELL'
            }));
        }
    };

    const sendPlayerRespawn = (position, rotation, carModel) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'RESPAWN',
                position,
                rotation,
                carModel
            }));
        }
    };

    const updateSelfPlayer = (position, rotation, carModel) => {
        if (currentPlayerId) {
            setPlayers(prev => {
                const newMap = new Map(prev);
                const player = newMap.get(currentPlayerId);
                if (player) {
                    newMap.set(currentPlayerId, {
                        ...player,
                        position,
                        rotation,
                        carModel
                    });
                }
                return newMap;
            });
        }
    };

    const incrementSelfFalls = () => {
        if (currentPlayerId) {
            setPlayerStats(prev => {
                const newStats = new Map(prev);
                const playerStat = newStats.get(currentPlayerId);
                if (playerStat) {
                    // Remover a lógica de falls já que agora usamos survival time
                    // Esta função pode ser mantida para compatibilidade mas não faz nada
                }
                return newStats;
            });
        }
    };

    // Modificar o useEffect para parar o tempo quando cair
    useEffect(() => {
        if (!isWaitingForRound && currentPlayerId) {
            // Definir tempo de início quando a rodada começar
            const startTime = Date.now();

            setPlayerStats(prev => {
                const newStats = new Map(prev);
                const playerStat = newStats.get(currentPlayerId);
                if (playerStat) {
                    newStats.set(currentPlayerId, {
                        ...playerStat,
                        startTime: startTime,
                        currentTime: 0,
                        isFalling: false
                    });
                }
                return newStats;
            });

            // Iniciar intervalo para atualizar tempo atual e verificar recordes
            const timeInterval = setInterval(() => {
                if (!isWaitingForRound && currentPlayerId) {
                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        const playerStat = newStats.get(currentPlayerId);
                        // Só atualizar o tempo se não estiver caindo
                        if (playerStat && playerStat.startTime && !playerStat.isFalling) {
                            const currentTime = Date.now() - playerStat.startTime;

                            // Verificar se é um novo recorde enquanto joga
                            let newBestTime = playerStat.bestTime;
                            if (currentTime > playerStat.bestTime) {
                                newBestTime = currentTime;
                                // Salvar o novo recorde no localStorage
                                savePlayerRecord(playerStat.name, currentTime);
                            }

                            newStats.set(currentPlayerId, {
                                ...playerStat,
                                currentTime: currentTime,
                                bestTime: newBestTime
                            });
                        }
                        return newStats;
                    });
                }
            }, 100);

            return () => clearInterval(timeInterval);
        } else if (isWaitingForRound && currentPlayerId) {
            // Quando estiver esperando rodada, resetar o tempo atual para 0
            setPlayerStats(prev => {
                const newStats = new Map(prev);
                const playerStat = newStats.get(currentPlayerId);
                if (playerStat) {
                    newStats.set(currentPlayerId, {
                        ...playerStat,
                        currentTime: 0,
                        startTime: null,
                        isFalling: false
                    });
                }
                return newStats;
            });
        }
    }, [isWaitingForRound, currentPlayerId]);

    // Função para parar o tempo quando o jogador começar a cair
    const stopPlayerTime = () => {
        if (currentPlayerId) {
            setPlayerStats(prev => {
                const newStats = new Map(prev);
                const playerStat = newStats.get(currentPlayerId);
                if (playerStat && !playerStat.isFalling) {
                    newStats.set(currentPlayerId, {
                        ...playerStat,
                        isFalling: true
                    });
                }
                return newStats;
            });
        }
    };

    return {
        players,
        connected,
        currentPlayerId,
        playerStats,
        platformSize,
        isWaitingForRound,
        waitingCountdown,
        currentRound,
        sendPositionUpdate,
        sendPlayerFell,
        sendPlayerRespawn,
        updateSelfPlayer,
        incrementSelfFalls,
        stopPlayerTime
    };
}
