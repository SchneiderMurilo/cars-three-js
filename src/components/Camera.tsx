import { useFrame, useThree } from "@react-three/fiber";
import React, { useRef } from "react";
import * as THREE from "three";

type CameraProps = {
    target: React.RefObject<THREE.Group>;
};

export default function Camera({ target }: CameraProps) {
    const { camera } = useThree();
    const tempPos = new THREE.Vector3();
    const tempTarget = new THREE.Vector3();
    const currentFov = useRef(45); // FOV base menor (era 50)

    useFrame(() => {
        if (!target.current) return;

        const carPos = target.current.position;
        const carRot = target.current.rotation.y;

        // Calcula velocidade aproximada baseada na posição anterior
        const velocity = target.current.userData.velocity || new THREE.Vector3();
        const speed = velocity.length();

        // Ajusta FOV baseado na velocidade com menos variação
        const baseFov = 65; // FOV base menor
        const maxSpeedFov = 70; // FOV máximo menor (era 85)
        const targetFov = baseFov + (speed * 0.5); // multiplicador muito mais suave (era 1)
        const clampedFov = Math.min(targetFov, maxSpeedFov);

        // Suaviza a transição do FOV ainda mais
        currentFov.current = THREE.MathUtils.lerp(currentFov.current, clampedFov, 0.05); // mais suave (era 0.05)
        camera.fov = currentFov.current;
        camera.updateProjectionMatrix();

        // Ajusta distância da câmera com menos variação
        const baseDistance = 10; // distância base maior
        const speedDistance = speed * 0.2; // menos variação por velocidade (era 1)
        const totalDistance = baseDistance + speedDistance;

        // offset atrás do carro
        const offset = new THREE.Vector3(0, 5, -totalDistance); // altura menor (era 5)
        const rotatedOffset = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), carRot);
        tempPos.copy(carPos).add(rotatedOffset);

        // movimento da câmera muito mais suave
        camera.position.lerp(tempPos, 0.2); // muito mais suave (era 0.1)

        // olha para o carro
        camera.lookAt(carPos);
    });

    return null;
}
