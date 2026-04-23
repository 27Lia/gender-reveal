import { useRef, useEffect, useState, useCallback } from "react";

const BALLOON_RADIUS = 0.13;
const TIPS = [4, 8, 12, 16, 20];

const GAUGE_SPEED = 2.5;
const DECAY_SPEED = 1.0;

// 풍선 도망 물리
const SCARE_RADIUS = 0.32;  // 이 거리 안에 들어오면 도망 시작
const ESCAPE_FORCE = 0.026; // 도망 힘
const FRICTION = 0.80;      // 속도 감쇠 (낮을수록 빨리 멈춤)
const BOUNCE_DAMP = 0.5;    // 벽 반사 에너지 손실

export default function CameraView({ onPop, onRecordingReady }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const recorderRef = useRef(null);
  const poppedRef = useRef(false);
  // 풍선 물리 상태 (ref: 매 프레임 업데이트, state: 렌더링용)
  const balloonPosRef = useRef({ x: 0.5, y: 0.42 }); // display space (0=왼쪽, 1=오른쪽)
  const balloonVelRef = useRef({ x: 0, y: 0 });

  const [status, setStatus] = useState("loading");
  const [debugInfo, setDebugInfo] = useState("로딩중...");
  const [popping, setPopping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [balloonPos, setBalloonPos] = useState({ x: 0.5, y: 0.42 });
  const [balloonScared, setBalloonScared] = useState(false);

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
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
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
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const cW = canvas.width;
        const cH = canvas.height;

        ctx.clearRect(0, 0, cW, cH);

        // 풍선 가이드 원
        // canvas는 CSS scaleX(-1) → display space x를 canvas pixel로: (1 - bx) * cW
        const bx = balloonPosRef.current.x;
        const by = balloonPosRef.current.y;
        ctx.beginPath();
        ctx.arc((1 - bx) * cW, by * cH, BALLOON_RADIUS * cW, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        const landmarks = results.multiHandLandmarks ?? [];
        setDebugInfo(`손 감지: ${landmarks.length}`);

        let isInside = false;
        let scared = false;

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

              // MediaPipe 좌표 → display space (canvas CSS scaleX(-1) 보정)
              const hx = 1 - lm.x;
              const hy = lm.y;
              const dx = hx - balloonPosRef.current.x;
              const dy = hy - balloonPosRef.current.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < SCARE_RADIUS) {
                scared = true;
                // 손 반대 방향으로 도망 힘 적용
                const force = ESCAPE_FORCE * (1 - dist / SCARE_RADIUS);
                balloonVelRef.current.x -= (dx / dist) * force;
                balloonVelRef.current.y -= (dy / dist) * force;
              }
              if (dist < BALLOON_RADIUS) {
                isInside = true;
              }
            }
          }
        }

        // 물리 시뮬레이션
        if (!poppedRef.current) {
          const pos = balloonPosRef.current;
          const vel = balloonVelRef.current;

          vel.x *= FRICTION;
          vel.y *= FRICTION;
          pos.x += vel.x;
          pos.y += vel.y;

          // 벽 반사
          if (pos.x < 0.10) { pos.x = 0.10; vel.x = Math.abs(vel.x) * BOUNCE_DAMP; }
          if (pos.x > 0.90) { pos.x = 0.90; vel.x = -Math.abs(vel.x) * BOUNCE_DAMP; }
          if (pos.y < 0.08) { pos.y = 0.08; vel.y = Math.abs(vel.y) * BOUNCE_DAMP; }
          if (pos.y > 0.88) { pos.y = 0.88; vel.y = -Math.abs(vel.y) * BOUNCE_DAMP; }

          setBalloonPos({ x: pos.x, y: pos.y });
          setBalloonScared(scared);

          // 게이지
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
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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
          {/* 풍선 이모지: display space 좌표로 절대 위치 */}
          <div
            className="balloon-anchor"
            style={{ left: `${balloonPos.x * 100}%`, top: `${balloonPos.y * 100}%` }}
          >
            <div
              className={`balloon-emoji${popping ? " popping" : ""}${balloonScared ? " scared" : ""}`}
              style={{
                transform: `scale(${1 + (gauge / 100) * 0.3})`,
                filter: `drop-shadow(0 0 ${gauge / 4}px white)`,
              }}
            >
              🎈
            </div>
          </div>

          {!popping && (
            <div className="gauge-ui">
              <div className="gauge-track">
                <div className="gauge-fill" style={{ width: `${gauge}%` }} />
              </div>
              <p className="gauge-text">
                {gauge > 0 ? "더 꾹 누르세요! ✊" : "✋ 풍선을 손으로 누르세요!"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
