export default function Hero({
  onStart,
  onExplore,
}: {
  onStart: () => void;
  onExplore: () => void;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> FROM INTUITION TO EQUATIONS
          </div>
          <h1>
            飞行，不止于想象。
            <br />
            <span>
              让每一个原理，
              <br />
              都可以亲手验证。
            </span>
          </h1>
          <p>
            从机翼上的第一份升力，到飞机的稳定与控制。
            <br />
            用交互实验连接物理直觉、数学模型与真实理解。
          </p>
          <div className="hero-buttons">
            <button className="primary" onClick={onStart}>
              开始第一节课 <span>↗</span>
            </button>
            <button className="secondary" onClick={onExplore}>
              自由探索实验室 →
            </button>
          </div>
          <div className="hero-meta">
            <span>
              06 <small>学习阶段</small>
            </span>
            <span>
              07 <small>开放实验组</small>
            </span>
            <span>
              SI <small>科学计算体系</small>
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="art-top">
            FLIGHT STUDY / 001 <span>ENGINEERING MODEL</span>
          </div>
          <svg viewBox="0 0 640 420" role="img" aria-label="机翼与四力示意图">
            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 30 0 L 0 0 0 30"
                  fill="none"
                  stroke="#d1dce4"
                  strokeWidth=".5"
                />
              </pattern>
              <marker
                id="head"
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <path d="M0 0L8 4L0 8" fill="#3c889f" />
              </marker>
            </defs>
            <rect width="640" height="420" fill="url(#grid)" />
            <ellipse cx="324" cy="325" rx="172" ry="27" fill="#dbe4eb" />
            <g transform="translate(315 225) rotate(-20)">
              <path
                d="M-18 115L-14-95Q0-150 16-95L18 115Z"
                fill="#e9eff3"
                stroke="#849ba9"
                strokeWidth="2"
              />
              <path
                d="M-12-35L-216 50L-215 77L-10 15L10 15L215 77L216 50L12-35"
                fill="#b7ccd9"
                stroke="#849ba9"
                strokeWidth="2"
              />
              <path
                d="M-15 78L-77 116L-76 130L0 108L76 130L77 116L15 78"
                fill="#d9e4eb"
                stroke="#849ba9"
              />
              <path d="M0 76L0 132L12 113L12 77" fill="#197f77" />
              <ellipse cy="-66" rx="11" ry="26" fill="#365468" />
            </g>
            <g
              fill="none"
              stroke="#3c889f"
              strokeWidth="2"
              markerEnd="url(#head)"
            >
              <path d="M320 215V67" />
              <path d="M318 242V366" />
              <path d="M275 226L137 267" />
              <path d="M350 208L474 174" />
            </g>
            <g fontFamily="sans-serif" fontSize="14" fill="#416377">
              <text x="334" y="73">
                LIFT / 升力
              </text>
              <text x="330" y="371">
                WEIGHT / 重力
              </text>
              <text x="89" y="290">
                DRAG / 阻力
              </text>
              <text x="470" y="161">
                THRUST / 推力
              </text>
            </g>
            <circle cx="319" cy="228" r="5" fill="#197f77" />
          </svg>
          <div className="art-bottom">
            <span>01 / FOUR FORCES OF FLIGHT</span>
            <span>
              L = ½ρV²SC<sub>L</sub>
            </span>
          </div>
        </div>
      </section>
      <div className="principle-strip">
        <span>观察现象</span>
        <i>→</i>
        <span>提出预测</span>
        <i>→</i>
        <span>建立模型</span>
        <i>→</i>
        <span>动手验证</span>
        <i>→</i>
        <span>形成理解</span>
      </div>
    </>
  );
}
