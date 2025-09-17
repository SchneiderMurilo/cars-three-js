import React from "react";

// @ts-ignore
import logoBlue from "../assets/logo-blue.png";

export default function Logo() {
    return (
        <div
            style={{
                position: "absolute",
                bottom: 0,
                right: 2,
                zIndex: 1000
            }}
        >
            <img
                src={logoBlue}
                alt="Logo"
                style={{ height: "60px", marginBottom: "8px", marginRight: "20px" }}
            />
        </div>
    );
}
