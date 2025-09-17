import React, { useRef, useEffect, useState } from "react";
import { useGLTF, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type OtherPlayerProps = {
    player: {
        id: string;
        name: string;
        position: [number, number, number];
        rotation: number;
        carModel: string | number;
        falling: boolean;
    };
};

export default function OtherPlayer({ player }: OtherPlayerProps) {
    const groupRef = useRef<THREE.Group>(null);
    const nameRef = useRef<THREE.Group>(null);
    const { camera } = useThree();

    const targetPosition = useRef(new THREE.Vector3(...player.position));
    const targetRotation = useRef(player.rotation);
    const fallRotationRef = useRef(0);
    const fallVelocityRef = useRef(0);
    const lastPosition = useRef(new THREE.Vector3(...player.position));
    const [isBeingPushed, setIsBeingPushed] = useState(false);
    const [localFalling, setLocalFalling] = useState(false);
    const rotationVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
    const smoothedPosition = useRef(new THREE.Vector3(...player.position));

    const carNumber = typeof player.carModel === "string"
        ? player.carModel.match(/car(\d+)\.glb/)?.[1] || "1"
        : String(player.carModel);
    const carPath = `/models/car${carNumber}.glb`;
    const { scene } = useGLTF(carPath);

    const getRandomSpawnPosition = (): [number, number, number] => {
        const randomX = (Math.random() - 0.5) * 120;
        const randomZ = (Math.random() - 0.5) * 120;
        return [randomX, 0.5, randomZ];
    };

    useEffect(() => {
        const newPos = new THREE.Vector3(...player.position);
        const oldPos = lastPosition.current;
        const distance = newPos.distanceTo(oldPos);

        if (distance > 50) {
            setLocalFalling(false);
            fallRotationRef.current = 0;
            fallVelocityRef.current = 0;
            rotationVelocityRef.current.set(0, 0, 0);

            if (player.position[0] === 0 && player.position[2] === 0) {
                const randomPos = getRandomSpawnPosition();
                targetPosition.current.set(...randomPos);
            } else {
                targetPosition.current.copy(newPos);
            }
        } else {
            if (distance > 0.8) {
                setIsBeingPushed(true);
                setTimeout(() => setIsBeingPushed(false), 200);
            }
            targetPosition.current.copy(newPos);
        }

        targetRotation.current = player.rotation;
        lastPosition.current.copy(newPos);

        if (!player.falling && localFalling) {
        } else if (player.falling && !localFalling) {
            setLocalFalling(true);
        }
    }, [player.position, player.rotation, player.falling]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const safeDelta = Math.min(delta, 1 / 30);

        const trackSize = 200;
        const carLength = 3;
        const angle = targetRotation.current;

        const frontX = targetPosition.current.x + Math.sin(angle) * carLength;
        const frontZ = targetPosition.current.z + Math.cos(angle) * carLength;

        if ((Math.abs(frontX) > trackSize/2 || Math.abs(frontZ) > trackSize/2) && !localFalling) {
            setLocalFalling(true);
            fallVelocityRef.current = 0;
            rotationVelocityRef.current.set(0, 0, 0);
        }

        if (player.falling || localFalling) {
            fallVelocityRef.current += 9.8 * safeDelta;
            groupRef.current.position.y -= fallVelocityRef.current * safeDelta;

            const horizontalMovement = new THREE.Vector3(
                Math.sin(targetRotation.current) * 0.1,
                0,
                Math.cos(targetRotation.current) * 0.1
            );
            groupRef.current.position.add(horizontalMovement);

            rotationVelocityRef.current.x += 2 * safeDelta;
            groupRef.current.rotation.x -= rotationVelocityRef.current.x * safeDelta;

            const currentY = groupRef.current.rotation.y;
            const targetY = targetRotation.current;
            groupRef.current.rotation.y = THREE.MathUtils.lerp(currentY, targetY, 0.8);
        } else {
            const lerpFactor = isBeingPushed ? 0.8 : 0.15;

            smoothedPosition.current.lerp(targetPosition.current, lerpFactor);
            groupRef.current.position.copy(smoothedPosition.current);

            const currentY = groupRef.current.rotation.y;
            const targetY = targetRotation.current;
            groupRef.current.rotation.y = THREE.MathUtils.lerp(currentY, targetY, lerpFactor);

            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.1);
        }

        if (nameRef.current) {
            nameRef.current.position.set(
                groupRef.current.position.x,
                groupRef.current.position.y + 5,
                groupRef.current.position.z
            );
            nameRef.current.lookAt(camera.position);
        }
    });

    return (
        <group>
            <group ref={groupRef} position={player.position} castShadow>
                <primitive
                    object={scene.clone()}
                    scale={[3.2, 3.2, 3.2]}
                    rotation={[0, Math.PI / 2, 0]}
                />
            </group>

            <group ref={nameRef}>
                <mesh>
                    <planeGeometry args={[player.name.length * 0.5 + 0.5, 0.8]} />
                    <meshBasicMaterial color="#666666" transparent opacity={0.8} />
                </mesh>

                <Text
                    position={[0, 0, 0.01]}
                    fontSize={0.8}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    {player.name}
                </Text>
            </group>
        </group>
    );
}

for (let i = 1; i <= 4; i++) {
    useGLTF.preload(`/models/car${i}.glb`);
}
