import React, { useEffect, useState } from "react";

export default function Timer() {
    const [time, setTime] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTime(prev => prev + 0.01), 10);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (t: number) => {
        const minutes = Math.floor(t / 60);
        const seconds = (t % 60).toFixed(2);
        return `${minutes}:${seconds.padStart(5, "0")}`;
    };

    return (
        <div style={{ position: "absolute", top: 20, left: 20, color: "black", fontSize: "24px" }}>
            {formatTime(time)}
        </div>
    );
}
