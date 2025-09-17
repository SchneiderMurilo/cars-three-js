import React, { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Car from "./components/Car";
import Track from "./components/Track";
import Camera from "./components/Camera";
import Timer from "./components/Timer";
import PlayerName from "./components/PlayerName";
import PlayerNameLabel from "./components/PlayerNameLabel";

function App() {
    const carRef = useRef();
    const [playerName, setPlayerName] = useState("");
    const [carPosition, setCarPosition] = useState([0, 1, 0]);
    const [carRotation, setCarRotation] = useState(0);

    const handlePositionChange = (position, rotation) => {
        setCarPosition(position);
        setCarRotation(rotation);
    };

    return (
        <div style={{ width: "100vw", height: "100vh", backgroundColor: "white" }}>
            <PlayerName onNameSet={setPlayerName} />
            <Timer />
            <Canvas shadows camera={{ position: [0, 8, 15], fov: 60 }}>
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
                />
                <Camera target={carRef} />

                {/* Label do jogador */}
                {playerName && (
                    <PlayerNameLabel
                        position={carPosition}
                        playerName={playerName}
                        carRotation={carRotation}
                    />
                )}
            </Canvas>
        </div>
    );
}

export default App;