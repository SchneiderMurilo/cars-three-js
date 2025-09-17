import React, { useState, useEffect } from "react";

type PlayerNameProps = {
    onNameSet: (name: string) => void;
};

export default function PlayerName({ onNameSet }: PlayerNameProps) {
    const [name, setName] = useState("");
    const [showInput, setShowInput] = useState(false);

    useEffect(() => {
        const savedName = localStorage.getItem("playerName");
        if (savedName) {
            onNameSet(savedName);
        } else {
            setShowInput(true);
        }
    }, [onNameSet]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            localStorage.setItem("playerName", name.trim());
            onNameSet(name.trim());
            setShowInput(false);
        }
    };

    if (!showInput) return null;

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "10px",
                textAlign: "center",
                minWidth: "300px"
            }}>
                <h2 style={{ marginBottom: "20px", color: "#333" }}>
                    Bem-vindo ao Jogo!
                </h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Digite seu nome"
                        style={{
                            padding: "10px",
                            fontSize: "16px",
                            border: "2px solid #ddd",
                            borderRadius: "5px",
                            marginBottom: "20px",
                            width: "100%",
                            outline: "none"
                        }}
                        autoFocus
                    />
                    <button
                        type="submit"
                        style={{
                            padding: "10px 20px",
                            fontSize: "16px",
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer"
                        }}
                    >
                        Começar Jogo
                    </button>
                </form>
            </div>
        </div>
    );
}

