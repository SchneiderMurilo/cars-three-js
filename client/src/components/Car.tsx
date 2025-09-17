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
    otherPlayers?: Map<string, any>;
    currentPlayerId?: string;
};

const Car = forwardRef<THREE.Group, CarProps>(({
    position = [0, 0.5, 0],
    onPositionChange,
    onSendUpdate,
    onPlayerFell,
    onPlayerRespawn,
    onUpdateSelf,
    onSelfFell,
    otherPlayers,
    currentPlayerId
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
        console.log(`Carro selecionado: car${carNumber}.glb`);
        return `/models/car${carNumber}.glb`;
    });

    // Carrega o modelo GLB randomizado
    const { scene } = useGLTF(selectedCar);

    // Função para gerar posição de spawn aleatória
    const getRandomSpawnPosition = () => {
        const randomX = (Math.random() - 0.5) * 120; // 120 de 200 para evitar bordas
        const randomZ = (Math.random() - 0.5) * 120;
        const randomAngle = Math.random() * Math.PI * 2; // rotação aleatória
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

    // Função para detectar colisão entre dois carros
    const checkCollision = (pos1: THREE.Vector3, pos2: THREE.Vector3, minDistance = 5.5) => {
        return pos1.distanceTo(pos2) < minDistance;
    };

    // Função para aplicar física de colisão melhorada
    const handleCollision = (myPos: THREE.Vector3, otherPos: THREE.Vector3, myVelocity: THREE.Vector3) => {
        // Calcula direção de separação
        const separationDirection = new THREE.Vector3().subVectors(myPos, otherPos);
        const distance = separationDirection.length();

        // Se a distância é muito pequena, força uma direção aleatória
        if (distance < 0.1) {
            separationDirection.set(
                (Math.random() - 0.5) * 2,
                0,
                (Math.random() - 0.5) * 2
            );
        }

        separationDirection.normalize();

        // Força de separação baseada na distância (quanto mais próximo, maior a força)
        const minDistance = 4.5;
        const separationForce = Math.max(0, (minDistance - distance) / minDistance) * 0.5;

        // Aplica separação imediata na posição
        const immediateForce = separationDirection.clone().multiplyScalar(separationForce * 2);
        myPos.add(new THREE.Vector3(immediateForce.x, 0, immediateForce.z));

        // Adiciona força na velocidade para movimento contínuo
        const velocityForce = separationDirection.clone().multiplyScalar(0.15);
        myVelocity.add(new THREE.Vector3(velocityForce.x, 0, velocityForce.z));

        // Limita velocidade após colisão
        const maxVelocity = 0.5;
        if (myVelocity.length() > maxVelocity) {
            myVelocity.normalize().multiplyScalar(maxVelocity);
        }

        return separationDirection;
    };

    // Função para verificar e resolver sobreposição
    const resolveOverlap = (current: THREE.Group) => {
        if (!otherPlayers || !currentPlayerId) return;

        const maxIterations = 3; // Múltiplas iterações para resolver sobreposições complexas

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let hasOverlap = false;

            Array.from(otherPlayers.values()).forEach(otherPlayer => {
                if (otherPlayer.id !== currentPlayerId && !otherPlayer.falling) {
                    const otherPos = new THREE.Vector3(...otherPlayer.position);
                    const distance = current.position.distanceTo(otherPos);
                    const minDistance = 4.5;

                    if (distance < minDistance) {
                        hasOverlap = true;

                        // Calcula direção de separação
                        const direction = new THREE.Vector3()
                            .subVectors(current.position, otherPos)
                            .normalize();

                        // Se não há direção clara, usa uma aleatória
                        if (direction.length() < 0.1) {
                            direction.set(
                                (Math.random() - 0.5) * 2,
                                0,
                                (Math.random() - 0.5) * 2
                            ).normalize();
                        }

                        // Move para fora da zona de colisão
                        const pushDistance = (minDistance - distance) * 0.6;
                        const pushVector = direction.multiplyScalar(pushDistance);
                        current.position.add(new THREE.Vector3(pushVector.x, 0, pushVector.z));
                    }
                }
            });

            // Se não há mais sobreposições, para as iterações
            if (!hasOverlap) break;
        }
    };

    useFrame((state, delta) => {
        const current = groupRef.current;
        if (!current) return;

        // Garante delta mínimo para evitar pausa total
        const safeDelta = Math.min(delta, 1/30); // Máximo de 30fps como fallback

        // Se está caindo, apenas aplica gravidade e rotação
        if (fallingRef.current) {
            velocityRef.current.y -= 9.8 * safeDelta; // gravidade

            // Continua movimento horizontal durante a queda
            const direction = new THREE.Vector3(
                Math.sin(angleRef.current) * velocityRef.current.z,
                0,
                Math.cos(angleRef.current) * velocityRef.current.z
            );
            current.position.add(direction);
            current.position.add(new THREE.Vector3(0, velocityRef.current.y * safeDelta, 0));

            // Rotação realista durante a queda (frente cai primeiro)
            rotationVelocityRef.current.x += 2 * safeDelta;
            current.rotation.x -= rotationVelocityRef.current.x * safeDelta;

            fallTimeRef.current += safeDelta;

            // Respawn após 3 segundos
            if (fallTimeRef.current >= 3) {
                // Usa função de spawn aleatório
                const spawnData = getRandomSpawnPosition();

                current.position.set(...spawnData.position);
                velocityRef.current.set(0, 0, 0);
                rotationVelocityRef.current.set(0, 0, 0);
                angleRef.current = spawnData.angle;
                current.rotation.set(0, spawnData.angle, 0);
                fallingRef.current = false;
                fallTimeRef.current = 0;

                // Muda o carro no respawn
                const carNumber = Math.floor(Math.random() * 4) + 1;
                const newCarPath = `/models/car${carNumber}.glb`;
                console.log(`Novo carro selecionado: car${carNumber}.glb`);
                setSelectedCar(newCarPath);

                // Notifica servidor sobre respawn
                if (onPlayerRespawn) {
                    onPlayerRespawn(
                        spawnData.position,
                        spawnData.angle,
                        newCarPath
                    );
                }
            }
            return;
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
            // Se está indo para frente, aplica freio gradual
            if (velocity.z > 0.5) { // threshold mínimo para considerar "parado"
                velocity.z = Math.max(velocity.z - brakeForce, 0);
            }
            // Só permite ré quando realmente parou
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

        // Primeiro resolve qualquer sobreposição existente
        resolveOverlap(current);

        // Verifica colisão com outros jogadores ANTES de aplicar movimento
        if (otherPlayers && currentPlayerId) {
            Array.from(otherPlayers.values()).forEach(otherPlayer => {
                if (otherPlayer.id !== currentPlayerId && !otherPlayer.falling) {
                    const otherPos = new THREE.Vector3(...otherPlayer.position);

                    // Verifica colisão com tolerância maior
                    if (checkCollision(current.position, otherPos)) {
                        handleCollision(current.position, otherPos, velocity);
                    }
                }
            });
        }

        // Calcula movimento com a velocidade (que pode ter sido alterada pela colisão)
        const movement = new THREE.Vector3(
            Math.sin(angle) * velocity.z,
            0,
            Math.cos(angle) * velocity.z
        );

        // Aplica movimento
        current.position.add(movement);
        current.rotation.y = angle;

        // Resolve novamente após movimento para garantir que não há sobreposição
        // Verifica se a frente do carro saiu da plataforma (física mais realista)
        const trackSize = 200;
        const carLength = 3; // comprimento aproximado do carro

        // Calcula posição da frente do carro
        const frontX = current.position.x + Math.sin(angle) * carLength;
        const frontZ = current.position.z + Math.cos(angle) * carLength;

        if (Math.abs(frontX) > trackSize/2 || Math.abs(frontZ) > trackSize/2) {
            if (!fallingRef.current) {
                fallingRef.current = true;
                velocityRef.current.y = 0;
                rotationVelocityRef.current.set(0, 0, 0);

                // Notifica servidor que jogador caiu
                if (onPlayerFell) {
                    onPlayerFell();
                }

                // Atualiza estatísticas locais do próprio jogador
                if (onSelfFell) {
                    onSelfFell();
                }
            }
        }

        // Armazena velocidade para a câmera acessar
        current.userData.velocity = velocity.clone();

        // Atualiza posição para o label do jogador
        if (onPositionChange) {
            onPositionChange([current.position.x, current.position.y, current.position.z], angle);
        }

        // Atualiza próprio jogador no mapa local
        if (onUpdateSelf) {
            onUpdateSelf([current.position.x, current.position.y, current.position.z], angle, selectedCar);
        }

        // Envia atualização via WebSocket com alta frequência
        if (onSendUpdate && Math.random() < 0.8) { // 80% de chance por frame para máxima responsividade
            onSendUpdate(
                [current.position.x, current.position.y, current.position.z],
                angle,
                selectedCar
            );
        }

        angleRef.current = angle;
    });

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
