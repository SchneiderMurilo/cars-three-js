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
    const currentFov = useRef(45);

    useFrame(() => {
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
    });

    return null;
}
