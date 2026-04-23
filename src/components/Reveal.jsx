import { useEffect, useRef } from 'react'

const CONFIG = {
  boy: {
    colors: ['#60a5fa', '#93c5fd', '#bfdbfe', '#ffffff', '#1d4ed8', '#dbeafe'],
    bg: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #60a5fa 100%)',
    icon: '👶💙',
    label: 'BOY!',
    sub: '아들이에요! 축하해요! 🎉',
  },
  girl: {
    colors: ['#f9a8d4', '#fbcfe8', '#fce7f3', '#ffffff', '#db2777', '#fdf2f8'],
    bg: 'linear-gradient(135deg, #831843 0%, #db2777 40%, #f9a8d4 100%)',
    icon: '👶💗',
    label: 'GIRL!',
    sub: '딸이에요! 축하해요! 🎉',
  },
}

export default function Reveal({ gender, onRestart }) {
  const canvasRef = useRef(null)
  const cfg = CONFIG[gender] ?? CONFIG.girl

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 14 + 6,
      h: Math.random() * 7 + 4,
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      vy: Math.random() * 3.5 + 1.5,
      vx: (Math.random() - 0.5) * 2.5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.18,
      opacity: Math.random() * 0.4 + 0.6,
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
        p.y += p.vy
        p.x += p.vx
        p.angle += p.spin
        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [cfg.colors])

  return (
    <div className="reveal" style={{ background: cfg.bg }}>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div className="reveal-content">
        <div className="reveal-icon">{cfg.icon}</div>
        <h1 className="reveal-label">{cfg.label}</h1>
        <p className="reveal-sub">{cfg.sub}</p>
        <button className="restart-btn" onClick={onRestart}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
