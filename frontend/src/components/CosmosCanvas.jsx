import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
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

// ---- soft light-mode nebula (pale clouds) -----------------------------------
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FRAG = `
  precision highp float; varying vec2 vUv; uniform float uTime; uniform vec3 uA, uB, uC;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y; }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.0+1.3; a*=0.5; } return v; }
  void main(){ vec2 uv=vUv*3.0; float t=uTime*0.015; float n=fbm(uv+vec2(t,t*0.5)+fbm(uv*0.6-t)); vec3 col=mix(uA,uB,smoothstep(0.2,0.85,n)); col=mix(col,uC,smoothstep(0.55,1.0,fbm(uv*1.6-t))*0.6); float edge=smoothstep(1.3,0.2,length(vUv-0.5)*1.6); gl_FragColor=vec4(col, pow(n,2.0)*0.42*edge); }
`;
function Nebula() {
  const mat = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uA: { value: new THREE.Color("#e7e3fb") },
    uB: { value: new THREE.Color("#dcd6f7") },
    uC: { value: new THREE.Color("#f6d9e6") },
  }), []);
  useFrame((s) => { if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime; });
  return (
    <mesh position={[0, 0, -14]} scale={[46, 30, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
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
            <Nebula />
            <Sparkles count={60} scale={[26, 16, 8]} size={3.2} speed={0.2} color="#9b87f5" opacity={0.5} />
          </>
        )}
      </group>
      <EffectComposer disableNormalPass>
        <Bloom intensity={dark ? 1.3 : 0.2} luminanceThreshold={dark ? 0.0 : 0.7} luminanceSmoothing={0.85} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.22} darkness={dark ? 0.62 : 0.18} />
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
