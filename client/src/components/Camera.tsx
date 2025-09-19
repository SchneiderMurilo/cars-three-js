import { useFrame, useThree } from "@react-three/fiber";
import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";

type CameraProps = {
    target: React.RefObject<THREE.Group>;
    isPlayerFallen?: boolean;
    platformSize?: number;
};

export default function Camera({ target, isPlayerFallen = false, platformSize = 200 }: CameraProps) {
    const { camera } = useThree();
    const tempPos = new THREE.Vector3();
    const tempTarget = new THREE.Vector3();
    const currentFov = useRef(45);
    const [isSpectating, setIsSpectating] = useState(false);
    const spectatorPosition = useRef(new THREE.Vector3(0, 100, 0));
    const spectatorTarget = useRef(new THREE.Vector3(0, 0, 0));

    useEffect(() => {
        setIsSpectating(isPlayerFallen);
    }, [isPlayerFallen]);

    useFrame(() => {
        if (isSpectating) {
            // Modo espectador - vista superior fixa
            const targetSpectatorPos = new THREE.Vector3(0, 120, 50);
            const targetSpectatorLook = new THREE.Vector3(0, 0, 0);

            // Transição suave para a posição de espectador
            spectatorPosition.current.lerp(targetSpectatorPos, 0.05);
            spectatorTarget.current.lerp(targetSpectatorLook, 0.05);

            camera.position.copy(spectatorPosition.current);
            camera.lookAt(spectatorTarget.current);

            // FOV mais amplo para ver toda a arena
            const targetFov = 80;
            currentFov.current = THREE.MathUtils.lerp(currentFov.current, targetFov, 0.05);
            camera.fov = currentFov.current;
            camera.updateProjectionMatrix();

        } else {
            // Modo de jogo normal - seguir o carro
            if (!target.current) return;

            const carPos = target.current.position;
            const carRot = target.current.rotation.y;

            const velocity = target.current.userData.velocity || new THREE.Vector3();
            const speed = velocity.length();

            const baseFov = 65;
            const maxSpeedFov = 70;
            const targetFov = baseFov + (speed * 0.5);
            const clampedFov = Math.min(targetFov, maxSpeedFov);

            currentFov.current = THREE.MathUtils.lerp(currentFov.current, clampedFov, 0.05);
            camera.fov = currentFov.current;
            camera.updateProjectionMatrix();

            const baseDistance = 10;
            const speedDistance = speed * 0.2;
            const totalDistance = baseDistance + speedDistance;

            const offset = new THREE.Vector3(0, 5, -totalDistance);
            const rotatedOffset = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), carRot);
            tempPos.copy(carPos).add(rotatedOffset);

            camera.position.lerp(tempPos, 0.2);
            camera.lookAt(carPos);

            // Atualizar posições de referência para transição suave
            spectatorPosition.current.copy(camera.position);
            spectatorTarget.current.copy(carPos);
        }
    });

    return null;
}
