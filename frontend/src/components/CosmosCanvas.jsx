import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ---- procedural nebula (fbm) -------------------------------------------------
const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime; uniform float uDark;
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
  }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.0+1.3; a*=0.5; } return v; }
  void main(){
    vec2 uv = vUv*3.2;
    float t = uTime*0.015;
    vec2 q = vec2(fbm(uv + t), fbm(uv - vec2(t,0.0) + 2.3));
    float n = fbm(uv + 1.8*q + vec2(t*0.6, -t*0.4));
    float n2 = fbm(uv*1.7 - t*0.5 + 4.0);
    vec3 col = mix(uA, uB, smoothstep(0.15,0.85,n));
    col = mix(col, uC, smoothstep(0.55,1.05,n2)*0.7);
    float density = pow(smoothstep(0.05,0.95,n), 2.2);
    // vignette the clouds toward the frame edges a touch
    float edge = smoothstep(1.25, 0.2, length(vUv-0.5)*1.6);
    float alpha = density * mix(0.40, 0.92, uDark) * edge;
    gl_FragColor = vec4(col, alpha);
  }
`;

function Nebula({ dark }) {
  const mat = useRef();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDark: { value: dark ? 1 : 0 },
      uA: { value: new THREE.Color(dark ? "#1a1147" : "#e7e3fb") },
      uB: { value: new THREE.Color(dark ? "#5b4fe0" : "#dcd6f7") },
      uC: { value: new THREE.Color(dark ? "#9b5de5" : "#f6d9e6") },
    }),
    [dark]
  );
  useFrame((s) => { if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime; });
  return (
    <mesh position={[0, 0, -14]} scale={[46, 30, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  );
}

// ---- glowing galactic core (radial sprite, picked up by bloom) ---------------
function radialTexture(inner = "rgba(255,255,255,1)", mid = "rgba(160,140,255,0.5)") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, mid);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function CoreGlow({ dark }) {
  const tex = useMemo(() => radialTexture(), []);
  return (
    <sprite position={[-0.6, 0.2, -8]} scale={[16, 16, 1]}>
      <spriteMaterial
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={dark ? 0.55 : 0.22}
        color={dark ? "#c9b8ff" : "#f3e9ff"}
      />
    </sprite>
  );
}

// ---- a stylized planet drifting in the corner --------------------------------
function Planet({ dark }) {
  const g = useRef();
  useFrame((s, d) => { if (g.current) g.current.rotation.y += d * 0.05; });
  return (
    <group position={[7.5, -4.2, -3]}>
      <mesh ref={g}>
        <sphereGeometry args={[2.4, 64, 64]} />
        <meshStandardMaterial
          color={dark ? "#2a2350" : "#cfc7f0"}
          emissive={dark ? "#1a1640" : "#e9e4fb"}
          emissiveIntensity={0.25}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      {/* atmosphere rim */}
      <mesh scale={1.08}>
        <sphereGeometry args={[2.4, 48, 48]} />
        <meshBasicMaterial color={dark ? "#7c7ff0" : "#b9b0ee"} transparent opacity={0.18} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---- occasional shooting star ------------------------------------------------
function ShootingStar() {
  const ref = useRef();
  const state = useRef({ active: false, next: 3 + Math.random() * 8, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  useFrame((s, d) => {
    const st = state.current;
    if (!ref.current) return;
    if (!st.active) {
      st.next -= d;
      if (st.next <= 0) {
        st.active = true; st.life = 0;
        st.x = -14 + Math.random() * 6; st.y = 5 + Math.random() * 4;
        st.vx = 12 + Math.random() * 6; st.vy = -(5 + Math.random() * 4);
      }
      ref.current.material.opacity = 0;
      return;
    }
    st.life += d; st.x += st.vx * d; st.y += st.vy * d;
    ref.current.position.set(st.x, st.y, -6);
    ref.current.rotation.z = Math.atan2(st.vy, st.vx);
    ref.current.material.opacity = Math.max(0, 1 - st.life * 0.8);
    if (st.life > 1.3) { st.active = false; st.next = 8 + Math.random() * 14; }
  });
  return (
    <mesh ref={ref} position={[0, 0, -6]}>
      <planeGeometry args={[2.6, 0.03]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

// ---- scene with parallax + slow swirl ----------------------------------------
function Scene({ dark }) {
  const group = useRef();
  useFrame((s) => {
    if (!group.current) return;
    const t = s.clock.elapsedTime;
    group.current.rotation.z = t * 0.006;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, s.pointer.x * 0.18, 0.025);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -s.pointer.y * 0.12, 0.025);
  });
  return (
    <>
      <ambientLight intensity={dark ? 0.5 : 1.1} />
      <directionalLight position={[-6, 4, 6]} intensity={dark ? 1.4 : 0.8} color={dark ? "#b9c0ff" : "#fff4e6"} />
      <group ref={group}>
        <Nebula dark={dark} />
        <CoreGlow dark={dark} />
        {dark ? (
          <>
            <Stars radius={70} depth={50} count={5000} factor={2.6} saturation={0} fade speed={0.5} />
            <Sparkles count={28} scale={[24, 14, 6]} size={3.2} speed={0.25} color="#eef0ff" opacity={0.7} />
          </>
        ) : (
          <Sparkles count={60} scale={[26, 16, 8]} size={3.5} speed={0.2} color="#9b87f5" opacity={0.55} />
        )}
        <Planet dark={dark} />
        {dark && <ShootingStar />}
      </group>
      <EffectComposer disableNormalPass>
        <Bloom intensity={dark ? 0.9 : 0.25} luminanceThreshold={dark ? 0.2 : 0.6} luminanceSmoothing={0.9} mipmapBlur radius={0.8} />
        <Vignette eskil={false} offset={0.25} darkness={dark ? 0.55 : 0.2} />
      </EffectComposer>
    </>
  );
}

export default function CosmosCanvas({ dark = true }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0, 6], fov: 62 }}
    >
      <color attach="background" args={[dark ? "#06060f" : "#f4f2fb"]} />
      <Scene dark={dark} />
    </Canvas>
  );
}
