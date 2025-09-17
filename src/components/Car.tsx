import React, { useRef, useEffect, useState, forwardRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

type CarProps = {
    position?: [number, number, number];
    onPositionChange?: (position: [number, number, number], rotation: number) => void;
};

const Car = forwardRef<THREE.Group, CarProps>(({ position = [0, 0.5, 0], onPositionChange }, ref) => {
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

    useFrame((state, delta) => {
        const current = groupRef.current;
        if (!current) return;

        // Se está caindo, apenas aplica gravidade e rotação
        if (fallingRef.current) {
            velocityRef.current.y -= 9.8 * delta; // gravidade

            // Continua movimento horizontal durante a queda
            const direction = new THREE.Vector3(
                Math.sin(angleRef.current) * velocityRef.current.z,
                0,
                Math.cos(angleRef.current) * velocityRef.current.z
            );
            current.position.add(direction);
            current.position.add(new THREE.Vector3(0, velocityRef.current.y * delta, 0));

            // Rotação realista durante a queda (frente cai primeiro)
            rotationVelocityRef.current.x += 2 * delta;
            current.rotation.x -= rotationVelocityRef.current.x * delta; // mudança aqui: menos ao invés de mais

            fallTimeRef.current += delta;

            // Respawn após 3 segundos
            if (fallTimeRef.current >= 3) {
                // Posição aleatória na plataforma (evita bordas)
                const randomX = (Math.random() - 0.5) * 120; // 120 de 200 para evitar bordas
                const randomZ = (Math.random() - 0.5) * 120;
                const randomAngle = Math.random() * Math.PI * 2; // rotação aleatória

                current.position.set(randomX, initialPosition.current.y, randomZ);
                velocityRef.current.set(0, 0, 0);
                rotationVelocityRef.current.set(0, 0, 0);
                angleRef.current = randomAngle;
                current.rotation.set(0, randomAngle, 0);
                fallingRef.current = false;
                fallTimeRef.current = 0;

                // Muda o carro no respawn
                const carNumber = Math.floor(Math.random() * 4) + 1;
                const newCarPath = `/models/car${carNumber}.glb`;
                console.log(`Novo carro selecionado: car${carNumber}.glb`);
                setSelectedCar(newCarPath);
            }
            return;
        }

        const velocity = velocityRef.current;
        let angle = angleRef.current;

        const acceleration = 0.02;
        const maxSpeed = 0.5;
        const turnSpeed = 0.03;
        const friction = 0.99;
        const brakeForce = 0.08; // força do freio (mais fraca que aceleração)
        const reverseAcceleration = 0.01; // aceleração em ré (mais lenta)
        const maxReverseSpeed = 0.2; // velocidade máxima em ré (mais baixa)

        if (keys["ArrowUp"] || keys["w"]) {
            velocity.z = Math.min(velocity.z + acceleration, maxSpeed);
        }

        if (keys["ArrowDown"] || keys["s"]) {
            // Se está indo para frente, aplica freio gradual
            if (velocity.z > 0.8) { // threshold mínimo para considerar "parado"
                velocity.z = Math.max(velocity.z - brakeForce, 0);
            }
            // Só permite ré quando realmente parou
            else if (velocity.z <= 0.2 && velocity.z >= -0.1) {
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

        const direction = new THREE.Vector3(
            Math.sin(angle) * velocity.z,
            0,
            Math.cos(angle) * velocity.z
        );

        current.position.add(direction);
        current.rotation.y = angle;

        // Verifica se a frente do carro saiu da plataforma (física mais realista)
        const trackSize = 200;
        const carLength = 3; // comprimento aproximado do carro

        // Calcula posição da frente do carro
        const frontX = current.position.x + Math.sin(angle) * carLength;
        const frontZ = current.position.z + Math.cos(angle) * carLength;

        if (Math.abs(frontX) > trackSize/2 || Math.abs(frontZ) > trackSize/2) {
            if (!fallingRef.current) {
                fallingRef.current = true;
                velocityRef.current.y = 0; // inicia queda
                rotationVelocityRef.current.set(0, 0, 0);
            }
        }

        // Armazena velocidade para a câmera acessar
        current.userData.velocity = velocity.clone();

        // Atualiza posição para o label do jogador
        if (onPositionChange) {
            onPositionChange([current.position.x, current.position.y, current.position.z], angle);
        }

        angleRef.current = angle;
    });

    return (
        <group ref={groupRef} position={position} castShadow>
            <primitive object={scene.clone()} scale={[5, 5, 5]} rotation={[0, Math.PI / 2, 0]} />
        </group>
    );
});

for (let i = 1; i <= 4; i++) {
    useGLTF.preload(`/models/car${i}.glb`);
}

export default Car;
