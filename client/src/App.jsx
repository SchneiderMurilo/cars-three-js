import React, { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import Car from "./components/Car";
import Track from "./components/Track";
import Camera from "./components/Camera";
import Leaderboard from "./components/Leaderboard";
import PlayerName from "./components/PlayerName";
import PlayerNameLabel from "./components/PlayerNameLabel";
import OtherPlayer from "./components/OtherPlayer";
import { useWebSocket } from "./hooks/useWebSocket";
import Logo from "./components/Logo.js";

function App() {
    const carRef = useRef();
    const [playerName, setPlayerName] = useState("");
    const [carPosition, setCarPosition] = useState([0, 1, 0]);
    const [carRotation, setCarRotation] = useState(0);
    const [isPlayerFallen, setIsPlayerFallen] = useState(false);

    const {
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
    } = useWebSocket(playerName);

    const handlePositionChange = (position, rotation) => {
        setCarPosition(position);
        setCarRotation(rotation);
    };

    const handleUpdateSelf = (position, rotation, carModel) => {
        if (updateSelfPlayer) {
            updateSelfPlayer(position, rotation, carModel);
        }
    };

    const handleSelfFell = () => {
        // Parar o tempo imediatamente quando começar a cair
        if (stopPlayerTime) {
            stopPlayerTime();
        }

        if (incrementSelfFalls) {
            incrementSelfFalls();
        }
    };

    const handleFallingStateChange = (isFalling) => {
        setIsPlayerFallen(isFalling);
    };

    // Determinar se deve estar em modo espectador
    const shouldBeSpectator = isWaitingForRound || isPlayerFallen;

    // Remover o useEffect problemático que estava causando loops
    // useEffect(() => {
    //     if (!isWaitingForRound && !isPlayerFallen) {
    //         setIsPlayerFallen(false);
    //     }
    // }, [isWaitingForRound, isPlayerFallen]);

    return (
        <div style={{ width: "100vw", height: "100vh", backgroundColor: "white" }}>
            <Logo/>
            <PlayerName onNameSet={setPlayerName} />
            <Leaderboard
                players={players}
                currentPlayerId={currentPlayerId}
                playerStats={playerStats}
            />

            {/* Indicador de estado do jogador */}
            {shouldBeSpectator && (
                <div style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "rgba(0, 0, 0, 0.9)",
                    color: "white",
                    padding: "20px 30px",
                    borderRadius: "15px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    textAlign: "center",
                    zIndex: 1000,
                    border: "2px solid #fff",
                    minWidth: "300px"
                }}>
                    {waitingCountdown > 0 ? (
                        <>
                            🕐 Próxima Rodada em: {waitingCountdown}s
                        </>
                    ) : (
                        <>
                            🚁 Modo Espectador
                            <br />
                            <span style={{ fontSize: "14px", opacity: 0.8 }}>
                                Aguardando próxima rodada...
                            </span>
                        </>
                    )}
                </div>
            )}


            <div style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                color: "white",
                padding: "10px 15px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                zIndex: 1000
            }}>
                📐 Plataforma: {Math.max(0, Math.round(platformSize))}m
                {platformSize <= 20 && " 🚨 PERIGO!"}
            </div>

            {/* Indicador de conexão */}
            <div style={{
                position: "absolute",
                top: 20,
                right: 20,
                color: connected ? "green" : "red",
                fontSize: "16px"
            }}>
                {connected ? "● Online" : "● Offline"}
            </div>

            <Canvas
                shadows
                camera={{ position: [0, 8, 15], fov: 60 }}
                frameloop="always"
                gl={{ preserveDrawingBuffer: true }}
                onCreated={({ gl }) => {
                    gl.setAnimationLoop = (callback) => {
                        const animate = () => {
                            if (callback) callback();
                            requestAnimationFrame(animate);
                        };
                        animate();
                    };
                }}
            >
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[20, 20, 10]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-camera-left={-50}
                    shadow-camera-right={50}
                    shadow-camera-top={50}
                    shadow-camera-bottom={-50}
                />

                <Track platformSize={platformSize} />

                {/* Renderizar o carro sempre, mas ele será invisível quando cair */}
                <Car
                    ref={carRef}
                    position={[0, 1, 0]}
                    onPositionChange={handlePositionChange}
                    onSendUpdate={sendPositionUpdate}
                    onPlayerFell={sendPlayerFell}
                    onPlayerRespawn={sendPlayerRespawn}
                    onUpdateSelf={handleUpdateSelf}
                    onSelfFell={handleSelfFell}
                    onFallingStateChange={handleFallingStateChange}
                    otherPlayers={players}
                    currentPlayerId={currentPlayerId}
                    platformSize={platformSize}
                    isWaitingForRound={isWaitingForRound}
                />

                <Camera
                    target={carRef}
                    isPlayerFallen={shouldBeSpectator}
                    platformSize={platformSize}
                />

                {Array.from(players.values())
                    .filter(player => player.id !== currentPlayerId && !player.isWaitingForRound)
                    .map((player) => (
                        <OtherPlayer key={player.id} player={player} />
                    ))}
            </Canvas>
        </div>
    );
}

export default App;