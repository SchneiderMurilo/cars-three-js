import React from "react";

type LeaderboardProps = {
    players: Map<string, any>;
    currentPlayerId?: string;
    playerStats: Map<string, { name: string; falls: number }>;
};

export default function Leaderboard({ players, currentPlayerId, playerStats }: LeaderboardProps) {
    // Combina dados dos jogadores ativos com estatísticas
    const leaderboardData = Array.from(players.values())
        .map(player => ({
            id: player.id,
            name: player.name,
            falls: playerStats.get(player.id)?.falls || 0,
            isCurrentPlayer: player.id === currentPlayerId
        }))
        .sort((a, b) => a.falls - b.falls); // Ordena por menor número de quedas

    const getPositionColor = (index: number) => {
        switch (index) {
            case 0: return "#FFD700"; // Ouro
            case 1: return "#C0C0C0"; // Prata
            case 2: return "#CD7F32"; // Bronze
            default: return "#666666"; // Cinza
        }
    };

    const getPositionIcon = (index: number) => {
        switch (index) {
            case 0: return "🥇";
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
            backgroundColor: "rgba(255, 255, 255, 0.98)", // Mais opaco
            padding: "15px",
            borderRadius: "10px",
            minWidth: "280px",
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)", // Sombra mais forte
            border: "2px solid #ddd",
            zIndex: 1000, // Z-index alto para ficar sempre em primeiro plano
            backdropFilter: "blur(5px)" // Desfoque de fundo para melhor legibilidade
        }}>
            <h3 style={{
                margin: "0 0 15px 0",
                color: "#333",
                fontSize: "18px",
                textAlign: "center",
                borderBottom: "2px solid #eee",
                paddingBottom: "8px",
                fontWeight: "bold"
            }}>
                🏆 Ranking - Menos Quedas
            </h3>

            {leaderboardData.length === 0 ? (
                <div style={{
                    color: "#666",
                    textAlign: "center",
                    fontStyle: "italic",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    padding: "10px",
                    borderRadius: "5px"
                }}>
                    Aguardando jogadores...
                </div>
            ) : (
                leaderboardData.map((player, index) => (
                    <div
                        key={player.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            margin: "5px 0",
                            backgroundColor: player.isCurrentPlayer ? "#e3f2fd" : "rgba(249, 249, 249, 0.95)",
                            borderRadius: "8px",
                            border: player.isCurrentPlayer ? "2px solid #2196f3" : "1px solid #eee",
                            fontWeight: player.isCurrentPlayer ? "bold" : "normal",
                            backdropFilter: "blur(3px)" // Desfoque suave para cada item
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                                fontSize: "16px",
                                minWidth: "30px",
                                textAlign: "center",
                                color: getPositionColor(index)
                            }}>
                                {getPositionIcon(index)}
                            </span>
                            <span style={{
                                color: "#333",
                                fontSize: "14px",
                                maxWidth: "120px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            }}>
                                {player.name}
                                {player.isCurrentPlayer && " (Você)"}
                            </span>
                        </div>
                        
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px"
                        }}>
                            <span style={{ fontSize: "12px", color: "#666" }}>Quedas:</span>
                            <span style={{
                                backgroundColor: player.falls === 0 ? "#4caf50" : "#ff9800",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "bold",
                                minWidth: "20px",
                                textAlign: "center"
                            }}>
                                {player.falls}
                            </span>
                        </div>
                    </div>
                ))
            )}

            <div style={{
                marginTop: "10px",
                paddingTop: "8px",
                borderTop: "1px solid #eee",
                fontSize: "12px",
                color: "#666",
                textAlign: "center",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                borderRadius: "5px",
                padding: "5px"
            }}>
                Jogadores online: {players.size}
            </div>
        </div>
    );
}
