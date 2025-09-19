import React, { useRef, useEffect, useState, forwardRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

type CarProps = {
    position?: [number, number, number];
    onPositionChange?: (position: [number, number, number], rotation: number) => void;
    onSendUpdate?: (position: [number, number, number], rotation: number, carModel: string) => void;
    onPlayerFell?: () => void;
    onPlayerRespawn?: (position: [number, number, number], rotation: number, carModel: string) => void;
    onUpdateSelf?: (position: [number, number, number], rotation: number, carModel: string) => void;
    onSelfFell?: () => void;
    onFallingStateChange?: (isFalling: boolean) => void;
    otherPlayers?: Map<string, any>;
    currentPlayerId?: string;
    platformSize: number;
    isWaitingForRound?: boolean;
};

const Car = forwardRef<THREE.Group, CarProps>(({
    position = [0, 0.5, 0],
    onPositionChange,
    onSendUpdate,
    onPlayerFell,
    onPlayerRespawn,
    onUpdateSelf,
    onSelfFell,
    onFallingStateChange,
    otherPlayers,
    currentPlayerId,
    platformSize,
    isWaitingForRound = false
}, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
    const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
    const angleRef = useRef(0);
    const fallingRef = useRef(false);
    const fallTimeRef = useRef(0);
    const rotationVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
    const initialPosition = useRef(new THREE.Vector3(...position));
    const [selectedCar, setSelectedCar] = useState(() => {
        const carNumber = Math.floor(Math.random() * 4) + 1;
        return `/models/car${carNumber}.glb`;
    });
    const jumpVelocityRef = useRef(0);
    const isJumpingRef = useRef(false);
    const jumpCooldownRef = useRef(false);

    const { scene } = useGLTF(selectedCar);

    const getRandomSpawnPosition = () => {
        const randomX = (Math.random() - 0.5) * 120;
        const randomZ = (Math.random() - 0.5) * 120;
        const randomAngle = Math.random() * Math.PI * 2;
        return { position: [randomX, initialPosition.current.y, randomZ] as [number, number, number], angle: randomAngle };
    };

    useEffect(() => {
        if (!ref || !groupRef.current) return;
        if (typeof ref === "function") ref(groupRef.current);
        else ref.current = groupRef.current;
    }, [ref]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.key]: true }));
        const up = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.key]: false }));
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, []);

    const checkCollision = (pos1: THREE.Vector3, pos2: THREE.Vector3, minDistance = 5.5) => {
        return pos1.distanceTo(pos2) < minDistance;
    };

    const handleCollision = (myPos: THREE.Vector3, otherPos: THREE.Vector3, myVelocity: THREE.Vector3) => {
        const separationDirection = new THREE.Vector3().subVectors(myPos, otherPos);
        const distance = separationDirection.length();

        if (distance < 0.1) {
            separationDirection.set(
                (Math.random() - 0.5) * 2,
                0,
                (Math.random() - 0.5) * 2
            );
        }

        separationDirection.normalize();

        const minDistance = 4.5;
        const separationForce = Math.max(0, (minDistance - distance) / minDistance) * 0.5;

        const immediateForce = separationDirection.clone().multiplyScalar(separationForce * 2);
        myPos.add(new THREE.Vector3(immediateForce.x, 0, immediateForce.z));

        const velocityForce = separationDirection.clone().multiplyScalar(0.15);
        myVelocity.add(new THREE.Vector3(velocityForce.x, 0, velocityForce.z));

        const maxVelocity = 0.5;
        if (myVelocity.length() > maxVelocity) {
            myVelocity.normalize().multiplyScalar(maxVelocity);
        }

        return separationDirection;
    };

    const resolveOverlap = (current: THREE.Group) => {
        if (!otherPlayers || !currentPlayerId) return;

        const maxIterations = 3;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let hasOverlap = false;

            Array.from(otherPlayers.values()).forEach(otherPlayer => {
                if (otherPlayer.id !== currentPlayerId && !otherPlayer.falling) {
                    const otherPos = new THREE.Vector3(...otherPlayer.position);
                    const distance = current.position.distanceTo(otherPos);
                    const minDistance = 4.5;

                    if (distance < minDistance) {
                        hasOverlap = true;

                        const direction = new THREE.Vector3()
                            .subVectors(current.position, otherPos)
                            .normalize();

                        if (direction.length() < 0.1) {
                            direction.set(
                                (Math.random() - 0.5) * 2,
                                0,
                                (Math.random() - 0.5) * 2
                            ).normalize();
                        }

                        const pushDistance = (minDistance - distance) * 0.6;
                        const pushVector = direction.multiplyScalar(pushDistance);
                        current.position.add(new THREE.Vector3(pushVector.x, 0, pushVector.z));
                    }
                }
            });

            if (!hasOverlap) break;
        }
    };

    useFrame((state, delta) => {
        const current = groupRef.current;
        if (!current) return;

        const safeDelta = Math.min(delta, 1/30);

        if (fallingRef.current) {
            velocityRef.current.y -= 9.8 * safeDelta;

            const direction = new THREE.Vector3(
                Math.sin(angleRef.current) * velocityRef.current.z,
                0,
                Math.cos(angleRef.current) * velocityRef.current.z
            );
            current.position.add(direction);
            current.position.add(new THREE.Vector3(0, velocityRef.current.y * safeDelta, 0));

            rotationVelocityRef.current.x += 2 * safeDelta;
            current.rotation.x -= rotationVelocityRef.current.x * safeDelta;

            fallTimeRef.current += safeDelta;

            // Notificar mudança para modo espectador após 3 segundos
            if (fallTimeRef.current >= 3 && onFallingStateChange) {
                onFallingStateChange(true);
            }

            // Esconder o carro depois de 3 segundos de queda
            if (fallTimeRef.current >= 3) {
                current.position.set(0, -1000, 0);
                current.visible = false;
            }
            return;
        }

        // Lógica do pulo
        if (keys[" "] && !isJumpingRef.current && !jumpCooldownRef.current) {
            jumpVelocityRef.current = 0.5; // Força inicial do pulo
            isJumpingRef.current = true;
            jumpCooldownRef.current = true;
            setTimeout(() => jumpCooldownRef.current = false, 500); // Cooldown de 1.5 segundos
        }

        if (isJumpingRef.current) {
            jumpVelocityRef.current -= 1.5 * safeDelta; // Gravidade
            current.position.y += jumpVelocityRef.current;

            if (current.position.y <= 0.5) { // Altura base do carro
                current.position.y = 0.5;
                isJumpingRef.current = false;
                jumpVelocityRef.current = 0;
            }
        }

        const velocity = velocityRef.current;
        let angle = angleRef.current;

        const acceleration = 0.02;
        const maxSpeed = 0.4;
        const turnSpeed = 0.03;
        const friction = 0.99;
        const brakeForce = 0.5;
        const reverseAcceleration = 0.01;
        const maxReverseSpeed = 0.2;

        if (keys["ArrowUp"] || keys["w"]) {
            velocity.z = Math.min(velocity.z + acceleration, maxSpeed);
        }

        if (keys["ArrowDown"] || keys["s"]) {
            if (velocity.z > 0.5) {
                velocity.z = Math.max(velocity.z - brakeForce, 0);
            }
            else if (velocity.z <= 0.3 && velocity.z >= -0.2) {
                velocity.z = Math.max(velocity.z - reverseAcceleration, -maxReverseSpeed);
            }
        }

        const speedFactor = Math.abs(velocity.z) / maxSpeed;
        if ((keys["ArrowLeft"] || keys["a"]) && speedFactor > 0.1) {
            angle += turnSpeed * speedFactor;
        }
        if ((keys["ArrowRight"] || keys["d"]) && speedFactor > 0.1) {
            angle -= turnSpeed * speedFactor;
        }

        velocity.multiplyScalar(friction);

        resolveOverlap(current);

        // Modificar a verificação de colisão para considerar a altura
        if (otherPlayers && currentPlayerId) {
            Array.from(otherPlayers.values()).forEach(otherPlayer => {
                if (otherPlayer.id !== currentPlayerId && !otherPlayer.falling) {
                    const otherPos = new THREE.Vector3(...otherPlayer.position);
                    const heightDiff = Math.abs(current.position.y - otherPos.y);

                    if (checkCollision(current.position, otherPos) && heightDiff < 2) {
                        handleCollision(current.position, otherPos, velocity);
                    }
                }
            });
        }

        const movement = new THREE.Vector3(
            Math.sin(angle) * velocity.z,
            0,
            Math.cos(angle) * velocity.z
        );

        current.position.add(movement);
        current.rotation.y = angle;

        const carLength = 3;
        const frontX = current.position.x + Math.sin(angle) * carLength;
        const frontZ = current.position.z + Math.cos(angle) * carLength;

        // Verificar se saiu da plataforma OU se a plataforma é muito pequena
        const platformRadius = platformSize / 2;
        const carDistance = Math.sqrt(current.position.x * current.position.x + current.position.z * current.position.z);

        if (Math.abs(frontX) > platformRadius || Math.abs(frontZ) > platformRadius || carDistance > platformRadius || platformSize <= 5) {
            if (!fallingRef.current) {
                fallingRef.current = true;
                velocityRef.current.y = 0;
                rotationVelocityRef.current.set(0, 0, 0);

                // Parar o tempo imediatamente quando começar a cair
                if (onSelfFell) {
                    onSelfFell();
                }

                if (onPlayerFell) {
                    onPlayerFell();
                }
            }
        }

        current.userData.velocity = velocity.clone();

        if (onPositionChange) {
            onPositionChange([current.position.x, current.position.y, current.position.z], angle);
        }

        if (onUpdateSelf) {
            onUpdateSelf([current.position.x, current.position.y, current.position.z], angle, selectedCar);
        }

        if (onSendUpdate && Math.random() < 0.8) {
            onSendUpdate(
                [current.position.x, current.position.y, current.position.z],
                angle,
                selectedCar
            );
        }

        angleRef.current = angle;
    });

    // Remover os useEffects problemáticos e substituir por um simples
    useEffect(() => {
        const current = groupRef.current;
        if (!current) return;

        // Só resetar quando explicitamente não estiver esperando rodada
        if (!isWaitingForRound) {
            // Reset para nova rodada
            const spawnData = getRandomSpawnPosition();

            current.position.set(...spawnData.position);
            current.visible = true;
            velocityRef.current.set(0, 0, 0);
            rotationVelocityRef.current.set(0, 0, 0);
            angleRef.current = spawnData.angle;
            current.rotation.set(0, spawnData.angle, 0);
            fallingRef.current = false;
            fallTimeRef.current = 0;
            isJumpingRef.current = false;
            jumpVelocityRef.current = 0;

            if (onFallingStateChange) {
                onFallingStateChange(false);
            }

            const carNumber = Math.floor(Math.random() * 4) + 1;
            const newCarPath = `/models/car${carNumber}.glb`;
            setSelectedCar(newCarPath);
        } else {
            // Se está esperando rodada, esconder o carro
            if (current) {
                current.position.set(0, -1000, 0);
                current.visible = false;
                fallingRef.current = false;

                if (onFallingStateChange) {
                    onFallingStateChange(true);
                }
            }
        }
    }, [isWaitingForRound]);

    return (
        <group ref={groupRef} position={position} castShadow>
            <primitive object={scene.clone()} scale={[3.2, 3.2, 3.2]} rotation={[0, Math.PI / 2, 0]} />
        </group>
    );
});

for (let i = 1; i <= 4; i++) {
    useGLTF.preload(`/models/car${i}.glb`);
}

export default Car;
