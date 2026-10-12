'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  isFormRevealed: boolean;
  isDispersing?: boolean;
}

// 수평 소용돌이 에너지 고리 (Swirling Cyclone Rings) 파라미터
const STREAK_COUNT = 1800; // 수천 가닥의 순수 빛의 선들이 중첩되어 자연스러운 광선 궤적 형성
const SUB_SEGMENTS = 10;   // 각 스트림당 10개 마디의 초미세 곡선 분할
const TOTAL_SEGMENTS = STREAK_COUNT * SUB_SEGMENTS;
const BOKEH_COUNT = 260;   // 궤도를 고속 회전하는 에너지 스파크/하이라이트
const DUST_COUNT = 300;
const SWIRL_STRANDS = 3;   // 3가닥 층류 소용돌이
const SWIRL_TURNS = 3.6;   // 3.6회전으로 상하 화면을 꽉 채우는 다층 소용돌이
const SWIRL_RADIUS = 30.4; // 기존 대비 95%로 조율된 가로 타원형 반경 (32 * 0.95)
const SWIRL_HEIGHT = 64;   // 위아래 빈 공간 없이 화면 전체를 꽉 채우는 대형 수직 스케일
const TUBE_RADIUS = 2.4;   // 개별 라인 궤적 볼륨 두께
const CAMERA_ORBIT_RADIUS = 50;
const CAMERA_TRAVEL_HEIGHT = 8;  // 화면 중심에서 상하 전체를 꽉 차게 조망
const CAMERA_FOV = 52;

const POINT_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const BOKEH_FRAGMENT_SHADER = `
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    // 3D 구체 노멀/깊이감 계산 (입체적인 3D 광구 라이팅)
    float z = sqrt(max(0.0, 1.0 - d * d));
    float specular = pow(z, 2.2);
    float rim = pow(d, 2.8) * 0.4;
    float a = (specular * 0.85 + rim * 0.35 + 0.12) * vAlpha * uFade;
    // 구체 중심에 입체 하이라이트 광채 블렌딩
    vec3 col = mix(vColor, vec3(1.0), specular * 0.42);
    gl_FragColor = vec4(col, a);
  }
`;

const DUST_FRAGMENT_SHADER = `
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float z = sqrt(max(0.0, 1.0 - d * d));
    float a = pow(z, 1.8) * vAlpha * uFade;
    gl_FragColor = vec4(vColor, a);
  }
`;

// 레퍼런스 이미지의 영롱한 네온 블루 & 퍼플 팔레트
const GRADIENT_STOPS: Array<{ at: number; color: THREE.Color }> = [
  { at: 0, color: new THREE.Color('#38bdf8') },     // 눈부신 일렉트릭 시안
  { at: 0.25, color: new THREE.Color('#60a5fa') },  // 스카이 블루
  { at: 0.55, color: new THREE.Color('#6366f1') },  // 네온 인디고
  { at: 0.8, color: new THREE.Color('#818cf8') },   // 라벤더 블루
  { at: 1, color: new THREE.Color('#9333ea') },     // 딥 바이올렛
];

function sampleGradient(t: number, out: THREE.Color): THREE.Color {
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i];
    const b = GRADIENT_STOPS[i + 1];
    if (t <= b.at) {
      const k = (t - a.at) / (b.at - a.at);
      return out.copy(a.color).lerp(b.color, THREE.MathUtils.clamp(k, 0, 1));
    }
  }
  return out.copy(GRADIENT_STOPS[GRADIENT_STOPS.length - 1].color);
}

// 정규분포 난수 (-1 ~ 1)
function gaussian(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

// 수평 소용돌이 에너지 고리 궤적 좌표 함수 (납작하고 유려한 타원 링)
function getHelixPoint(
  t: number,
  strand: number,
  radialOffset: number,
  axialOffset: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const angle = t * SWIRL_TURNS * Math.PI * 2 + (strand * ((Math.PI * 2) / SWIRL_STRANDS));

  // 바닥으로 갈수록 살짝 넓어지는 우아한 포털 벨(Bell) 형태 (레퍼런스 하단 지면 링 효과)
  const baseFlaring = Math.pow(Math.max(0, 0.35 - t), 1.4) * 4.5;
  const r = SWIRL_RADIUS + radialOffset + baseFlaring;
  out.x = Math.cos(angle) * r;
  out.y = (t - 0.5) * SWIRL_HEIGHT + axialOffset;
  out.z = Math.sin(angle) * r;
  return out;
}

function createPoints(
  count: number,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): {
  points: THREE.Points;
  position: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  color: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
} {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: POINT_VERTEX_SHADER,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, position, geometry, material, color, size, alpha };
}

export default function ParticleBackground({
  isFormRevealed,
  isDispersing = false,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isFormRevealedRef = useRef(isFormRevealed);
  const isDispersingRef = useRef(isDispersing);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    isFormRevealedRef.current = isFormRevealed;
  }, [isFormRevealed]);

  useEffect(() => {
    isDispersingRef.current = isDispersing;
  }, [isDispersing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, CAMERA_ORBIT_RADIUS);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const group = new THREE.Group();
    scene.add(group);

    const sharedUniforms = {
      uScale: {
        value: (window.innerHeight * renderer.getPixelRatio()) /
          (2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2))),
      },
      uFade: { value: 1 },
    };

    // ---------- 1) 이중 나선 플럭스 라인 (LineSegments, 다분할 곡선 마디) ----------
    const streakGeometry = new THREE.BufferGeometry();
    const streakPos = new Float32Array(TOTAL_SEGMENTS * 6);
    const streakCol = new Float32Array(TOTAL_SEGMENTS * 6);
    streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
    streakGeometry.setAttribute('color', new THREE.BufferAttribute(streakCol, 3));
    const streakMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
    streaks.frustumCulled = false;
    group.add(streaks);
    // ---------- 1-B) 수천 가닥의 초고밀도 코어 & 오로라 플럭스 라인 분배 ----------
    const sT = new Float32Array(STREAK_COUNT);
    const sStrand = new Uint8Array(STREAK_COUNT);
    const sSpeed = new Float32Array(STREAK_COUNT);
    const sOffsetR = new Float32Array(STREAK_COUNT);
    const sOffsetA = new Float32Array(STREAK_COUNT);
    const sTrailLen = new Float32Array(STREAK_COUNT);
    const sBright = new Float32Array(STREAK_COUNT);
    const sIsCore = new Uint8Array(STREAK_COUNT);
    const sDir = new Float32Array(STREAK_COUNT * 3);

    for (let i = 0; i < STREAK_COUNT; i++) {
      sT[i] = Math.random();
      sStrand[i] = i % SWIRL_STRANDS;

      // 45%의 가닥을 나선 중심축에 초고밀도 집중 배치하여 자연스럽고 두꺼운 화이트-핫 코어 빔 형성
      const isCore = i < STREAK_COUNT * 0.45;
      sIsCore[i] = isCore ? 1 : 0;

      const tubePhi = Math.random() * Math.PI * 2;
      let tubeDist: number;
      if (isCore) {
        // 중심축 반경 0.05 ~ 0.35 이내에 초밀집 (인위적 파이프 메쉬 없이 선들의 중첩으로 볼륨 형성)
        tubeDist = Math.pow(Math.random(), 1.6) * (TUBE_RADIUS * 0.32);
        sBright[i] = 1.35 + Math.random() * 0.65; // 초고휘도 발광
        sSpeed[i] = 0.032 + Math.random() * 0.038;
        sTrailLen[i] = 0.024 + Math.random() * 0.026;
      } else {
        // 외곽을 부드럽게 감싸는 네온 오로라 플럭스
        tubeDist = (0.28 + Math.sqrt(Math.random()) * 0.85) * TUBE_RADIUS;
        sBright[i] = 0.45 + Math.random() * 0.55;
        sSpeed[i] = 0.016 + Math.random() * 0.024;
        sTrailLen[i] = 0.015 + Math.random() * 0.02;
      }

      sOffsetR[i] = Math.cos(tubePhi) * tubeDist;
      sOffsetA[i] = Math.sin(tubePhi) * tubeDist;

      // 분산용 무작위 방향
      const phi = Math.random() * Math.PI * 2;
      const theta = (Math.random() - 0.5) * Math.PI;
      sDir[i * 3] = Math.cos(theta) * Math.cos(phi);
      sDir[i * 3 + 1] = Math.sin(theta);
      sDir[i * 3 + 2] = Math.cos(theta) * Math.sin(phi);
    }

    // ---------- 2) 입체 미니 보케 파티클 (3D 튜브 오비탈) ----------
    const bokeh = createPoints(BOKEH_COUNT, BOKEH_FRAGMENT_SHADER, sharedUniforms);
    group.add(bokeh.points);
    const bT = new Float32Array(BOKEH_COUNT);
    const bStrand = new Uint8Array(BOKEH_COUNT);
    const bSpeed = new Float32Array(BOKEH_COUNT);
    const bPhi = new Float32Array(BOKEH_COUNT);
    const bDist = new Float32Array(BOKEH_COUNT);
    const bOrbitSpeed = new Float32Array(BOKEH_COUNT);
    const bBaseAlpha = new Float32Array(BOKEH_COUNT);
    const bDir = new Float32Array(BOKEH_COUNT * 3);

    for (let i = 0; i < BOKEH_COUNT; i++) {
      bT[i] = Math.random();
      bStrand[i] = i % SWIRL_STRANDS;
      bSpeed[i] = 0.025 + Math.random() * 0.045; // 궤도를 빠르게 공전하는 빛의 스파크
      bPhi[i] = Math.random() * Math.PI * 2;
      // 소용돌이 고리 단면 주위를 입체적으로 선회
      bDist[i] = (0.2 + Math.random() * 1.4) * TUBE_RADIUS;
      bOrbitSpeed[i] = (Math.random() - 0.5) * 2.0;
      // 레퍼런스 스타일의 반짝이는 미니 스파클 (0.1 ~ 0.45)
      bokeh.size[i] = 0.12 + Math.pow(Math.random(), 2.0) * 0.38;
      bBaseAlpha[i] = 0.25 + Math.random() * 0.65;

      const phi = Math.random() * Math.PI * 2;
      const theta = (Math.random() - 0.5) * Math.PI;
      bDir[i * 3] = Math.cos(theta) * Math.cos(phi);
      bDir[i * 3 + 1] = Math.sin(theta);
      bDir[i * 3 + 2] = Math.cos(theta) * Math.sin(phi);
    }
    bokeh.geometry.attributes.aSize.needsUpdate = true;

    // ---------- 3) 입체 미세 먼지 파티클 (3D 공간 필드) ----------
    const dust = createPoints(DUST_COUNT, DUST_FRAGMENT_SHADER, sharedUniforms);
    group.add(dust.points);
    const dT = new Float32Array(DUST_COUNT);
    const dStrand = new Uint8Array(DUST_COUNT);
    const dSpeed = new Float32Array(DUST_COUNT);
    const dPhi = new Float32Array(DUST_COUNT);
    const dDist = new Float32Array(DUST_COUNT);
    const dOrbitSpeed = new Float32Array(DUST_COUNT);
    const dBaseAlpha = new Float32Array(DUST_COUNT);
    const dDir = new Float32Array(DUST_COUNT * 3);

    for (let i = 0; i < DUST_COUNT; i++) {
      dT[i] = Math.random();
      dStrand[i] = i % SWIRL_STRANDS;
      dSpeed[i] = 0.015 + Math.random() * 0.03;
      dPhi[i] = Math.random() * Math.PI * 2;
      dDist[i] = (0.5 + Math.random() * 2.2) * TUBE_RADIUS;
      dOrbitSpeed[i] = (Math.random() - 0.5) * 1.2;
      dust.size[i] = 0.035 + Math.random() * 0.065;
      dBaseAlpha[i] = 0.15 + Math.random() * 0.45;

      const phi = Math.random() * Math.PI * 2;
      const theta = (Math.random() - 0.5) * Math.PI;
      dDir[i * 3] = Math.cos(theta) * Math.cos(phi);
      dDir[i * 3 + 1] = Math.sin(theta);
      dDir[i * 3 + 2] = Math.cos(theta) * Math.sin(phi);
    }
    dust.geometry.attributes.aSize.needsUpdate = true;

    // ---------- 애니메이션 루프 ----------
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let disperseProgress = 0;
    let intro = 0;
    let orbitAngle = 0;
    // 소용돌이 고리가 3D 공간에서 회전(공전)하는 속도 (기존 대비 2배 감속)
    let spinSpeed = 0.006; 

    const headVec = new THREE.Vector3();
    const tailVec = new THREE.Vector3();
    const tempColor = new THREE.Color();

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      intro = Math.min(intro + delta / 2.2, 1);
      const introEase = 1 - Math.pow(1 - intro, 3);

      const targetSpin = isFormRevealedRef.current ? 0.19 : 0.11;
      spinSpeed += (targetSpin - spinSpeed) * delta * 2;
      const speedBoost = isFormRevealedRef.current ? 1.5 : 1;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // 카메라가 소용돌이 고리를 상단에서 비스듬히 조망 (레퍼런스 이미지의 우아한 타원 링 부감 구도)
      orbitAngle += delta * spinSpeed;
      const targetCamY = CAMERA_TRAVEL_HEIGHT + mouseRef.current.y * 3;
      camera.position.set(
        Math.cos(orbitAngle * 0.4) * CAMERA_ORBIT_RADIUS + mouseRef.current.x * 3,
        targetCamY,
        Math.sin(orbitAngle * 0.4) * CAMERA_ORBIT_RADIUS
      );
      camera.lookAt(0, 0, 0);

      if (isDispersingRef.current) {
        disperseProgress = Math.min(disperseProgress + delta / 1.3, 1);
      }
      const dd = disperseProgress * disperseProgress * 75;
      const fade = introEase * Math.pow(1 - disperseProgress, 1.5);
      sharedUniforms.uFade.value = fade;
      streakMaterial.opacity = fade;

      // 카메라 위치 캐싱 (Z-Depth 원근 계산용)
      const camX = camera.position.x;
      const camY = camera.position.y;
      const camZ = camera.position.z;

      // ---------- 1. 수평 소용돌이 에너지 고리 갱신 (Swirling Cyclone Rings) ----------
      let segIdx = 0;
      for (let i = 0; i < STREAK_COUNT; i++) {
        // 기존 대비 2배 느려진 유려한 궤도 회전 흐름 (0.7 -> 0.35)
        sT[i] = (sT[i] + delta * sSpeed[i] * speedBoost * 0.35) % 1;
        const tHead = sT[i];
        const strand = sStrand[i];
        const rOff = sOffsetR[i];
        const aOff = sOffsetA[i];
        const trailLen = sTrailLen[i];
        const dirX = sDir[i * 3];
        const dirY = sDir[i * 3 + 1];
        const dirZ = sDir[i * 3 + 2];

        const edge = Math.pow(Math.sin(tHead * Math.PI), 0.45);
        const b = sBright[i] * edge;
        const isCore = sIsCore[i] === 1;

        for (let k = 0; k < SUB_SEGMENTS; k++) {
          const uA = k / SUB_SEGMENTS;
          const uB = (k + 1) / SUB_SEGMENTS;

          const tA = Math.max(0, tHead - uA * trailLen);
          const tB = Math.max(0, tHead - uB * trailLen);

          getHelixPoint(tA, strand, rOff, aOff, headVec);
          getHelixPoint(tB, strand, rOff, aOff, tailVec);

          const o = segIdx * 6;
          streakPos[o] = headVec.x + dirX * dd;
          streakPos[o + 1] = headVec.y + dirY * dd;
          streakPos[o + 2] = headVec.z + dirZ * dd;

          streakPos[o + 3] = tailVec.x + dirX * dd;
          streakPos[o + 4] = tailVec.y + dirY * dd;
          streakPos[o + 5] = tailVec.z + dirZ * dd;

          sampleGradient(tA, tempColor);

          // 카메라와의 3D 거리 기반 Z-Depth 원근 (앞쪽 1.85배 초고휘도, 뒤쪽 0.035배로 대폭 어두워져 극강의 뎁스감/원근감 연출)
          const dx = headVec.x - camX;
          const dy = headVec.y - camY;
          const dz = headVec.z - camZ;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const depthNorm = THREE.MathUtils.clamp((dist - 20) / 64, 0, 1);
          // 뒤쪽으로 갈수록 명도를 대폭 낮춤 (기존 0.12 -> 0.035)
          const zDepthFactor = THREE.MathUtils.lerp(1.85, 0.035, Math.pow(depthNorm, 0.72));
          const effectiveBright = b * zDepthFactor;

          // 뒷편에 있는 라인은 날카로운 경계가 허물어지고 부드럽게 번지도록(Soft Blur) 페이드 대비를 완만하게 조율
          const rawFadeA = 1 - uA * 0.85;
          const rawFadeB = 1 - uB * 0.85;
          const fadeA = THREE.MathUtils.lerp(rawFadeA, 0.55, depthNorm * 0.65);
          const fadeB = THREE.MathUtils.lerp(rawFadeB, 0.45, depthNorm * 0.65);

          // 심도 안개(Depth Fog) 효과: 뒤로 갈수록 화이트 코어가 완전히 소멸(depthNorm 0.25 이상에서 제로)하고 어두운 딥 네온 톤으로 가라앉음
          const coreWhite = isCore ? Math.max(0, 1.0 - depthNorm * 2.5) * 0.95 : 0;

          if (isCore) {
            streakCol[o] = (tempColor.r * (1 - coreWhite) + coreWhite) * effectiveBright * 1.5 * fadeA;
            streakCol[o + 1] = (tempColor.g * (1 - coreWhite) + coreWhite) * effectiveBright * 1.5 * fadeA;
            streakCol[o + 2] = (tempColor.b * (1 - coreWhite) + coreWhite) * effectiveBright * 1.5 * fadeA;

            streakCol[o + 3] = (tempColor.r * 0.6 + 0.4 * (1 - depthNorm)) * effectiveBright * 0.85 * fadeB;
            streakCol[o + 4] = (tempColor.g * 0.6 + 0.4 * (1 - depthNorm)) * effectiveBright * 0.85 * fadeB;
            streakCol[o + 5] = (tempColor.b * 0.6 + 0.4 * (1 - depthNorm)) * effectiveBright * 0.85 * fadeB;
          } else {
            streakCol[o] = tempColor.r * effectiveBright * 1.2 * fadeA;
            streakCol[o + 1] = tempColor.g * effectiveBright * 1.2 * fadeA;
            streakCol[o + 2] = tempColor.b * effectiveBright * 1.2 * fadeA;

            streakCol[o + 3] = tempColor.r * effectiveBright * 0.65 * fadeB;
            streakCol[o + 4] = tempColor.g * effectiveBright * 0.65 * fadeB;
            streakCol[o + 5] = tempColor.b * effectiveBright * 0.65 * fadeB;
          }

          segIdx++;
        }
      }
      streakGeometry.attributes.position.needsUpdate = true;
      streakGeometry.attributes.color.needsUpdate = true;

      // ---------- 2. 입체 미니 보케 갱신 (Z-Depth 원근 적용) ----------
      for (let i = 0; i < BOKEH_COUNT; i++) {
        bT[i] = (bT[i] + delta * bSpeed[i] * speedBoost * 0.5) % 1;
        const t = bT[i];
        // 나선 튜브 단면을 3차원으로 입체 선회
        const curPhi = bPhi[i] + time * bOrbitSpeed[i] * 0.5;
        const rOff = Math.cos(curPhi) * bDist[i];
        const aOff = Math.sin(curPhi) * bDist[i];

        getHelixPoint(t, bStrand[i], rOff, aOff, headVec);

        bokeh.position[i * 3] = headVec.x + bDir[i * 3] * dd;
        bokeh.position[i * 3 + 1] = headVec.y + bDir[i * 3 + 1] * dd;
        bokeh.position[i * 3 + 2] = headVec.z + bDir[i * 3 + 2] * dd;

        sampleGradient(t, tempColor);
        bokeh.color[i * 3] = tempColor.r;
        bokeh.color[i * 3 + 1] = tempColor.g;
        bokeh.color[i * 3 + 2] = tempColor.b;

        // 보케 Z-Depth 원근 감쇠 (후면 명도 대폭 감쇠로 뎁스감 극대화)
        const dx = headVec.x - camX;
        const dy = headVec.y - camY;
        const dz = headVec.z - camZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const depthNorm = THREE.MathUtils.clamp((dist - 20) / 64, 0, 1);
        const zFactor = THREE.MathUtils.lerp(1.7, 0.03, Math.pow(depthNorm, 0.75));

        bokeh.alpha[i] = bBaseAlpha[i] * Math.pow(Math.sin(t * Math.PI), 0.7) * zFactor;
      }
      bokeh.geometry.attributes.position.needsUpdate = true;
      bokeh.geometry.attributes.aColor.needsUpdate = true;
      bokeh.geometry.attributes.aAlpha.needsUpdate = true;

      // ---------- 3. 입체 미세 먼지 갱신 (Z-Depth 원근 적용) ----------
      for (let i = 0; i < DUST_COUNT; i++) {
        dT[i] = (dT[i] + delta * dSpeed[i] * speedBoost * 0.5) % 1;
        const t = dT[i];
        const curPhi = dPhi[i] + time * dOrbitSpeed[i] * 0.5;
        const rOff = Math.cos(curPhi) * dDist[i];
        const aOff = Math.sin(curPhi) * dDist[i];

        getHelixPoint(t, dStrand[i], rOff, aOff, headVec);

        dust.position[i * 3] = headVec.x + dDir[i * 3] * dd;
        dust.position[i * 3 + 1] = headVec.y + dDir[i * 3 + 1] * dd;
        dust.position[i * 3 + 2] = headVec.z + dDir[i * 3 + 2] * dd;

        sampleGradient(t, tempColor);
        dust.color[i * 3] = tempColor.r;
        dust.color[i * 3 + 1] = tempColor.g;
        dust.color[i * 3 + 2] = tempColor.b;

        const dx = headVec.x - camX;
        const dy = headVec.y - camY;
        const dz = headVec.z - camZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const depthNorm = THREE.MathUtils.clamp((dist - 20) / 64, 0, 1);
        const zFactor = THREE.MathUtils.lerp(1.5, 0.02, Math.pow(depthNorm, 0.75));

        dust.alpha[i] = dBaseAlpha[i] * Math.sin(t * Math.PI) * zFactor;
      }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.geometry.attributes.aColor.needsUpdate = true;
      dust.geometry.attributes.aAlpha.needsUpdate = true;

      renderer.render(scene, camera);
    };

    renderLoop();

    let resizeTimeout: number;
    const handleResize = () => {
      if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
      resizeTimeout = requestAnimationFrame(() => {
        if (!container) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        sharedUniforms.uScale.value =
          (window.innerHeight * renderer.getPixelRatio()) /
          (2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)));
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      streakGeometry.dispose();
      streakMaterial.dispose();
      [bokeh, dust].forEach((layer) => {
        layer.geometry.dispose();
        layer.material.dispose();
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="particle-background-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.95,
        transition: 'opacity 0.4s ease-in-out',
      }}
    />
  );
}
