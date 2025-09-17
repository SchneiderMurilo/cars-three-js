import { useEffect, useRef, useState } from 'react';

export function useWebSocket(playerName) {
    const ws = useRef(null);
    const [players, setPlayers] = useState(new Map());
    const [connected, setConnected] = useState(false);
    const [currentPlayerId, setCurrentPlayerId] = useState(null);
    const [playerStats, setPlayerStats] = useState(new Map());
    const heartbeatInterval = useRef(null);
    const isWindowFocused = useRef(true);

    // Função para salvar quedas no localStorage
    const saveFallsToStorage = (playerId, playerName, falls) => {
        const playerData = {
            name: playerName,
            falls: falls,
            lastPlayed: Date.now()
        };
        localStorage.setItem(`player_${playerId}`, JSON.stringify(playerData));

        // Também salva com o nome como chave para recuperar em futuras sessões
        localStorage.setItem(`playerStats_${playerName}`, JSON.stringify(playerData));
    };

    // Função para carregar quedas do localStorage
    const loadFallsFromStorage = (playerName) => {
        try {
            const saved = localStorage.getItem(`playerStats_${playerName}`);
            if (saved) {
                const data = JSON.parse(saved);
                return data.falls || 0;
            }
        } catch (error) {
            console.error('Erro ao carregar quedas do localStorage:', error);
        }
        return 0;
    };

    // Detecta quando a janela perde/ganha foco
    useEffect(() => {
        const handleFocus = () => {
            isWindowFocused.current = true;
            console.log('Janela ganhou foco');
        };

        const handleBlur = () => {
            isWindowFocused.current = false;
            console.log('Janela perdeu foco');
            // Envia sinal de inatividade após 2 segundos sem foco
            setTimeout(() => {
                if (!isWindowFocused.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                    console.log('Enviando sinal de inatividade');
                    ws.current.send(JSON.stringify({ type: 'INACTIVE' }));
                }
            }, 2000);
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                handleBlur();
            } else {
                handleFocus();
            }
        });

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    useEffect(() => {
        if (!playerName) return;

        ws.current = new WebSocket('ws://localhost:8080');

        // Heartbeat mais frequente para detectar desconexões
        heartbeatInterval.current = setInterval(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: 'HEARTBEAT',
                    focused: isWindowFocused.current
                }));
            }
        }, 5000); // A cada 5 segundos

        ws.current.onopen = () => {
            console.log('Conectado ao servidor');
            setConnected(true);

            // Carrega quedas salvas do localStorage
            const savedFalls = loadFallsFromStorage(playerName);
            console.log(`Quedas salvas para ${playerName}:`, savedFalls);

            ws.current.send(JSON.stringify({
                type: 'JOIN',
                playerName: playerName,
                roomId: 'default',
                carModel: Math.floor(Math.random() * 4) + 1,
                savedFalls: savedFalls // Envia quedas salvas para o servidor
            }));
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'JOIN_SUCCESS':
                    console.log('Join success, playerId:', data.playerId);
                    setCurrentPlayerId(data.playerId);

                    // Carrega quedas salvas para usar na inicialização
                    const savedFalls = loadFallsFromStorage(playerName);

                    // Adiciona o próprio jogador imediatamente
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        newMap.set(data.playerId, {
                            id: data.playerId,
                            name: playerName,
                            position: [0, 1, 0],
                            rotation: 0,
                            carModel: Math.floor(Math.random() * 4) + 1,
                            falling: false
                        });
                        console.log('Adicionado próprio jogador ao mapa:', newMap);
                        return newMap;
                    });

                    // Adiciona estatísticas para o próprio jogador com quedas salvas
                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        newStats.set(data.playerId, {
                            name: playerName,
                            falls: savedFalls // Usa quedas salvas do localStorage
                        });
                        console.log('Adicionadas estatísticas do próprio jogador com quedas salvas:', newStats);
                        return newStats;
                    });
                    break;

                case 'EXISTING_PLAYERS':
                    console.log('Jogadores existentes recebidos:', data.players);
                    setPlayers(prev => {
                        const newMap = new Map(prev); // Mantém o jogador atual

                        // Adiciona jogadores existentes
                        data.players.forEach(player => {
                            newMap.set(player.id, player);
                        });

                        console.log('Mapa final de jogadores:', newMap);
                        return newMap;
                    });

                    // Atualiza estatísticas dos jogadores existentes
                    setPlayerStats(prev => {
                        const newStats = new Map(prev); // Mantém as estatísticas do jogador atual

                        data.players.forEach(player => {
                            newStats.set(player.id, {
                                name: player.name,
                                falls: player.falls || 0
                            });
                        });

                        return newStats;
                    });
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
                            falls: data.player.falls || 0 // Usa quedas do servidor
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

                case 'PLAYER_FELL':
                    setPlayers(prev => {
                        const newMap = new Map(prev);
                        const player = newMap.get(data.playerId);
                        if (player) {
                            newMap.set(data.playerId, { ...player, falling: true });
                        }
                        return newMap;
                    });

                    setPlayerStats(prev => {
                        const newStats = new Map(prev);
                        const playerStat = newStats.get(data.playerId);
                        if (playerStat) {
                            const newFalls = playerStat.falls + 1;
                            newStats.set(data.playerId, {
                                ...playerStat,
                                falls: newFalls
                            });

                            // Salva no localStorage se for o jogador atual
                            if (data.playerId === currentPlayerId) {
                                saveFallsToStorage(data.playerId, playerStat.name, newFalls);
                            }
                        }
                        return newStats;
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
                    alert('Você foi desconectado por inatividade!');
                    window.location.reload();
                    break;

                case 'PONG':
                    // Resposta ao heartbeat
                    break;
            }
        };

        ws.current.onclose = () => {
            console.log('Desconectado do servidor');
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
                    const newFalls = playerStat.falls + 1;
                    const updatedStat = {
                        ...playerStat,
                        falls: newFalls
                    };
                    newStats.set(currentPlayerId, updatedStat);

                    // Salva automaticamente no localStorage quando incrementa
                    saveFallsToStorage(currentPlayerId, playerStat.name, newFalls);
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
        sendPositionUpdate,
        sendPlayerFell,
        sendPlayerRespawn,
        updateSelfPlayer,
        incrementSelfFalls
    };
}
