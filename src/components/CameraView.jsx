import { useRef, useEffect, useState, useCallback } from "react";

const BALLOON_RADIUS = 0.13;
const TIPS = [4, 8, 12, 16, 20];
const GAUGE_SPEED = 2.5;
const DECAY_SPEED = 1.0;
const BALLOON_X = 0.5;
const BALLOON_Y = 0.42;

function drawBalloonOnCanvas(ctx, cx, cy, radius, scale, glow) {
  const rx = radius;
  const ry = radius * 1.07;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (glow > 0) {
    ctx.shadowColor = "rgba(255,255,255,0.85)";
    ctx.shadowBlur = glow;
  }

  ctx.fillStyle = "#ede4d8";
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // grid lines clipped to balloon shape
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#c8baa8";
  ctx.lineWidth = 1.3;
  for (let y = -ry; y <= ry; y += 18) {
    ctx.beginPath();
    ctx.moveTo(-rx, y);
    ctx.lineTo(rx, y);
    ctx.stroke();
  }
  for (let x = -rx; x <= rx; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, -ry);
    ctx.lineTo(x, ry);
    ctx.stroke();
  }
  ctx.restore();

  // shine
  const shine = ctx.createRadialGradient(-rx * 0.2, -ry * 0.28, 0, 0, 0, rx * 1.1);
  shine.addColorStop(0, "rgba(255,255,255,0.55)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // edge shadow
  const edge = ctx.createRadialGradient(0, 0, rx * 0.7, 0, 0, rx * 1.1);
  edge.addColorStop(0, "rgba(255,255,255,0)");
  edge.addColorStop(1, "rgba(140,110,80,0.25)");
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // knot
  ctx.fillStyle = "#c8baa8";
  ctx.beginPath();
  ctx.ellipse(0, ry + 4, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // string
  ctx.strokeStyle = "#c8baa8";
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, ry + 8);
  ctx.quadraticCurveTo(-7, ry + 27, 0, ry + 42);
  ctx.quadraticCurveTo(7, ry + 57, 0, ry + 69);
  ctx.stroke();

  ctx.restore();
}

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

export default function CameraView({ gender, onPop, onRecordingReady }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recCanvasRef = useRef(document.createElement("canvas"));
  const cameraRef = useRef(null);
  const recorderRef = useRef(null);
  const poppedRef = useRef(false);
  const genderRef = useRef(gender);
  const gaugeRef = useRef(0);
  const countdownRef = useRef(null);
  const popTimeRef = useRef(null);

  const [status, setStatus] = useState("loading");
  const [debugInfo, setDebugInfo] = useState("로딩중...");
  const [popping, setPopping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    genderRef.current = gender;
  }, [gender]);

  const startRecording = useCallback(() => {
    const recCanvas = recCanvasRef.current;
    if (!recCanvas || !window.MediaRecorder) return;

    const stream = recCanvas.captureStream(30);
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
  }, [onRecordingReady]);

  const handlePop = useCallback(() => {
    if (poppedRef.current) return;
    poppedRef.current = true;
    popTimeRef.current = Date.now();
    setPopping(true);

    setTimeout(() => {
      countdownRef.current = 3;
      setCountdown(3);
      setTimeout(() => {
        countdownRef.current = 2;
        setCountdown(2);
        setTimeout(() => {
          countdownRef.current = 1;
          setCountdown(1);
          setTimeout(() => {
            countdownRef.current = null;
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
    const recCanvas = recCanvasRef.current;
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

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        if (recCanvas.width !== video.videoWidth || recCanvas.height !== video.videoHeight) {
          recCanvas.width = video.videoWidth;
          recCanvas.height = video.videoHeight;
        }

        const cW = canvas.width;
        const cH = canvas.height;

        // ── display canvas (live preview with hand landmarks) ──
        ctx.clearRect(0, 0, cW, cH);

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

        // ── recording canvas ──
        const rCtx = recCanvas.getContext("2d");
        const rW = recCanvas.width;
        const rH = recCanvas.height;

        // mirrored camera frame
        rCtx.save();
        rCtx.translate(rW, 0);
        rCtx.scale(-1, 1);
        rCtx.drawImage(video, 0, 0, rW, rH);
        rCtx.restore();

        if (!poppedRef.current) {
          // pre-pop: draw balloon only, no hand landmarks
          const g = gaugeRef.current;
          drawBalloonOnCanvas(
            rCtx,
            BALLOON_X * rW,
            BALLOON_Y * rH,
            BALLOON_RADIUS * rW,
            1 + (g / 100) * 0.3,
            g / 4,
          );
        } else {
          const elapsed = Date.now() - popTimeRef.current;
          const isGirl = genderRef.current === "girl";

          // balloon pop animation (0–350ms)
          if (elapsed < 350) {
            const t = elapsed / 350;
            const scale = t < 0.4 ? 1 + t * 3.75 : Math.max(0, 2.5 - ((t - 0.4) / 0.6) * 2.5);
            const alpha = t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.6);
            rCtx.globalAlpha = alpha;
            drawBalloonOnCanvas(
              rCtx,
              BALLOON_X * rW,
              BALLOON_Y * rH,
              BALLOON_RADIUS * rW,
              scale,
              0,
            );
            rCtx.globalAlpha = 1;
          }

          // gender color wash fades in over first second
          const washAlpha = Math.min(0.4, (elapsed / 1000) * 0.4);
          rCtx.fillStyle = isGirl
            ? `rgba(220, 100, 150, ${washAlpha})`
            : `rgba(80, 150, 220, ${washAlpha})`;
          rCtx.fillRect(0, 0, rW, rH);

          // countdown numbers
          const cd = countdownRef.current;
          rCtx.save();
          rCtx.textAlign = "center";
          rCtx.textBaseline = "middle";
          rCtx.fillStyle = "white";
          rCtx.shadowColor = "rgba(0,0,0,0.55)";
          rCtx.shadowBlur = 32;

          if (cd !== null) {
            const fontSize = Math.round(rH * 0.28);
            rCtx.font = `900 ${fontSize}px sans-serif`;
            rCtx.fillText(`${cd}!`, rW / 2, rH / 2);
          } else if (elapsed >= 600) {
            // after countdown ends — reveal text
            const fontSize = Math.round(rH * 0.1);
            rCtx.font = `600 ${fontSize}px Georgia, serif`;
            rCtx.fillText(
              isGirl ? "It's a Girl! ♡" : "It's a Boy! ♡",
              rW / 2,
              rH * 0.52,
            );
          }
          rCtx.restore();
        }

        if (!poppedRef.current) {
          setGauge((prev) => {
            let next;
            if (isInside) {
              next = prev + GAUGE_SPEED;
              if (next >= 100) {
                handlePop();
                next = 100;
              }
            } else {
              next = Math.max(0, prev - DECAY_SPEED);
            }
            gaugeRef.current = next;
            return next;
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
          recCanvas.width = video.videoWidth || 1280;
          recCanvas.height = video.videoHeight || 720;
          startRecording();
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
