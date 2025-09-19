import React from "react";

type LeaderboardProps = {
    players: Map<string, any>;
    currentPlayerId?: string;
    playerStats: Map<string, {
        name: string;
        currentTime: number;
        bestTime: number;
        totalRounds: number;
    }>;
};

export default function Leaderboard({ players, currentPlayerId, playerStats }: LeaderboardProps) {
    const formatTime = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10); // Centésimos de segundo

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const leaderboardData = Array.from(players.values())
        .map(player => {
            const stats = playerStats.get(player.id);
            return {
                id: player.id,
                name: player.name,
                currentTime: stats?.currentTime || 0,
                bestTime: stats?.bestTime || 0,
                totalRounds: stats?.totalRounds || 0,
                isCurrentPlayer: player.id === currentPlayerId,
                isAlive: !player.falling
            };
        })
        .sort((a, b) => {
            // Ordenar por melhor tempo (bestTime) em ordem decrescente
            return b.bestTime - a.bestTime;
        });

    const getPositionColor = (index: number) => {
        switch (index) {
            case 0: return "#FFD700"; // Ouro
            case 1: return "#C0C0C0"; // Prata
            case 2: return "#CD7F32"; // Bronze
            default: return "#666666";
        }
    };

    const getPositionIcon = (index: number) => {
        switch (index) {
            case 0: return "👑";
            case 1: return "🥈";
            case 2: return "🥉";
            default: return `${index + 1}º`;
        }
    };

    return (
        <div style={{
            position: "absolute",
            top: 20,
            left: 20,
            backgroundColor: "rgba(0, 0, 0, 0.92)",
            padding: "20px",
            borderRadius: "12px",
            minWidth: "350px",
            maxWidth: "400px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            border: "2px solid #444",
            zIndex: 1000,
            backdropFilter: "blur(10px)",
            fontFamily: "'Roboto Mono', monospace"
        }}>
            <h3 style={{
                margin: "0 0 18px 0",
                color: "#fff",
                fontSize: "20px",
                textAlign: "center",
                borderBottom: "2px solid #555",
                paddingBottom: "12px",
                fontWeight: "bold",
                letterSpacing: "0.5px"
            }}>
                🏆 RECORDES
            </h3>

            {leaderboardData.length === 0 ? (
                <div style={{
                    color: "#aaa",
                    textAlign: "center",
                    fontStyle: "italic",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    padding: "15px",
                    borderRadius: "8px"
                }}>
                    🚗 Aguardando pilotos...
                </div>
            ) : (
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {leaderboardData.map((player, index) => (
                        <div
                            key={player.id}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                padding: "12px 15px",
                                margin: "8px 0",
                                backgroundColor: player.isCurrentPlayer
                                    ? "rgba(33, 150, 243, 0.25)"
                                    : "rgba(255, 255, 255, 0.08)",
                                borderRadius: "10px",
                                border: player.isCurrentPlayer
                                    ? "2px solid #2196f3"
                                    : "1px solid rgba(255, 255, 255, 0.1)",
                                transition: "all 0.3s ease",
                                position: "relative"
                            }}
                        >
                            {/* Header com posição e nome */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "8px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <span style={{
                                        fontSize: "18px",
                                        minWidth: "35px",
                                        textAlign: "center",
                                        color: getPositionColor(index),
                                        fontWeight: "bold"
                                    }}>
                                        {getPositionIcon(index)}
                                    </span>
                                    <div>
                                        <div style={{
                                            color: "#fff",
                                            fontSize: "16px",
                                            fontWeight: "bold",
                                            maxWidth: "140px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {player.name}
                                            {player.isCurrentPlayer && " 👤"}
                                        </div>
                                        <div style={{
                                            fontSize: "11px",
                                            color: "#bbb",
                                            marginTop: "2px"
                                        }}>
                                            {player.isAlive && "🟢 ATIVO"}
                                        </div>
                                    </div>
                                </div>

                                {/* Melhor tempo destacado */}
                                <div style={{ textAlign: "right" }}>
                                    <div style={{
                                        fontSize: "16px",
                                        fontWeight: "bold",
                                        color: player.bestTime > 0 ? "#4caf50" : "#999",
                                        fontFamily: "'Roboto Mono', monospace"
                                    }}>
                                        {player.bestTime > 0 ? formatTime(player.bestTime) : "--:--:--"}
                                    </div>
                                    <div style={{
                                        fontSize: "10px",
                                        color: "#999",
                                        marginTop: "2px"
                                    }}>
                                        RECORDE
                                    </div>
                                </div>
                            </div>

                            {/* Tempo atual - só mostra se o jogador estiver vivo e não esperando rodada */}
                            {player.isAlive && !player.isCurrentPlayer ? null : (
                                player.isAlive && (
                                    <div style={{
                                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        textAlign: "center"
                                    }}>
                                        <div style={{
                                            fontSize: "18px",
                                            fontWeight: "bold",
                                            color: "#00ff88",
                                            fontFamily: "'Roboto Mono', monospace"
                                        }}>
                                            {formatTime(player.currentTime)}
                                        </div>
                                        <div style={{ fontSize: "10px", color: "#aaa" }}>
                                            TEMPO ATUAL
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div style={{
                marginTop: "15px",
                paddingTop: "12px",
                borderTop: "1px solid #555",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
                <div style={{
                    fontSize: "12px",
                    color: "#aaa"
                }}>
                    👥 {players.size} Piloto{players.size !== 1 ? 's' : ''} Online
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
