import React, { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Car from "./components/Car";
import Track from "./components/Track";
import Camera from "./components/Camera";
import Leaderboard from "./components/Leaderboard";
import PlayerName from "./components/PlayerName";
import PlayerNameLabel from "./components/PlayerNameLabel";
import OtherPlayer from "./components/OtherPlayer";
import { useWebSocket } from "./hooks/useWebSocket";

function App() {
    const carRef = useRef();
    const [playerName, setPlayerName] = useState("");
    const [carPosition, setCarPosition] = useState([0, 1, 0]);
    const [carRotation, setCarRotation] = useState(0);

    const {
        players,
        connected,
        currentPlayerId,
        playerStats,
        sendPositionUpdate,
        sendPlayerFell,
        sendPlayerRespawn,
        updateSelfPlayer,
        incrementSelfFalls
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
        if (incrementSelfFalls) {
            incrementSelfFalls();
        }
    };

    return (
        <div style={{ width: "100vw", height: "100vh", backgroundColor: "white" }}>
            <PlayerName onNameSet={setPlayerName} />
            <Leaderboard
                players={players}
                currentPlayerId={currentPlayerId}
                playerStats={playerStats}
            />

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
                    // Força o canvas a continuar renderizando mesmo quando não está em foco
                    gl.setAnimationLoop = (callback) => {
                        const animate = () => {
                            if (callback) callback();
                            requestAnimationFrame(animate);
                        };
                        animate();
                    };
                }}
            >
                {/* Iluminação */}
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

                {/* Componentes do jogo */}
                <Track />
                <Car
                    ref={carRef}
                    position={[0, 1, 0]}
                    onPositionChange={handlePositionChange}
                    onSendUpdate={sendPositionUpdate}
                    onPlayerFell={sendPlayerFell}
                    onPlayerRespawn={sendPlayerRespawn}
                    onUpdateSelf={handleUpdateSelf}
                    onSelfFell={handleSelfFell}
                    otherPlayers={players}
                    currentPlayerId={currentPlayerId}
                />
                <Camera target={carRef} />

                {/* Outros jogadores */}
                {Array.from(players.values())
                    .filter(player => player.id !== currentPlayerId)
                    .map((player) => (
                        <OtherPlayer key={player.id} player={player} />
                    ))}
            </Canvas>
        </div>
    );
}

export default App;