import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Line,
  PerspectiveCamera,
} from "@react-three/drei";
import { Quaternion, Matrix4, Vector3, CanvasTexture } from "three";
import { useMemo, useState, useEffect } from "react";
import {
  bodyToNed,
  type Parameters as AircraftParameters,
  type Motion,
  type aerodynamics,
} from "../physics/models";
type Forces = ReturnType<typeof aerodynamics>;
function SpriteLabel({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "600 28px sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(label, 128, 40);
    return new CanvasTexture(canvas);
  }, [color, label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[1.25, 0.3125, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
function Arrow({
  end,
  color,
  label,
}: {
  end: [number, number, number];
  color: string;
  label: string;
}) {
  if (new Vector3(...end).length() < 1e-9)
    return (
      <SpriteLabel
        position={[0, 0.2, 0]}
        color={color}
        label={`${label} = 0`}
      />
    );
  const q = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(...end).normalize(),
  );
  return (
    <group>
      <Line points={[[0, 0, 0], end]} color={color} lineWidth={3} />
      <mesh position={end} quaternion={q}>
        <coneGeometry args={[0.09, 0.25, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <SpriteLabel
        position={end.map((v) => v * 1.18) as [number, number, number]}
        color={color}
        label={label}
      />
    </group>
  );
}
function Plane({
  p,
  forces,
  showForces,
  axes,
}: {
  p: AircraftParameters;
  forces: Forces;
  showForces: boolean;
  axes: boolean;
}) {
  const orientation = useMemo(() => {
    const m = bodyToNed(p.roll, p.pitch, p.yaw);
    const c = new Matrix4().set(
      0,
      1,
      0,
      0,
      0,
      0,
      -1,
      0,
      -1,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
    );
    const r = new Matrix4().set(
      ...([
        m[0][0],
        m[0][1],
        m[0][2],
        0,
        m[1][0],
        m[1][1],
        m[1][2],
        0,
        m[2][0],
        m[2][1],
        m[2][2],
        0,
        0,
        0,
        0,
        1,
      ] as Parameters<Matrix4["set"]>),
    );
    return new Quaternion().setFromRotationMatrix(
      c.clone().multiply(r).multiply(c.clone().invert()),
    );
  }, [p.roll, p.pitch, p.yaw]);
  return (
    <group quaternion={orientation}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.17, 2.4, 8, 20]} />
        <meshStandardMaterial
          color="#e9edf2"
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.16, -0.6]} scale={[0.7, 0.55, 1.5]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial
          color="#223b4d"
          metalness={0.5}
          roughness={0.15}
        />
      </mesh>
      <mesh position={[0, 0, -0.15]} rotation={[0, 0, -0.025]} castShadow>
        <boxGeometry args={[3.7, 0.07, 0.62]} />
        <meshStandardMaterial color="#c4d3de" metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 1.02]}>
        <boxGeometry args={[1.4, 0.05, 0.38]} />
        <meshStandardMaterial color="#b8cbd7" />
      </mesh>
      <mesh position={[0, 0.28, 1.02]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.055, 0.6, 0.36]} />
        <meshStandardMaterial color="#16776e" />
      </mesh>
      <mesh position={[0, 0, -1.52]}>
        <boxGeometry args={[0.8, 0.05, 0.04]} />
        <meshStandardMaterial color="#243744" />
      </mesh>
      {axes && (
        <group>
          <Arrow end={[0, 0, -2]} color="#db6b52" label="x 前" />
          <Arrow end={[2, 0, 0]} color="#278a70" label="y 右" />
          <Arrow end={[0, -1.7, 0]} color="#558ed4" label="z 下" />
        </group>
      )}
      {showForces && (
        <group>
          <Arrow
            end={[
              0,
              Math.min(3, Math.abs(forces.lift) / 10000) *
                Math.sign(forces.lift),
              0,
            ]}
            color="#247dba"
            label="L 升力"
          />
          <Arrow
            end={[0, -Math.min(3, forces.weight / 10000), 0]}
            color="#db9850"
            label="W 重力"
          />
          <Arrow
            end={[0, 0, -Math.min(2, p.thrust / 3000)]}
            color="#248c73"
            label="T 推力"
          />
          <Arrow
            end={[0, 0, Math.min(2, forces.drag / 1800)]}
            color="#d8686b"
            label="D 阻力"
          />
        </group>
      )}
    </group>
  );
}
export default function Aircraft({
  p,
  forces,
  motion,
  showForces,
  axes,
}: {
  p: AircraftParameters;
  forces: Forces;
  motion: Motion;
  showForces: boolean;
  axes: boolean;
}) {
  const [view, setView] = useState("external");
  return (
    <div className="scene">
      <div className="scene-label">
        <span className="live-dot" />
        实时三维模型 <small>拖动旋转 · 滚轮缩放</small>
      </div>
      <Canvas
        shadows
        fallback={<div>此设备不支持 WebGL，请参考右侧数值与图表。</div>}
        camera={{ position: [5, 3.2, -5], fov: 43 }}
      >
        <color attach="background" args={["#edf2f6"]} />
        <ambientLight intensity={1.7} />
        <directionalLight position={[5, 8, -4]} intensity={3} castShadow />
        <PerspectiveCamera
          key={view}
          makeDefault
          position={
            view === "follow"
              ? [0, 1.8, 5]
              : view === "front"
                ? [0, 1, -6]
                : [5, 3.2, -5]
          }
          fov={43}
        />
        <group position={[0, Math.max(-0.6, Math.min(0.6, motion.z / 25)), 0]}>
          <Plane p={p} forces={forces} showForces={showForces} axes={axes} />
        </group>
        <Grid
          position={[0, -1.5, 0]}
          args={[30, 30]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#c9d4df"
          sectionSize={5}
          sectionColor="#b4c4cf"
          fadeDistance={25}
        />
        <OrbitControls makeDefault minDistance={3} maxDistance={15} />
      </Canvas>
      <div className="view-controls">
        {[
          ["external", "外部视角"],
          ["follow", "后方视角"],
          ["front", "正面视角"],
        ].map(([v, t]) => (
          <button
            key={v}
            className={view === v ? "selected" : ""}
            onClick={() => setView(v)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="scene-note">
        假设教学飞机 · 非真实机型{" "}
        <span>
          姿态 {p.pitch.toFixed(0)}° / {p.roll.toFixed(0)}° / {p.yaw.toFixed(0)}
          °
        </span>
      </div>
    </div>
  );
}
