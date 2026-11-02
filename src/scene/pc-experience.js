import {
  AmbientLight,
  Box3,
  BoxHelper,
  Color,
  DirectionalLight,
  MathUtils,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import { createExternalSetup } from './workstation.js';

let activeExperience = null;

function setComponentInfo(component) {
  document.querySelector('#pc-component-role').textContent = component?.role ?? 'COMPONENT EXPLORER';
  document.querySelector('#pc-component-name').textContent = component?.name ?? 'Select a component';
  document.querySelector('#pc-component-description').textContent = component?.description
    ?? 'Orbit around the workstation, then select a component to inspect its role.';
}

function appendComponentButtons(components, onSelect) {
  const rail = document.querySelector('#pc-component-list');
  rail.replaceChildren();
  for (const component of components) {
    const button = document.createElement('button');
    button.className = 'pc-part-button';
    button.type = 'button';
    button.textContent = component.name;
    button.dataset.componentId = component.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => onSelect(component));
    rail.append(button);
  }
  return rail;
}

function disposeExternalSetup(setup) {
  setup.root.traverse((node) => node.geometry?.dispose());
  setup.ownedMaterials.forEach((material) => material.dispose());
  setup.root.removeFromParent();
}

export async function mountPCExperience({ api, dialog }) {
  if (activeExperience) return activeExperience;

  const canvas = dialog.querySelector('#pc-experience-canvas');
  const fallback = dialog.querySelector('#pc-webgl-fallback');
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: !mobile,
      powerPreference: 'low-power',
      stencil: false,
      depth: true,
    });
  } catch {
    fallback.hidden = false;
    return null;
  }

  renderer.setClearColor(0x050a10, 1);
  renderer.outputColorSpace = 'srgb';
  renderer.toneMappingExposure = 1.15;

  const scene = new Scene();
  scene.background = new Color(0x050a10);
  const camera = new PerspectiveCamera(38, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.minDistance = mobile ? 8.5 : 6.2;
  controls.maxDistance = 18;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.32;

  scene.add(new AmbientLight(0x9fc9e3, 1.7));
  const keyLight = new DirectionalLight(0xe4f4ff, 3.4);
  keyLight.position.set(-4, 7, 8);
  scene.add(keyLight);
  const cyanLight = new DirectionalLight(0x42d8ed, 3.8);
  cyanLight.position.set(5, 2, 4);
  scene.add(cyanLight);
  const rimLight = new DirectionalLight(0x2374c4, 2.8);
  rimLight.position.set(3, 4, -5);
  scene.add(rimLight);
  const warmLight = new DirectionalLight(0xf19a5e, 1.1);
  warmLight.position.set(-5, 1, -1);
  scene.add(warmLight);

  const { rig, pointerRig, components } = api;
  const originalParent = rig.parent ?? pointerRig;
  const originalRigState = {
    position: rig.position.clone(),
    rotation: rig.rotation.clone(),
    scale: rig.scale.clone(),
  };
  const originalComponentStates = components.map((part) => ({
    part,
    position: part.object.position.clone(),
    rotation: part.object.rotation.clone(),
  }));
  const externalSetup = createExternalSetup(scene);
  const monitor = externalSetup.components.find((part) => part.id === 'monitor').object;
  const keyboard = externalSetup.components.find((part) => part.id === 'keyboard').object;
  const mouse = externalSetup.components.find((part) => part.id === 'mouse').object;
  const desk = externalSetup.components.find((part) => part.id === 'desk').object;

  if (mobile) {
    desk.scale.set(0.52, 1, 0.62);
    monitor.position.set(0, 2.0, -0.65);
    monitor.scale.setScalar(0.66);
    keyboard.position.set(-0.55, -2.16, 0.65);
    keyboard.scale.setScalar(0.72);
    mouse.position.set(0.82, -2.13, 0.73);
    mouse.scale.setScalar(0.8);
    rig.position.set(0, -0.48, 0.05);
    rig.rotation.set(-0.035, -0.12, 0);
    rig.scale.setScalar(0.76);
    camera.position.set(0, 1.25, 14.2);
    controls.target.set(0, -0.2, 0);
  } else {
    rig.position.set(2.12, -0.08, 0.05);
    rig.rotation.set(-0.025, -0.12, 0);
    rig.scale.setScalar(1.04);
    camera.position.set(0, 1.55, 11.6);
    controls.target.set(0, -0.52, 0);
  }

  originalParent.remove(rig);
  scene.add(rig);

  const componentMap = new Map(components.concat(externalSetup.components).map((component) => [component.id, component]));
  const selectableRoots = [...componentMap.values()].map((component) => component.object);
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const bounds = new Box3();
  const center = new Vector3();
  const viewDirection = new Vector3();
  let helper = null;
  let highlightedId = null;
  let selectedId = null;
  let disposed = false;
  let explosionTimeline = null;
  let closeTimer = null;
  let lastFrameTime = 0;
  const motionTweens = [];

  function removeHelper() {
    if (!helper) return;
    scene.remove(helper);
    helper.geometry.dispose();
    helper.material.dispose();
    helper = null;
  }

  function highlightComponent(component) {
    if (highlightedId === component?.id) return;
    highlightedId = component?.id ?? null;
    removeHelper();
    if (!component) return;
    scene.updateMatrixWorld(true);
    helper = new BoxHelper(component.object, 0x68edf3);
    helper.material.transparent = true;
    helper.material.opacity = 0.88;
    helper.material.depthTest = false;
    helper.renderOrder = 20;
    scene.add(helper);
  }

  function focusComponent(component) {
    selectedId = component.id;
    setComponentInfo(component);
    document.querySelectorAll('.pc-part-button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.componentId === selectedId));
    });
    highlightComponent(component);

    scene.updateMatrixWorld(true);
    bounds.setFromObject(component.object);
    bounds.getCenter(center);
    const size = bounds.getSize(new Vector3());
    viewDirection.copy(camera.position).sub(controls.target).normalize();
    const distance = MathUtils.clamp(size.length() * 1.65, 3.5, 8.5);
    const destination = center.clone().add(viewDirection.multiplyScalar(distance));
    motionTweens.forEach((tween) => tween.kill());
    motionTweens.length = 0;
    motionTweens.push(gsap.to(controls.target, {
      x: center.x, y: center.y, z: center.z, duration: 0.8, ease: 'power3.inOut',
    }));
    motionTweens.push(gsap.to(camera.position, {
      x: destination.x, y: destination.y, z: destination.z, duration: 0.8, ease: 'power3.inOut',
    }));
    controls.autoRotate = false;
  }

  const rail = appendComponentButtons([...componentMap.values()], focusComponent);
  const explodeButton = dialog.querySelector('#pc-explode');
  const assembleButton = dialog.querySelector('#pc-assemble');
  const resetButton = dialog.querySelector('#pc-reset-view');
  const backButton = dialog.querySelector('#pc-experience-back');
  const explodableParts = components.filter((part) => part.id !== 'chassis');
  explosionTimeline = gsap.timeline({ paused: true, onUpdate: updateExplosionControls });
  explodableParts.forEach((part, index) => {
    const delay = index * 0.055;
    explosionTimeline.to(part.object.position, {
      x: part.origin.x + part.delta[0],
      y: part.origin.y + part.delta[1],
      z: part.origin.z + part.delta[2],
      duration: 0.8,
      ease: 'power3.inOut',
    }, delay);
    explosionTimeline.to(part.object.rotation, {
      x: part.originRotation.x + part.rotate[0],
      y: part.originRotation.y + part.rotate[1],
      z: part.originRotation.z + part.rotate[2],
      duration: 0.8,
      ease: 'power3.inOut',
    }, delay);
  });

  function updateExplosionControls() {
    const progress = explosionTimeline?.progress() ?? 0;
    explodeButton.disabled = progress >= 0.999;
    assembleButton.disabled = progress <= 0.001;
  }

  const onExplode = () => {
    controls.autoRotate = false;
    explosionTimeline.play();
  };
  const onAssemble = () => explosionTimeline.reverse();
  explodeButton.addEventListener('click', onExplode);
  assembleButton.addEventListener('click', onAssemble);
  resetButton.addEventListener('click', resetView);

  function resetView() {
    selectedId = null;
    rail.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    setComponentInfo(null);
    highlightComponent(null);
    motionTweens.forEach((tween) => tween.kill());
    motionTweens.length = 0;
    controls.autoRotate = !reducedMotion;
    const target = mobile ? new Vector3(0, -0.2, 0) : new Vector3(0, -0.52, 0);
    const position = mobile ? new Vector3(0, 1.25, 14.2) : new Vector3(0, 1.55, 11.6);
    motionTweens.push(gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: 0.75, ease: 'power3.inOut' }));
    motionTweens.push(gsap.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: 0.75, ease: 'power3.inOut' }));
  }

  function pickComponent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(selectableRoots, true);
    for (const intersection of intersections) {
      let node = intersection.object;
      while (node && !node.userData.componentId) node = node.parent;
      if (node?.userData.componentId) return componentMap.get(node.userData.componentId) ?? null;
    }
    return null;
  }

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return;
    const component = pickComponent(event);
    canvas.style.cursor = component ? 'pointer' : 'grab';
    highlightComponent(component ?? (selectedId ? componentMap.get(selectedId) : null));
  };
  const onCanvasClick = (event) => {
    const component = pickComponent(event);
    if (component) focusComponent(component);
  };
  const onCanvasLeave = () => highlightComponent(selectedId ? componentMap.get(selectedId) : null);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('pointerleave', onCanvasLeave);

  function resize() {
    const width = Math.max(1, dialog.clientWidth);
    const height = Math.max(1, dialog.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.4));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    controls.update();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const closeWithTransition = () => {
    if (closeTimer || disposed) return;
    dialog.classList.add('is-closing');
    closeTimer = window.setTimeout(() => {
      if (dialog.open) dialog.close();
    }, 280);
  };
  const onBackdropClick = (event) => {
    if (event.target === dialog) closeWithTransition();
  };
  backButton.addEventListener('click', closeWithTransition);
  dialog.addEventListener('click', onBackdropClick);

  function cleanup() {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(closeTimer);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('pointerleave', onCanvasLeave);
    explodeButton.removeEventListener('click', onExplode);
    assembleButton.removeEventListener('click', onAssemble);
    resetButton.removeEventListener('click', resetView);
    backButton.removeEventListener('click', closeWithTransition);
    dialog.removeEventListener('click', onBackdropClick);
    renderer.setAnimationLoop(null);
    controls.dispose();
    explosionTimeline.kill();
    motionTweens.forEach((tween) => tween.kill());
    removeHelper();
    originalComponentStates.forEach(({ part, position, rotation }) => {
      part.object.position.copy(position);
      part.object.rotation.copy(rotation);
    });
    rig.removeFromParent();
    originalParent.add(rig);
    rig.position.copy(originalRigState.position);
    rig.rotation.copy(originalRigState.rotation);
    rig.scale.copy(originalRigState.scale);
    disposeExternalSetup(externalSetup);
    renderer.setSize(1, 1, false);
    renderer.dispose();
    dialog.classList.remove('is-closing');
    rail.replaceChildren();
    if (import.meta.env.DEV) delete window.__AMAAN_PC_EXPERIENCE__;
    activeExperience = null;
  }

  const onDialogClose = () => cleanup();
  dialog.addEventListener('close', onDialogClose, { once: true });

  activeExperience = { cleanup, resetView };
  if (import.meta.env.DEV) {
    window.__AMAAN_PC_EXPERIENCE__ = { scene, camera, controls, rig, components, externalSetup, explosionTimeline };
  }
  renderer.setAnimationLoop((time) => {
    if (time - lastFrameTime < 28) return;
    lastFrameTime = time;
    controls.update();
    helper?.update();
    renderer.render(scene, camera);
  });
  resize();
  return activeExperience;
}
