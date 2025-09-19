import React from "react";
import * as THREE from "three";

type TrackProps = {
    platformSize: number;
};

export default function Track({ platformSize }: TrackProps) {
    const warningZone = platformSize < 100;
    const criticalZone = platformSize < 50;
    const finalZone = platformSize <= 20;

    if (platformSize < 5) {
        return null;
    }

    return (
        <group>
            <mesh position={[0, -1, 0]} receiveShadow>
                <boxGeometry args={[platformSize, 2, platformSize]} />
                <meshStandardMaterial
                    color={finalZone ? "#ff0000" : criticalZone ? "#ff6666" : warningZone ? "#ffaa66" : "#8dfc7b"}
                    metalness={0.3}
                    roughness={0.7}
                />
            </mesh>

            {platformSize > 30 && (
                <group position={[0, 0.1, 0]}>
                    {[25, 50, 75, 100].map((radius, index) => (
                        radius < platformSize/2 && (
                            <mesh key={index} position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
                                <ringGeometry args={[radius - 1, radius + 1, 32]} />
                                <meshBasicMaterial
                                    color="#666666"
                                    transparent
                                    opacity={0.3}
                                    side={THREE.DoubleSide}
                                />
                            </mesh>
                        )
                    ))}
                </group>
            )}

            {finalZone && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI/2, 0, 0]}>
                    <ringGeometry args={[Math.max(platformSize/2 - 2, 1), platformSize/2 + 2, 32]} />
                    <meshBasicMaterial
                        color="#ff0000"
                        transparent
                        opacity={Math.sin(Date.now() * 0.02) * 0.5 + 0.5}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}
