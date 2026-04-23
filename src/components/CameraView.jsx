import { useRef, useEffect, useState, useCallback } from "react";

// 풍선 위치 및 크기 상수 (0 ~ 1 비율값)
const BALLOON_X = 0.5; // 화면 가로 중앙
const BALLOON_Y = 0.42; // 화면 세로 상단 42% 위치
const BALLOON_RADIUS = 0.13; // 풍선 반지름
const TIPS = [4, 8, 12, 16, 20]; // 엄지, 검지, 중지, 약지, 소지 끝마디 랜드마크 인덱스

// 게이지 시스템 상수
const GAUGE_SPEED = 2.5; // 게이지 차는 속도 (프레임당)
const DECAY_SPEED = 1.0; // 손 뗐을 때 게이지 줄어드는 속도

export default function CameraView({ gender, onPop, onRecordingReady }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const recorderRef = useRef(null);
  const poppedRef = useRef(false);

  // 컴포넌트 상태관리
  const [status, setStatus] = useState("loading"); // loading, ready, error
  const [debugInfo, setDebugInfo] = useState("로딩중..."); // 모델 상태 표시
  const [handNear, setHandNear] = useState(false); // 손이 풍선 근처에 있는지
  const [popping, setPopping] = useState(false); // 풍선이 터지는 중인지 (애니메이션)
  const [recording, setRecording] = useState(false); // 녹화 중인지
  const [gauge, setGauge] = useState(0); // 게이지 값 (0 ~ 100)

  // 녹화 시작 함수
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
          onRecordingReady?.(blob); // 녹화된 영상 블롭을 Reveal로 전달
        };
        recorder.start(100); // 100ms마다 데이터를 쪼개서 저장
        recorderRef.current = recorder;
        setRecording(true);
      } catch (e) {
        console.warn("Recording failed:", e);
      }
    },
    [onRecordingReady],
  );

  // 풍선 터뜨리기 실행 함수
  const handlePop = useCallback(() => {
    if (poppedRef.current) return;
    poppedRef.current = true;
    setPopping(true); // 터지는 애니메이션 시작

    // 0.6초 후 Reveal 화면으로 이동
    setTimeout(() => onPop(), 600);

    // 3.5초 후 녹화 중지 및 카메라 정지
    setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      cameraRef.current?.stop();
    }, 3500);
  }, [onPop]);

  // MediaPipe 초기화 및 카메라 연결
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // CDN으로 MediaPipe 로딩 대기
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

    // 초기화 및 실행 로직
    function init() {
      setDebugInfo("모델 초기화...");

      const hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2, // 최대 2개 손 감지
        modelComplexity: 1, // 모델 복잡도 (0~2)
        minDetectionConfidence: 0.7, // 손 감지 신뢰도 임계값
        minTrackingConfidence: 0.5, // 손 추적 신뢰도 임계값
      });

      // 매 프레임마다 호출되는 결과 처리 콜백
      hands.onResults((results) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d");

        // [핵심] 캔버스 해상도를 비디오의 실제 해상도와 일치시킵니다.
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

        // 풍선 가이드
        ctx.beginPath();
        ctx.arc(
          BALLOON_X * cW,
          BALLOON_Y * cH,
          BALLOON_RADIUS * cW,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        const landmarks = results.multiHandLandmarks ?? [];
        setDebugInfo(`손 감지: ${landmarks.length}`);

        let isInside = false;

        // 감지된 손마다 반복
        for (const hand of landmarks) {
          // 랜드마크 그리기
          window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
            color: "#00ffb4",
            lineWidth: 5,
          });
          window.drawLandmarks(ctx, hand, {
            color: "#ff4d8d",
            lineWidth: 2,
            radius: 6,
          });

          // 손가락 끝 위치 확인 및 게이지 판정 로직
          if (!poppedRef.current) {
            for (const idx of TIPS) {
              const lm = hand[idx];
              if (!lm) continue;
              const dx = lm.x - BALLOON_X;
              const dy = lm.y - BALLOON_Y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < BALLOON_RADIUS) {
                isInside = true;
                break;
              }
            }
          }
        }

        // 게이지 업데이트 로직
        if (!poppedRef.current) {
          setGauge((prev) => {
            if (isInside) {
              const next = prev + GAUGE_SPEED;
              if (next >= 100) {
                handlePop(); // 100 꽉 차면 터뜨리기 실행!
                return 100;
              }
              return next;
            } else {
              return Math.max(0, prev - DECAY_SPEED);
            }
          });
          setHandNear(isInside);
        }
      });

      // 카메라 설정
      const camera = new window.Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
        },
        width: 1280, // 비디오 너비
        height: 720, // 비디오 높이
      });

      cameraRef.current = camera;
      camera
        .start()
        .then(() => {
          setStatus("ready");
          startRecording(video.srcObject); // 카메라 시작 후 녹화 시작
        })
        .catch((err) => {
          setDebugInfo(`에러: ${err.message}`);
          setStatus("error");
        });
    }

    // 컴포넌트 언마운트 시 클린업
    return () => {
      if (!poppedRef.current) {
        cameraRef.current?.stop();
        if (recorderRef.current?.state === "recording")
          recorderRef.current.stop();
      }
    };
  }, [handlePop, startRecording]);

  // 렌더링 부분
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
      <div className="debug-panel">{debugInfo}</div>

      {status === "loading" && (
        <div className="overlay-msg">
          <div className="spinner" />
          모델 로딩 중...
        </div>
      )}

      {status === "ready" && (
        <div className="balloon-layer">
          <div
            className={`balloon-emoji ${popping ? "popping" : ""} ${handNear ? "near" : ""}`}
            style={{
              transform: `scale(${1 + (gauge / 100) * 0.7})`,
              filter: `drop-shadow(0 0 ${gauge / 4}px white)`,
              animation:
                gauge > 0
                  ? `wobble ${Math.max(0.1, 1 - gauge / 100)}s infinite`
                  : "none",
            }}
          >
            🎈
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
        </div>
      )}
    </div>
  );
}
