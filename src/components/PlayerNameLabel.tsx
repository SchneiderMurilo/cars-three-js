import React from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";

type PlayerNameLabelProps = {
    position: [number, number, number];
    playerName: string;
    carRotation: number;
};

export default function PlayerNameLabel({ position, playerName, carRotation }: PlayerNameLabelProps) {
    // @ts-ignore
    return (
        <group position={[position[0], position[1] + 5, position[2]]} rotation={[0, carRotation + Math.PI, 0]}>
            {/* Fundo retangular cinza */}
            <mesh>
                <planeGeometry args={[playerName.length * 0.2 + 0.3, 0.5]} />
                <meshBasicMaterial color="#666666" transparent opacity={0.5} />
            </mesh>

            {/* Texto do nome */}
            <Text
                position={[0, 0, 0.01]}
                fontSize={0.3}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                material-transparent={true}
                material-opacity={0.9}
            >
                {playerName}
            </Text>
        </group>
    );
}
