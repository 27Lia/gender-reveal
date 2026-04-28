import { useState, useCallback } from "react";
import CameraView from "./components/CameraView";
import Reveal from "./components/Reveal";
import "./App.css";

const GENDER = Math.random() < 0.5 ? "boy" : "girl";
// const GENDER = "girl" "boy";

function BlueBalloon() {
  return (
    <svg
      className="balloon-svg balloon-blue"
      viewBox="0 0 130 195"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="grid-b"
          x="0"
          y="0"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <rect width="18" height="18" fill="#c0d8ec" />
          <line
            x1="0"
            y1="0"
            x2="18"
            y2="0"
            stroke="#8fb5d2"
            strokeWidth="1.3"
          />
          <line
            x1="0"
            y1="9"
            x2="18"
            y2="9"
            stroke="#aacce0"
            strokeWidth="0.7"
          />
          <line
            x1="0"
            y1="18"
            x2="18"
            y2="18"
            stroke="#8fb5d2"
            strokeWidth="1.3"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="18"
            stroke="#8fb5d2"
            strokeWidth="1.3"
          />
          <line
            x1="9"
            y1="0"
            x2="9"
            y2="18"
            stroke="#aacce0"
            strokeWidth="0.7"
          />
          <line
            x1="18"
            y1="0"
            x2="18"
            y2="18"
            stroke="#8fb5d2"
            strokeWidth="1.3"
          />
        </pattern>
        <radialGradient id="shine-b" cx="35%" cy="28%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id="edge-b" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(70,120,160,0.3)" />
        </radialGradient>
      </defs>
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#grid-b)" />
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#shine-b)" />
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#edge-b)" />
      <ellipse cx="65" cy="127" rx="5" ry="4" fill="#8fb5d2" />
      <path
        d="M65 131 Q56 148 65 162 Q74 176 65 190"
        stroke="#8fb5d2"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinkBalloon() {
  return (
    <svg
      className="balloon-svg balloon-pink"
      viewBox="0 0 130 195"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="grid-p"
          x="0"
          y="0"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <rect width="18" height="18" fill="#ecc8d8" />
          <line
            x1="0"
            y1="0"
            x2="18"
            y2="0"
            stroke="#d2a0b8"
            strokeWidth="1.3"
          />
          <line
            x1="0"
            y1="9"
            x2="18"
            y2="9"
            stroke="#e0b8cc"
            strokeWidth="0.7"
          />
          <line
            x1="0"
            y1="18"
            x2="18"
            y2="18"
            stroke="#d2a0b8"
            strokeWidth="1.3"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="18"
            stroke="#d2a0b8"
            strokeWidth="1.3"
          />
          <line
            x1="9"
            y1="0"
            x2="9"
            y2="18"
            stroke="#e0b8cc"
            strokeWidth="0.7"
          />
          <line
            x1="18"
            y1="0"
            x2="18"
            y2="18"
            stroke="#d2a0b8"
            strokeWidth="1.3"
          />
        </pattern>
        <radialGradient id="shine-p" cx="35%" cy="28%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id="edge-p" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(160,70,100,0.3)" />
        </radialGradient>
      </defs>
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#grid-p)" />
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#shine-p)" />
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#edge-p)" />
      <ellipse cx="65" cy="127" rx="5" ry="4" fill="#d2a0b8" />
      <path
        d="M65 131 Q74 148 65 162 Q56 176 65 190"
        stroke="#d2a0b8"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [phase, setPhase] = useState("intro");
  const [recordingBlob, setRecordingBlob] = useState(null);

  const handlePop = useCallback(() => {
    setPhase("revealed");
  }, []);

  const handleRecordingReady = useCallback((blob) => {
    setRecordingBlob(blob);
  }, []);

  const handleRestart = useCallback(() => {
    setRecordingBlob(null);
    setPhase("intro");
  }, []);

  const handleStart = useCallback(async () => {
    try {
      // iOS Safari requires getUserMedia to be called within a user gesture
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (_) {
      // permission denied or unavailable — proceed anyway, CameraView will show the error
    }
    setPhase("camera");
  }, []);

  return (
    <div className="app">
      {phase === "intro" && (
        <div className="intro">
          <div className="intro-balloons">
            <BlueBalloon />
            <PinkBalloon />
          </div>
          <div className="intro-text">
            <h1 className="intro-title">He or She ?</h1>
            <p className="intro-script">What will it be ?</p>
            <div className="intro-divider">
              <span>✦</span>
            </div>
            <p className="intro-names">Woorim &amp; Francisco</p>
          </div>
          <button className="start-btn" onClick={handleStart}>
            Touch to Reveal
          </button>
        </div>
      )}

      {phase === "camera" && (
        <CameraView
          gender={GENDER}
          onPop={handlePop}
          onRecordingReady={handleRecordingReady}
        />
      )}

      {phase === "revealed" && (
        <Reveal
          gender={GENDER}
          onRestart={handleRestart}
          recordingBlob={recordingBlob}
        />
      )}
    </div>
  );
}
