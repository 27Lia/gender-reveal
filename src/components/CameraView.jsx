import { useRef, useEffect, useState, useCallback } from "react";

const BALLOON_X = 0.5;
const BALLOON_Y = 0.42;
const BALLOON_RADIUS = 0.13;
const TIPS = [4, 8, 12, 16, 20];

export default function CameraView({ onPop }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const poppedRef = useRef(false);
  const prevNearRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [debugInfo, setDebugInfo] = useState("로딩중...");
  const [handNear, setHandNear] = useState(false);
  const [popping, setPopping] = useState(false);

  const handlePop = useCallback(() => {
    if (poppedRef.current) return;
    poppedRef.current = true;
    setPopping(true);
    setTimeout(() => onPop(), 500);
  }, [onPop]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Wait until CDN scripts are loaded
    let waited = 0;
    function waitForMediaPipe() {
      if (window.Hands && window.Camera) {
        init();
      } else if (waited < 10000) {
        waited += 100;
        setTimeout(waitForMediaPipe, 100);
      } else {
        setDebugInfo("CDN 로드 실패");
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
        const cW = (canvas.width = canvas.offsetWidth);
        const cH = (canvas.height = canvas.offsetHeight);
        const ctx = canvas.getContext("2d");

        ctx.save(); // 현재 상태 저장//
        ctx.clearRect(0, 0, cW, cH);

        // 1. 캔버스 전체를 수평 반전 (비디오의 scaleX(-1)과 일치시킴)
        ctx.translate(cW, 0);
        ctx.scale(-1, 1);

        // --- 이제부터 그리는 모든 것은 반전되어 그려집니다 ---

        // 풍선 히트 존 (반전된 상태에서 그려야 하므로 좌표 계산은 동일)
        ctx.beginPath();
        ctx.arc(
          BALLOON_X * cW,
          BALLOON_Y * cH,
          BALLOON_RADIUS * cW,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        const landmarks = results.multiHandLandmarks ?? [];
        setDebugInfo(`손: ${landmarks.length}개 감지`);

        let near = false;

        for (const hand of landmarks) {
          // 스켈레톤 그리기
          window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
            color: "rgba(0,255,180,0.8)",
            lineWidth: 2.5,
          });
          window.drawLandmarks(ctx, hand, {
            color: "#ff4d8d",
            lineWidth: 1,
            radius: (data) => (TIPS.includes(data.index) ? 8 : 4),
          });

          // 충돌 체크 (좌표 계산 로직은 동일하게 유지)
          if (!poppedRef.current) {
            for (const idx of TIPS) {
              const lm = hand[idx];
              if (!lm) continue;
              const dx = lm.x - BALLOON_X;
              const dy = lm.y - BALLOON_Y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < BALLOON_RADIUS) {
                near = true;
                handlePop();
                break;
              } else if (dist < BALLOON_RADIUS * 1.6) {
                near = true;
              }
            }
          }
        }

        ctx.restore(); // 반전 상태 복구 (다음 프레임을 위해)

        if (near !== prevNearRef.current) {
          prevNearRef.current = near;
          setHandNear(near);
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
          setDebugInfo("손: 0개 감지");
        })
        .catch((err) => {
          setDebugInfo(`에러: ${err.message?.slice(0, 80)}`);
          setStatus("error");
        });
    }

    return () => {
      cameraRef.current?.stop();
    };
  }, [handlePop]);

  return (
    <div className="camera-view">
      <video ref={videoRef} className="camera-feed" muted playsInline />
      <canvas ref={canvasRef} className="hand-canvas" />

      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 20,
          background: "rgba(0,0,0,0.6)",
          color: "#0f0",
          fontFamily: "monospace",
          fontSize: 13,
          padding: "4px 10px",
          borderRadius: 6,
          pointerEvents: "none",
        }}
      >
        {debugInfo}
      </div>

      {status === "loading" && (
        <div className="overlay-msg">
          <div className="spinner" />
          <p>로딩 중… ({debugInfo})</p>
        </div>
      )}

      {status === "error" && (
        <div className="overlay-msg">
          <p>❌ 오류 발생</p>
          <p style={{ fontSize: 13, opacity: 0.7, maxWidth: 300 }}>
            {debugInfo}
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="balloon-layer">
          <div
            className={`balloon-emoji${handNear ? " near" : ""}${popping ? " popping" : ""}`}
          >
            🎈
          </div>
          {!popping && (
            <p className="touch-hint">✋ 손을 뻗어 풍선을 터뜨리세요!</p>
          )}
        </div>
      )}
    </div>
  );
}
