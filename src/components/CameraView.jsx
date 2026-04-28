import { useRef, useEffect, useState, useCallback } from "react";

const BALLOON_RADIUS = 0.13;
const TIPS = [4, 8, 12, 16, 20];
const GAUGE_SPEED = 2.5;
const DECAY_SPEED = 1.0;
const BALLOON_X = 0.5;
const BALLOON_Y = 0.42;

function PlaidBalloon({ gauge }) {
  const scale = 1 + (gauge / 100) * 0.3;
  const glow = gauge / 4;
  return (
    <svg
      style={{
        width: "min(28vw, 180px)",
        height: "min(38vw, 240px)",
        transform: `scale(${scale})`,
        filter: `drop-shadow(0 0 ${glow}px rgba(255,255,255,0.85))`,
        transition: "transform 0.12s ease-out",
        display: "block",
      }}
      viewBox="0 0 130 195"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid-cam" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill="#ede4d8"/>
          <line x1="0" y1="0" x2="18" y2="0" stroke="#c8baa8" strokeWidth="1.3"/>
          <line x1="0" y1="9" x2="18" y2="9" stroke="#d8ccc0" strokeWidth="0.7"/>
          <line x1="0" y1="18" x2="18" y2="18" stroke="#c8baa8" strokeWidth="1.3"/>
          <line x1="0" y1="0" x2="0" y2="18" stroke="#c8baa8" strokeWidth="1.3"/>
          <line x1="9" y1="0" x2="9" y2="18" stroke="#d8ccc0" strokeWidth="0.7"/>
          <line x1="18" y1="0" x2="18" y2="18" stroke="#c8baa8" strokeWidth="1.3"/>
        </pattern>
        <radialGradient id="shine-cam" cx="35%" cy="28%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
        <radialGradient id="edge-cam" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="rgba(255,255,255,0)"/>
          <stop offset="100%" stopColor="rgba(140,110,80,0.25)"/>
        </radialGradient>
      </defs>
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#grid-cam)"/>
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#shine-cam)"/>
      <ellipse cx="65" cy="65" rx="56" ry="60" fill="url(#edge-cam)"/>
      <ellipse cx="65" cy="127" rx="5" ry="4" fill="#c8baa8"/>
      <path d="M65 131 Q58 150 65 165 Q72 178 65 190" stroke="#c8baa8" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export default function CameraView({ onPop, onRecordingReady }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const recorderRef = useRef(null);
  const poppedRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [debugInfo, setDebugInfo] = useState("로딩중...");
  const [popping, setPopping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [countdown, setCountdown] = useState(null);

  const startRecording = useCallback(
    (stream) => {
      if (!stream || !window.MediaRecorder) return;
      const mimeType =
        [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      try {
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : {},
        );
        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "video/webm",
          });
          onRecordingReady?.(blob);
        };
        recorder.start(100);
        recorderRef.current = recorder;
        setRecording(true);
      } catch (e) {
        console.warn("Recording failed:", e);
      }
    },
    [onRecordingReady],
  );

  const handlePop = useCallback(() => {
    if (poppedRef.current) return;
    poppedRef.current = true;
    setPopping(true);

    setTimeout(() => {
      setCountdown(3);
      setTimeout(() => {
        setCountdown(2);
        setTimeout(() => {
          setCountdown(1);
          setTimeout(() => {
            setCountdown(null);
            onPop();
          }, 1000);
        }, 1000);
      }, 1000);
    }, 600);

    setTimeout(() => {
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      cameraRef.current?.stop();
    }, 4500);
  }, [onPop]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let waited = 0;
    function waitForMediaPipe() {
      if (window.Hands && window.Camera) {
        init();
      } else if (waited < 10000) {
        waited += 100;
        setTimeout(waitForMediaPipe, 100);
      } else {
        setDebugInfo("MediaPipe 로드 실패");
        setStatus("error");
      }
    }
    waitForMediaPipe();

    function init() {
      setDebugInfo("모델 초기화...");

      const hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d");

        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const cW = canvas.width;
        const cH = canvas.height;

        ctx.clearRect(0, 0, cW, cH);

        // guide circle (canvas has CSS scaleX(-1), so mirror x)
        ctx.beginPath();
        ctx.arc((1 - BALLOON_X) * cW, BALLOON_Y * cH, BALLOON_RADIUS * cW, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        const landmarks = results.multiHandLandmarks ?? [];
        setDebugInfo(`손 감지: ${landmarks.length}`);

        let isInside = false;

        for (const hand of landmarks) {
          window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
            color: "#00ffb4",
            lineWidth: 5,
          });
          window.drawLandmarks(ctx, hand, {
            color: "#ff4d8d",
            lineWidth: 2,
            radius: 6,
          });

          if (!poppedRef.current) {
            for (const idx of TIPS) {
              const lm = hand[idx];
              if (!lm) continue;
              const hx = 1 - lm.x;
              const hy = lm.y;
              const dx = hx - BALLOON_X;
              const dy = hy - BALLOON_Y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < BALLOON_RADIUS) isInside = true;
            }
          }
        }

        if (!poppedRef.current) {
          setGauge((prev) => {
            if (isInside) {
              const next = prev + GAUGE_SPEED;
              if (next >= 100) {
                handlePop();
                return 100;
              }
              return next;
            }
            return Math.max(0, prev - DECAY_SPEED);
          });
        }
      });

      const camera = new window.Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
        },
        width: 1280,
        height: 720,
      });

      cameraRef.current = camera;
      camera
        .start()
        .then(() => {
          setStatus("ready");
          setDebugInfo("손 감지: 0");
          startRecording(video.srcObject);
        })
        .catch((err) => {
          setDebugInfo(`에러: ${err.message}`);
          setStatus("error");
        });
    }

    return () => {
      if (!poppedRef.current) {
        cameraRef.current?.stop();
        if (recorderRef.current?.state === "recording")
          recorderRef.current.stop();
      }
    };
  }, [handlePop, startRecording]);

  return (
    <div className="camera-view">
      <video ref={videoRef} className="camera-feed" muted playsInline />
      <canvas ref={canvasRef} className="hand-canvas" />

      {recording && (
        <div className="rec-badge">
          <span className="rec-dot" />
          REC
        </div>
      )}

      {countdown !== null && (
        <div className="countdown-overlay">
          <span key={countdown} className="countdown-number">
            {countdown}!
          </span>
        </div>
      )}

      <div className="debug-panel">{debugInfo}</div>

      {status === "loading" && (
        <div className="overlay-msg">
          <div className="spinner" />
          모델 로딩 중...
        </div>
      )}

      {status === "ready" && (
        <>
          <div
            className="balloon-anchor"
            style={{
              left: `${BALLOON_X * 100}%`,
              top: `${BALLOON_Y * 100}%`,
            }}
          >
            <div className={popping ? "cam-pop-anim" : ""}>
              <PlaidBalloon gauge={popping ? 100 : gauge} />
            </div>
          </div>

          {!popping && (
            <div className="gauge-ui">
              <div className="gauge-track">
                <div className="gauge-fill" style={{ width: `${gauge}%` }} />
              </div>
              <p className="gauge-text">
                {gauge > 0
                  ? "더 꾹 누르세요! ✊"
                  : "✋ 풍선을 손으로 누르세요!"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
