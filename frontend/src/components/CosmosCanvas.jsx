import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Sparkles, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ---- spiral galaxy (particle system) ----------------------------------------
function Galaxy() {
  const ref = useRef();
  const { positions, colors } = useMemo(() => {
    const count = 24000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const inside = new THREE.Color("#ffe6c2");   // warm core
    const mid = new THREE.Color("#b56cf0");       // violet arms
    const outside = new THREE.Color("#4a64e0");   // cool blue tips
    const branches = 3, spin = 1.15, radiusMax = 10, randomness = 0.5;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = Math.pow(Math.random(), 2.3) * radiusMax;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = radius * spin;
      const rnd = (p) => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * randomness * p;
      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + rnd(radius);
      positions[i3 + 1] = rnd(radius * 0.4);
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + rnd(radius);
      const f = Math.min(1, radius / radiusMax);
      const c = inside.clone().lerp(mid, Math.min(1, f * 1.6));
      if (f > 0.6) c.lerp(outside, (f - 0.6) / 0.4);
      colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);
  useFrame((s, d) => { if (ref.current) ref.current.rotation.y += d * 0.035; });
  return (
    <points ref={ref} rotation={[1.05, 0, 0.18]} position={[1.6, 0.4, -2.5]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} sizeAttenuation depthWrite={false} vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ---- bright core glow (radial sprite, blooms) --------------------------------
function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,235,205,0.9)");
  grd.addColorStop(0.5, "rgba(150,110,240,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function CoreGlow() {
  const tex = useMemo(radialTexture, []);
  return (
    <sprite position={[1.6, 0.4, -2.5]} scale={[7, 7, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} />
    </sprite>
  );
}

// ---- light-mode "Cosmic Dawn": the pastel galaxy image as a 3D backdrop -----
function DawnBackdrop() {
  const tex = useTexture("/cosmic-dawn.jpg");
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return; // gentle position parallax → depth without revealing edges
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, s.pointer.x * 0.7, 0.03);
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, s.pointer.y * 0.45, 0.03);
  });
  return (
    <mesh ref={ref} position={[0, 0, -14]} scale={[52, 29.25, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// ---- 4-point ✦ sparkle stars (canvas texture on points) ---------------------
function crossTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.translate(32, 32);
  const cg = g.createRadialGradient(0, 0, 0, 0, 0, 11);
  cg.addColorStop(0, "rgba(255,255,255,1)");
  cg.addColorStop(0.4, "rgba(255,255,255,0.55)");
  cg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
  g.fillStyle = "rgba(255,255,255,0.95)";
  const diamond = () => { g.beginPath(); g.moveTo(0, -30); g.lineTo(2.6, 0); g.lineTo(0, 30); g.lineTo(-2.6, 0); g.closePath(); g.fill(); };
  diamond(); g.rotate(Math.PI / 2); diamond();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function CrossSparkles({ dark }) {
  const tex = useMemo(crossTexture, []);
  const positions = useMemo(() => {
    const n = 30, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 40; a[i * 3 + 1] = (Math.random() - 0.5) * 22; a[i * 3 + 2] = -5 - Math.random() * 5; }
    return a;
  }, []);
  const ref = useRef();
  useFrame((s, d) => { if (ref.current) { ref.current.rotation.z += d * 0.004; ref.current.material.opacity = (dark ? 0.8 : 0.65) + Math.sin(s.clock.elapsedTime * 1.5) * 0.12; } });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial map={tex} size={1.7} sizeAttenuation transparent depthWrite={false} color={dark ? "#e6e8ff" : "#9b8fe6"} opacity={dark ? 0.8 : 0.65} blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </points>
  );
}

// ---- occasional shooting star ------------------------------------------------
function ShootingStar() {
  const ref = useRef();
  const st = useRef({ active: false, next: 4 + Math.random() * 7, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  useFrame((s, d) => {
    const o = st.current; if (!ref.current) return;
    if (!o.active) { o.next -= d; if (o.next <= 0) { o.active = true; o.life = 0; o.x = -14 + Math.random() * 6; o.y = 5 + Math.random() * 4; o.vx = 13 + Math.random() * 6; o.vy = -(5 + Math.random() * 4); } ref.current.material.opacity = 0; return; }
    o.life += d; o.x += o.vx * d; o.y += o.vy * d;
    ref.current.position.set(o.x, o.y, -6); ref.current.rotation.z = Math.atan2(o.vy, o.vx);
    ref.current.material.opacity = Math.max(0, 1 - o.life * 0.85);
    if (o.life > 1.3) { o.active = false; o.next = 9 + Math.random() * 14; }
  });
  return (<mesh ref={ref}><planeGeometry args={[2.6, 0.03]} /><meshBasicMaterial color="#fff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>);
}

// ---- cinematic warp-in: camera eases from far → resting position ------------
function CameraRig({ intro }) {
  const { camera } = useThree();
  const t0 = useRef(null);
  useFrame(() => {
    if (!intro) return;
    if (t0.current === null) t0.current = performance.now();
    const p = (performance.now() - t0.current) / 1800;
    if (p >= 1) return;
    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
    camera.position.z = 15 - 9 * e;   // 15 → 6
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ dark, intro }) {
  const group = useRef();
  useFrame((s) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, s.pointer.x * 0.12, 0.025);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -s.pointer.y * 0.08, 0.025);
  });
  return (
    <>
      <CameraRig intro={intro} />
      {!dark && <DawnBackdrop />}
      <group ref={group}>
        {dark ? (
          <>
            <Stars radius={80} depth={50} count={5000} factor={2.4} saturation={0} fade speed={0.4} />
            <Galaxy />
            <CoreGlow />
            <ShootingStar />
          </>
        ) : (
          <>
            <CrossSparkles dark={dark} />
            <Sparkles count={28} scale={[30, 18, 8]} size={2.4} speed={0.18} color="#b9aef0" opacity={0.45} />
          </>
        )}
      </group>
      <EffectComposer disableNormalPass>
        <Bloom intensity={dark ? 1.3 : 0.08} luminanceThreshold={dark ? 0.0 : 0.95} luminanceSmoothing={0.85} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.22} darkness={dark ? 0.62 : 0.1} />
      </EffectComposer>
    </>
  );
}

export default function CosmosCanvas({ dark = true, intro = false }) {
  return (
    <Canvas dpr={[1, 1.6]} gl={{ antialias: false, powerPreference: "high-performance", alpha: false }} camera={{ position: [0, 0, intro ? 15 : 6], fov: 62 }}>
      <color attach="background" args={[dark ? "#04040c" : "#f4f2fb"]} />
      <Scene dark={dark} intro={intro} />
    </Canvas>
  );
}
