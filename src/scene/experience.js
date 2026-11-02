import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createEditEnvironment } from './edit-environment.js';
import { createWorkstation } from './workstation.js';

gsap.registerPlugin(ScrollTrigger);

export function initExperience() {
  const canvas = document.querySelector('#world-canvas');
  if (!canvas || !window.WebGLRenderingContext) {
    document.documentElement.classList.add('webgl-unavailable');
    return;
  }

  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !mobile,
      powerPreference: 'low-power',
      stencil: false,
      depth: true,
    });
  } catch {
    document.documentElement.classList.add('webgl-unavailable');
    return;
  }

  renderer.setClearColor(0x080b10, 0);
  renderer.outputColorSpace = 'srgb';
  renderer.toneMappingExposure = 1.12;
  const scene = new Scene();
  scene.background = null;
  const camera = new PerspectiveCamera(38, 1, 0.1, 90);
  camera.position.set(0, 0, mobile ? 10.4 : 9.5);

  scene.add(new AmbientLight(0x9cc8e8, 1.35));
  const keyLight = new DirectionalLight(0xc3e6ff, 2.8);
  keyLight.position.set(-4, 6, 8);
  scene.add(keyLight);
  const rimLight = new DirectionalLight(0x247cff, 4.5);
  rimLight.position.set(5, 2, -3);
  scene.add(rimLight);
  const cyanLight = new DirectionalLight(0x38e5e9, 2.6);
  cyanLight.position.set(-3, -4, 5);
  scene.add(cyanLight);

  const environment = createEditEnvironment(scene, mobile);
  const workstation = createWorkstation(scene);
  const { rig, components, fans, rgbMaterials } = workstation;
  const pointerRig = new Group();
  scene.add(pointerRig);
  pointerRig.add(rig);
  rig.position.set(mobile ? 0.15 : 2.25, mobile ? -1.05 : -0.02, 0);
  rig.rotation.set(-0.035, -0.14, 0.015);
  rig.scale.setScalar(mobile ? 0.69 : 0.86);

  const pointer = { x: 0, y: 0, easedX: 0, easedY: 0 };
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.35));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width <= 700 ? 10.4 : width < 1000 ? 10 : 9.5;
    camera.updateProjectionMatrix();
    environment.resize(camera, width, height);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  let backgroundScrollProgress = 0;
  if (!reducedMotion) {
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: () => ScrollTrigger.maxScroll(window),
      onUpdate: (self) => {
        backgroundScrollProgress = self.progress;
        environment.setScrollProgress(self.progress);
      },
    });
  }

  const readout = document.querySelector('#component-readout');
  if (!reducedMotion) {
    const scrollSequence = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#exploded',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (readout) {
          readout.textContent = self.progress < 0.15
            ? 'SYSTEM ASSEMBLED'
            : self.progress < 0.66
              ? 'COMPONENTS IN MOTION'
              : self.progress < 0.88
                ? 'REASSEMBLING SYSTEM'
                : 'SYSTEM READY';
        }
        canvas.dataset.explodedProgress = self.progress.toFixed(2);
      },
    },
    });
    scrollSequence.to(rig.position, { x: mobile ? 0 : 0.25, y: mobile ? -0.7 : 0.02 }, 0);
    scrollSequence.to(rig.rotation, { y: 0.12, x: -0.02, z: 0 }, 0);
    scrollSequence.to(rig.scale, { x: mobile ? 0.65 : 0.94, y: mobile ? 0.65 : 0.94, z: mobile ? 0.65 : 0.94 }, 0);

    components.forEach((part, index) => {
    const explodeAt = 0.2 + index * 0.018;
    const reassembleAt = 0.67 + index * 0.015;
    scrollSequence.to(part.object.position, {
      x: part.origin.x + part.delta[0],
      y: part.origin.y + part.delta[1],
      z: part.origin.z + part.delta[2],
      duration: 0.22,
    }, explodeAt);
    scrollSequence.to(part.object.rotation, {
      x: part.originRotation.x + part.rotate[0],
      y: part.originRotation.y + part.rotate[1],
      z: part.originRotation.z + part.rotate[2],
      duration: 0.22,
    }, explodeAt);
    scrollSequence.to(part.object.position, {
      x: part.origin.x,
      y: part.origin.y,
      z: part.origin.z,
      duration: 0.18,
    }, reassembleAt);
    scrollSequence.to(part.object.rotation, {
      x: part.originRotation.x,
      y: part.originRotation.y,
      z: part.originRotation.z,
      duration: 0.18,
    }, reassembleAt);
    });
    scrollSequence.to(rig.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.1 }, 0.94);
    scrollSequence.to(rig.position, { y: -4.5, duration: 0.1 }, 0.94);
  }

  const clock = { elapsed: 0, renderAt: 0, lastTime: 0 };
  const baseIntensity = rgbMaterials.map((material) => material.emissiveIntensity);
  const render = (time) => {
    const delta = Math.min(Math.max((time - clock.lastTime) / 1000, 0), 0.05);
    clock.lastTime = time;
    clock.elapsed += delta;
    if (time - clock.renderAt < 30) return;
    clock.renderAt = time;

    pointer.easedX += (pointer.x - pointer.easedX) * 0.035;
    pointer.easedY += (pointer.y - pointer.easedY) * 0.035;
    camera.position.x += (pointer.easedX * 0.14 - camera.position.x) * 0.02;
    camera.position.y += (-pointer.easedY * 0.1 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
    pointerRig.rotation.y += (pointer.easedX * 0.11 - pointerRig.rotation.y) * 0.018;
    pointerRig.rotation.x += (-pointer.easedY * 0.075 - pointerRig.rotation.x) * 0.018;
    environment.particles.rotation.y = Math.sin(clock.elapsed * 0.07) * 0.07 + pointer.easedX * 0.025;
    environment.particles.rotation.x = pointer.easedY * 0.018;
    environment.strips.forEach((strip, index) => {
      strip.rotation.y = Math.sin(clock.elapsed * 0.17 + index) * 0.08;
      strip.userData.floatOriginY ??= strip.position.y;
      strip.position.y = strip.userData.floatOriginY + Math.sin(clock.elapsed * 0.21 + index * 2) * 0.13;
    });
    environment.frames.forEach((frame, index) => {
      frame.rotation.y = Math.sin(clock.elapsed * 0.18 + index * 1.7) * 0.09 + pointer.easedX * 0.025;
      frame.rotation.x = Math.cos(clock.elapsed * 0.14 + index) * 0.035;
    });
    environment.update(clock.elapsed, delta, pointer.easedX, pointer.easedY, camera);
    environment.streaks.forEach((streak, index) => {
      streak.position.x = Math.sin(clock.elapsed * 0.15 + index * 2.1) * 0.5 + (index - 3) * 2.7;
      streak.material.opacity = 0.13 + (Math.sin(clock.elapsed * 0.8 + index) + 1) * 0.08;
    });
    fans.forEach((fan, index) => { fan.rotation.z += (index % 2 ? -1 : 1) * delta * 1.8; });
    rgbMaterials.forEach((material, index) => {
      material.emissiveIntensity = baseIntensity[index] + Math.sin(clock.elapsed * 1.5 + index * 1.4) * 0.34;
    });
    renderer.render(scene, camera);
  };

  if (import.meta.env.DEV) {
    window.__AMAAN_SCENE__ = { scene, camera, rig, pointerRig, components, fans, renderer };
  }
  window.dispatchEvent(new CustomEvent('amaan:workstation-ready', {
    detail: { rig, pointerRig, components, fans },
  }));
  canvas.dataset.renderMode = reducedMotion ? 'reduced-motion-static' : 'continuous-30fps';
  if (reducedMotion) {
    renderer.render(scene, camera);
  } else {
    renderer.setAnimationLoop(render);
  }
  document.addEventListener('visibilitychange', () => {
    if (reducedMotion) {
      if (!document.hidden) renderer.render(scene, camera);
      return;
    }
    renderer.setAnimationLoop(document.hidden ? null : render);
  });
}
