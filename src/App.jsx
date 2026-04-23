import { useState, useCallback } from "react";
import CameraView from "./components/CameraView";
import Reveal from "./components/Reveal";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const GENDER = "boy";

// params.get('gender') === 'boy' || params.get('gender') === 'girl'
//   ? params.get('gender')
//   : Math.random() > 0.5 ? 'boy' : 'girl'

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

  return (
    <div className="app">
      {phase === "intro" && (
        <div className="intro">
          <div className="intro-balloon">🎈</div>
          <h1>Gender Reveal</h1>
          <p>
            카메라 앞에서 손으로 풍선을
            <br />
            터뜨려 성별을 확인하세요!
          </p>
          <button className="start-btn" onClick={() => setPhase("camera")}>
            카메라 켜기
          </button>
          <p className="hint-small">
            URL에 <code>?gender=boy</code> 또는 <code>?gender=girl</code> 을
            붙여 성별을 미리 지정할 수 있어요
          </p>
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
