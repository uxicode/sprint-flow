'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  isFormRevealed: boolean;
  isDispersing?: boolean;
}

// 스프링 형태 파라미터
const PARTICLE_COUNT = 2400;
const SPRING_STRANDS = 2; // 이중 나선
const SPRING_TURNS = 6;
const SPRING_RADIUS = 28;
const SPRING_HEIGHT = 120;
const TUBE_RADIUS = 2.4;
const SATURATION_SCALE = 0.45; // 1.0 = 원본 채도

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
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 38);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Mouse Tracking (살짝 기울이는 패럴랙스용)
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Circle Texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    const circleTexture = new THREE.CanvasTexture(canvas);

    // Particle Data
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const targets = new Float32Array(PARTICLE_COUNT * 3);
    const delays = new Float32Array(PARTICLE_COUNT);

    const colorTemp = new THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };
    const palette = [
      '#00f2fe',
      '#4facfe',
      '#8b5cf6',
      '#06b6d4',
      '#f09858',
      '#3b82f6',
      '#ffffff',
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const strand = i % SPRING_STRANDS;
      const t = Math.random(); // 0~1 나선 진행도
      const angle =
        t * SPRING_TURNS * Math.PI * 2 +
        (strand * Math.PI * 2) / SPRING_STRANDS;
      const y = (t - 0.5) * SPRING_HEIGHT;

      // 코일 중심선 + 튜브 두께 오프셋
      const jitter = () => (Math.random() - 0.5) * 2 * TUBE_RADIUS;
      targets[i * 3] = Math.cos(angle) * SPRING_RADIUS + jitter();
      targets[i * 3 + 1] = y + jitter();
      targets[i * 3 + 2] = Math.sin(angle) * SPRING_RADIUS + jitter();

      // 화면 전역에 흩어진 시작 위치
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      delays[i] = Math.random() * 0.6;

      colorTemp.set(palette[Math.floor(Math.random() * palette.length)]);
      colorTemp.getHSL(hsl);
      colorTemp.setHSL(hsl.h, hsl.s * SATURATION_SCALE, hsl.l);
      const shade = 0.55 + t * 0.45;
      colors[i * 3] = colorTemp.r * shade;
      colors[i * 3 + 1] = colorTemp.g * shade;
      colors[i * 3 + 2] = colorTemp.b * shade;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.0,
      sizeAttenuation: true,
      vertexColors: true,
      map: circleTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let assemble = 0; // 0: 흩어짐 → 1: 스프링 완성
    let spinSpeed = 0.2;
    let orbitAngle = 0;
    const CAMERA_ORBIT_RADIUS = 42;
    const CAMERA_TRAVEL_HEIGHT = 24;
    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    let disperseProgress = 0;
    let velocitiesReady = false;
    const baseOpacity = material.opacity;

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      assemble = Math.min(assemble + delta / 3.5, 1);

      // 폼이 열리면 회전 속도를 살짝 높임
      const targetSpin = isFormRevealedRef.current ? 0.35 : 0.2;
      spinSpeed += (targetSpin - spinSpeed) * delta * 2;

      mouseRef.current.x +=
        (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y +=
        (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // 파티클은 고정, 카메라가 스프링 주위를 공전하며 상하로 따라 이동
      orbitAngle += delta * spinSpeed;
      const camY =
        Math.sin(orbitAngle * 0.6) * CAMERA_TRAVEL_HEIGHT +
        mouseRef.current.y * 3;
      camera.position.set(
        Math.cos(orbitAngle) * CAMERA_ORBIT_RADIUS + mouseRef.current.x * 2,
        camY,
        Math.sin(orbitAngle) * CAMERA_ORBIT_RADIUS
      );
      camera.lookAt(0, camY * 0.3, 0);

      const posArray = positionAttr.array as Float32Array;
      // 스프링이 숨쉬는 듯한 미세한 상하 파동
      const breathe = Math.sin(time * 1.5) * 0.15;

      const dispersing = isDispersingRef.current;

      if (dispersing) {
        // 현재 위치 기준 바깥 방향 + 랜덤 성분으로 흩어짐
        if (!velocitiesReady) {
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const idx = i * 3;
            const dir = new THREE.Vector3(
              posArray[idx] + (Math.random() - 0.5) * 20,
              posArray[idx + 1] + (Math.random() - 0.5) * 20,
              posArray[idx + 2] + (Math.random() - 0.5) * 20
            ).normalize();
            const speed = 15 + Math.random() * 35;
            velocities[idx] = dir.x * speed;
            velocities[idx + 1] = dir.y * speed;
            velocities[idx + 2] = dir.z * speed;
          }
          velocitiesReady = true;
        }

        disperseProgress = Math.min(disperseProgress + delta / 1.3, 1);
        const accel = 0.4 + disperseProgress * 2.2;
        for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
          posArray[i] += velocities[i] * delta * accel;
        }
        material.opacity = baseOpacity * Math.pow(1 - disperseProgress, 1.5);
      } else {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const idx = i * 3;
          const local = THREE.MathUtils.clamp(
            (assemble - delays[i]) / (1 - 0.6),
            0,
            1
          );
          const ease = 1 - Math.pow(1 - local, 3);
          const follow = 0.02 + ease * 0.1;

          const wobble = Math.sin(time * 2 + i) * 0.04 * ease;

          posArray[idx] += (targets[idx] - posArray[idx]) * follow;
          posArray[idx + 1] +=
            (targets[idx + 1] + breathe + wobble - posArray[idx + 1]) * follow;
          posArray[idx + 2] += (targets[idx + 2] - posArray[idx + 2]) * follow;
        }
      }

      positionAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    renderLoop();

    // Resize Handler
    let resizeTimeout: number;
    const handleResize = () => {
      if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
      resizeTimeout = requestAnimationFrame(() => {
        if (!container) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    };
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      circleTexture.dispose();
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
