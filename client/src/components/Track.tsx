import React from "react";

export default function Track() {
    const trackSize = 200;

    return (
        <group>
            <mesh position={[0, -1, 0]} receiveShadow>
                <boxGeometry args={[trackSize, 2, trackSize]} />
                <gridHelper args={[200, 40, "#000000", "#000000"]} position={[0, 1, 0]} />
                <meshStandardMaterial color="#b8b8b8" />
            </mesh>
        </group>
    );
}
