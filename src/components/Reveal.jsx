import { useEffect, useRef, useState, useMemo } from "react";

const CONFIG = {
  boy: {
    colors: ["#b8d4e8", "#c8e0f4", "#ddeeff", "#ffffff", "#8fb5d2", "#e8f2f8"],
    bg: "linear-gradient(160deg, #c8dff0 0%, #a8c8e0 50%, #8ab5d0 100%)",
    genderText: "Boy",
  },
  girl: {
    colors: ["#e8b8d0", "#f0c8dc", "#f8dde8", "#ffffff", "#d498b8", "#f8e8f0"],
    bg: "linear-gradient(160deg, #f0c8da 0%, #e0a8c0 50%, #d090ac 100%)",
    genderText: "Girl",
  },
};

export default function Reveal({ gender, onRestart, recordingBlob }) {
  const canvasRef = useRef(null);
  const cfg = CONFIG[gender] ?? CONFIG.girl;
  const [showVideo, setShowVideo] = useState(false);

  const videoUrl = useMemo(() => {
    if (!recordingBlob) return null;
    return URL.createObjectURL(recordingBlob);
  }, [recordingBlob]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 4,
      h: Math.random() * 5 + 3,
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      vy: Math.random() * 2.5 + 1,
      vx: (Math.random() - 0.5) * 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.14,
      opacity: Math.random() * 0.35 + 0.45,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 2);
        ctx.fill();
        ctx.restore();
        p.y += p.vy;
        p.x += p.vx;
        p.angle += p.spin;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [cfg.colors]);

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "gender-reveal-reaction.webm";
    a.click();
  };

  return (
    <div className="reveal" style={{ background: cfg.bg }}>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div className="reveal-content">
        <div className="reveal-its-a">It&apos;s a</div>
        <h1 className="reveal-label">{cfg.genderText}</h1>
        <p className="reveal-heart">♡</p>
        {recordingBlob && (
          <button className="reaction-btn" onClick={() => setShowVideo(true)}>
            Watch Reaction
          </button>
        )}
        <button className="restart-btn" onClick={onRestart}>
          Play Again
        </button>
      </div>

      {showVideo && videoUrl && (
        <div className="video-modal" onClick={() => setShowVideo(false)}>
          <div className="video-modal-inner" onClick={(e) => e.stopPropagation()}>
            <video src={videoUrl} controls autoPlay className="reaction-video" />
            <div className="video-modal-actions">
              <button className="download-btn" onClick={handleDownload}>
                Download
              </button>
              <button className="close-btn" onClick={() => setShowVideo(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
