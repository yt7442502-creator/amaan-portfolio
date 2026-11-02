import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';

const lensVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lensFragmentShader = `
  uniform float uTime;
  uniform float uStrength;
  uniform float uAspect;
  uniform vec2 uBlackHoleUv;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float nebulaNoise(vec2 p) {
    float value = 0.0;
    float amplitude = 0.56;
    for (int octave = 0; octave < 4; octave++) {
      value += valueNoise(p) * amplitude;
      p = p * 2.03 + vec2(8.7, 3.1);
      amplitude *= 0.48;
    }
    return value;
  }

  float starLayer(vec2 uv, float scale, float threshold) {
    vec2 cell = uv * scale;
    vec2 id = floor(cell);
    vec2 local = fract(cell) - 0.5;
    vec2 offset = vec2(hash(id + 17.3), hash(id + 41.7)) - 0.5;
    float d = length(local - offset * 0.72);
    float star = (1.0 - smoothstep(0.012, 0.045, d)) * step(threshold, hash(id));
    float flicker = 0.82 + 0.18 * sin(uTime * 0.34 + hash(id) * 6.283);
    return star * flicker;
  }

  void main() {
    vec2 delta = vUv - uBlackHoleUv;
    delta.x *= uAspect;
    float radius = length(delta);
    vec2 direction = delta / max(radius, 0.0001);

    float deflection = uStrength / (radius * radius + 0.018);
    vec2 lensedUv = vUv + direction * min(deflection, 0.075) / vec2(uAspect, 1.0);
    vec2 counterWarpUv = vUv - direction * min(deflection * 0.24, 0.023) / vec2(uAspect, 1.0);

    float stars = starLayer(lensedUv, 144.0, 0.992);
    stars += starLayer(counterWarpUv + vec2(0.19, 0.37), 73.0, 0.986) * 0.38;
    vec2 cloudUv = vUv * vec2(uAspect * 2.6, 3.2);
    cloudUv += vec2(uTime * 0.003, -uTime * 0.0015);
    float cloud = nebulaNoise(cloudUv);
    float nebulaMask = smoothstep(0.43, 0.77, cloud) * 0.075;
    float nebulaMask2 = smoothstep(0.52, 0.82, nebulaNoise(cloudUv * 0.62 + 4.2)) * 0.035;

    float upperArc = smoothstep(-0.2, 0.72, direction.y);
    float lowerArc = smoothstep(0.1, 0.82, -direction.y) * 0.28;
    float lensArc = exp(-pow((radius - 0.143) * 66.0, 2.0)) * max(upperArc, lowerArc);
    float halo = exp(-radius * 19.0) * 0.12;

    vec3 starColor = mix(vec3(0.46, 0.61, 0.76), vec3(1.0, 0.83, 0.64), hash(floor(lensedUv * 144.0)));
    vec3 warmNebula = vec3(0.19, 0.065, 0.024);
    vec3 coolNebula = vec3(0.035, 0.10, 0.19);
    vec3 color = starColor * stars * 0.62;
    color += mix(coolNebula, warmNebula, smoothstep(0.43, 0.72, cloud)) * (nebulaMask + nebulaMask2);
    color += vec3(0.58, 0.34, 0.14) * lensArc * 0.2;
    color += vec3(0.12, 0.045, 0.016) * halo;

    float alpha = clamp(stars * 0.38 + nebulaMask + nebulaMask2 + lensArc * 0.2 + halo * 0.16, 0.0, 0.36);
    gl_FragColor = vec4(color, alpha);
  }
`;

const diskVertexShader = `
  varying vec2 vDisk;
  varying float vRadius;
  varying float vAngle;
  void main() {
    vDisk = position.xy;
    vRadius = length(position.xy);
    vAngle = atan(position.y, position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const diskFragmentShader = `
  uniform float uTime;
  varying vec2 vDisk;
  varying float vRadius;
  varying float vAngle;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float r = vRadius;
    float differentialSpeed = uTime * (0.32 + 1.4 / pow(max(r, 0.92), 1.25));
    float flowAngle = vAngle + differentialSpeed;
    float turbulence = noise(vec2(flowAngle * 4.6, r * 3.8 - uTime * 0.62));
    float structure = noise(vec2(flowAngle * 10.0 - uTime * 0.55, r * 7.5 + uTime * 0.14));
    float filamentWave = 0.5 + 0.5 * sin(flowAngle * 12.0 + r * 4.0 + turbulence * 5.5);
    float filament = pow(max(0.0, filamentWave), 10.0) * smoothstep(0.15, 0.82, structure);

    float edgeWarp = sin(vAngle * 5.0 + uTime * 0.21) * 0.095 + (turbulence - 0.5) * 0.12;
    float innerEdge = 0.96 + edgeWarp;
    float outerEdge = 4.46 + sin(vAngle * 3.0 - uTime * 0.12) * 0.22 + (structure - 0.5) * 0.32;
    float radialMask = smoothstep(innerEdge, innerEdge + 0.19, r)
                     * (1.0 - smoothstep(outerEdge - 0.28, outerEdge, r));
    float clump = 0.58 + turbulence * 0.72 + structure * 0.26 + filament * 0.82;
    float hotInner = 1.0 - smoothstep(1.02, 3.38, r);
    float hotFilament = filament * (1.0 - smoothstep(1.35, 3.85, r));
    float innerFlare = exp(-pow((r - 1.58) * 0.82, 2.0)) * (0.36 + turbulence * 0.64);
    float hotPatch = smoothstep(0.48, 0.86, structure) * (0.4 + filament * 0.6);

    vec3 outerBrown = vec3(0.17, 0.055, 0.021);
    vec3 burntOrange = vec3(0.65, 0.19, 0.048);
    vec3 amber = vec3(1.28, 0.55, 0.16);
    vec3 gold = vec3(1.85, 1.13, 0.48);
    vec3 nearWhite = vec3(2.15, 1.86, 1.38);

    vec3 color = mix(outerBrown, burntOrange, 1.0 - smoothstep(2.0, 3.55, r));
    color = mix(color, amber, hotInner * (0.64 + turbulence * 0.34));
    color = mix(color, gold, clamp(hotInner * 0.5 + hotFilament * 0.8 + innerFlare * 0.42, 0.0, 0.96));
    color = mix(color, nearWhite, clamp(hotFilament * 0.62 + innerFlare * 0.58 + hotPatch * hotInner * 0.3, 0.0, 0.93));
    color *= clump * radialMask;

    float alpha = radialMask * (0.4 + turbulence * 0.2 + hotInner * 0.23 + hotFilament * 0.24);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.88));
  }
`;

function createSpaceParticles(mobile) {
  const count = mobile ? 82 : 210;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    positions[offset] = (Math.random() - 0.5) * 29;
    positions[offset + 1] = (Math.random() - 0.5) * 17;
    positions[offset + 2] = -4 - Math.random() * 15;
    const warmStar = Math.random() > 0.9;
    colors[offset] = warmStar ? 1 : 0.62;
    colors[offset + 1] = warmStar ? 0.68 : 0.76;
    colors[offset + 2] = warmStar ? 0.4 : 0.88;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return new Points(geometry, new PointsMaterial({
    size: mobile ? 0.022 : 0.029,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    sizeAttenuation: true,
  }));
}

function createOrbitDust(mobile) {
  const count = mobile ? 58 : 150;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.08 + Math.random() * 3.15;
    const offset = index * 3;
    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = Math.sin(angle) * radius;
    positions[offset + 2] = (Math.random() - 0.5) * 0.075;
    const hot = Math.random() > 0.84;
    colors[offset] = hot ? 1 : 0.5;
    colors[offset + 1] = hot ? 0.7 : 0.65;
    colors[offset + 2] = hot ? 0.38 : 0.78;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return new Points(geometry, new PointsMaterial({
    size: mobile ? 0.022 : 0.025,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    sizeAttenuation: true,
  }));
}

function createWarpedDiskGeometry(mobile) {
  const radialSteps = mobile ? 30 : 44;
  const angularSteps = mobile ? 160 : 240;
  const innerRadius = 0.91;
  const outerRadius = 4.62;
  const positions = new Float32Array(radialSteps * angularSteps * 3);
  const indices = [];

  for (let radial = 0; radial < radialSteps; radial += 1) {
    const radialT = radial / (radialSteps - 1);
    const radius = MathUtils.lerp(innerRadius, outerRadius, radialT);
    for (let angular = 0; angular < angularSteps; angular += 1) {
      const angle = (angular / angularSteps) * Math.PI * 2;
      const offset = (radial * angularSteps + angular) * 3;
      const irregularity = Math.sin(angle * 4.0 + radialT * 8.0) * 0.035
        + Math.sin(angle * 9.0 - radialT * 5.0) * 0.018;
      const warpedRadius = radius + irregularity * (0.3 + radialT);
      const verticalWarp = (Math.sin(angle * 3.0 + radialT * 12.0) * 0.035
        + Math.sin(angle * 7.0 - radialT * 8.0) * 0.018) * (0.4 + radialT);
      positions[offset] = Math.cos(angle) * warpedRadius;
      positions[offset + 1] = Math.sin(angle) * warpedRadius;
      positions[offset + 2] = verticalWarp;

      const nextAngular = (angular + 1) % angularSteps;
      const nextRing = radial + 1;
      if (radial < radialSteps - 1) {
        const a = radial * angularSteps + angular;
        const b = radial * angularSteps + nextAngular;
        const c = nextRing * angularSteps + angular;
        const d = nextRing * angularSteps + nextAngular;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createLabelTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(11, 14, 17, 0.86)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(232, 199, 144, 0.72)';
  context.lineWidth = 2;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = '#e5c99d';
  context.font = '500 25px monospace';
  context.fillText(label, 15, 57);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createAttractionFragments(blackHole, mobile) {
  const count = mobile ? 11 : 19;
  const fragments = [];
  const labels = ['FRAME 04', 'CUT / 12', 'A-ROLL', '00:24:08', 'V1 / 24', 'SYNC', 'TAKE 03'];
  const colors = [0xe8c88e, 0xaec4d2, 0xd8874e, 0xb9c9d2];

  for (let index = 0; index < count; index += 1) {
    const root = new Group();
    const size = 0.14 + (index % 4) * 0.035;
    const color = colors[index % colors.length];
    const edgeMaterial = new MeshBasicMaterial({ color, transparent: true, opacity: 0.58, depthWrite: false });
    const fillMaterial = new MeshBasicMaterial({ color: 0x18202a, transparent: true, opacity: 0.4, depthWrite: false, side: DoubleSide });

    if (index % 3 === 0) {
      root.add(new Mesh(new BoxGeometry(size * 1.8, size * 1.12, 0.025), fillMaterial));
      const frameParts = [
        [[size * 1.85, 0.018, 0.035], [0, size * 0.55, 0.025]],
        [[size * 1.85, 0.018, 0.035], [0, -size * 0.55, 0.025]],
        [[0.018, size * 1.12, 0.035], [-size * 0.9, 0, 0.025]],
        [[0.018, size * 1.12, 0.035], [size * 0.9, 0, 0.025]],
      ];
      for (const [dimensions, position] of frameParts) {
        const framePart = new Mesh(new BoxGeometry(...dimensions), edgeMaterial.clone());
        framePart.position.set(...position);
        root.add(framePart);
      }
      const labelMaterial = new MeshBasicMaterial({
        map: createLabelTexture(labels[Math.floor(index / 3) % labels.length]),
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        side: DoubleSide,
      });
      root.add(new Mesh(new PlaneGeometry(size * 1.5, size * 0.55), labelMaterial));
    } else if (index % 3 === 1) {
      const polyMaterial = new MeshBasicMaterial({ color, transparent: true, opacity: 0.58, wireframe: true, depthWrite: false });
      const poly = new Mesh(new OctahedronGeometry(size * 0.82, 0), polyMaterial);
      root.add(poly);
      const core = new Mesh(new SphereGeometry(size * 0.13, 8, 6), fillMaterial);
      root.add(core);
    } else {
      const chip = new Mesh(new BoxGeometry(size * 0.82, size * 0.68, size * 0.16), fillMaterial);
      root.add(chip);
      const slash = new Mesh(new BoxGeometry(size * 0.92, 0.016, 0.018), edgeMaterial);
      slash.rotation.z = 0.34;
      slash.position.z = size * 0.12;
      root.add(slash);
    }

    const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const startRadius = 2.65 + Math.random() * 2.6;
    const startProgress = 0.04 + (index / count) * 0.24;
    const scale = 0.48 + Math.random() * 0.38;
    const materials = new Set();
    root.traverse((node) => {
      if (!node.isMesh) return;
      const meshMaterials = Array.isArray(node.material) ? node.material : [node.material];
      meshMaterials.forEach((material) => {
        material.userData.baseOpacity = material.opacity;
        materials.add(material);
      });
    });
    root.scale.setScalar(scale);
    blackHole.add(root);
    fragments.push({ root, materials: [...materials], angle, startRadius, startProgress, scale, phase: Math.random() * Math.PI * 2 });
  }
  return fragments;
}

export function createEditEnvironment(scene, mobile) {
  const space = new Group();
  const blackHole = new Group();
  const disk = new Group();
  const starField = createSpaceParticles(mobile);
  const lensStrength = mobile ? 0.0028 : 0.0037;
  const worldPlane = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBlackHoleUv: { value: new Vector2(0.5, 0.5) },
        uStrength: { value: lensStrength },
        uAspect: { value: 1 },
      },
      vertexShader: lensVertexShader,
      fragmentShader: lensFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  worldPlane.position.z = -23;
  worldPlane.renderOrder = -2;
  space.add(worldPlane, starField, blackHole);

  const horizon = new Mesh(
    new SphereGeometry(0.985, mobile ? 48 : 72, mobile ? 32 : 48),
    new MeshBasicMaterial({ color: 0x010101, toneMapped: false }),
  );
  horizon.name = 'event-horizon';
  blackHole.add(horizon);

  const shadowShell = new Mesh(
    new SphereGeometry(1.075, mobile ? 40 : 64, mobile ? 28 : 40),
    new MeshBasicMaterial({
      color: 0x351b10,
      transparent: true,
      opacity: 0.055,
      side: BackSide,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
  );
  blackHole.add(shadowShell);

  const photonRing = new Mesh(
    new TorusGeometry(1.055, 0.012, 7, mobile ? 80 : 136),
    new MeshBasicMaterial({ color: 0xffe6bc, transparent: true, opacity: 0.34, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
  );
  photonRing.rotation.x = 0.11;
  blackHole.add(photonRing);

  const lensArc = new Mesh(
    new TorusGeometry(1.13, 0.007, 5, mobile ? 72 : 128),
    new MeshBasicMaterial({ color: 0xe9a961, transparent: true, opacity: 0.2, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
  );
  lensArc.rotation.set(0.16, 0.08, 0.12);
  blackHole.add(lensArc);

  const warpedDisk = new Mesh(
    createWarpedDiskGeometry(mobile),
    new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: diskVertexShader,
      fragmentShader: diskFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      toneMapped: false,
    }),
  );
  warpedDisk.name = 'irregular-accretion-disk';
  disk.add(warpedDisk, createOrbitDust(mobile));
  disk.rotation.set(1.08, 0.08, -0.48);
  blackHole.add(disk);

  space.position.z = -0.02;
  scene.add(space);

  const origin = new Vector3(0, mobile ? 0.2 : 0, mobile ? -3.2 : -2.7);
  blackHole.position.copy(origin);
  blackHole.scale.setScalar(mobile ? 1.12 : 1.42);
  const fragments = createAttractionFragments(blackHole, mobile);
  const projectedPosition = new Vector3();

  function resize(camera, width, height) {
    const distance = Math.abs(camera.position.z - worldPlane.position.z);
    const viewHeight = 2 * Math.tan(MathUtils.degToRad(camera.fov * 0.5)) * distance;
    worldPlane.scale.set(viewHeight * (width / height), viewHeight, 1);
    worldPlane.material.uniforms.uAspect.value = width / height;
  }

  function setScrollProgress(progress) {
    space.userData.scrollProgress = progress;
  }

  function update(time, delta, pointerX, pointerY, camera) {
    worldPlane.material.uniforms.uTime.value = time;
    warpedDisk.material.uniforms.uTime.value = time;
    blackHole.position.x = origin.x + pointerX * 0.12;
    blackHole.position.y = origin.y - pointerY * 0.08;
    disk.rotation.z = -0.48 + time * 0.009;
    photonRing.rotation.y = Math.sin(time * 0.12) * 0.025;
    lensArc.rotation.z = 0.12 + Math.sin(time * 0.08) * 0.018;

    const scrollProgress = space.userData.scrollProgress ?? 0;
    for (const fragment of fragments) {
      const approach = MathUtils.smoothstep(scrollProgress, fragment.startProgress, fragment.startProgress + 0.56);
      const radius = MathUtils.lerp(fragment.startRadius, 0.54, Math.pow(approach, 1.24));
      const spiral = approach * approach * (5.8 + fragment.startRadius * 0.45);
      const angle = fragment.angle + time * (0.045 + approach * 0.16) + spiral;
      fragment.root.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.55,
        0.38 + Math.sin(angle * 1.7 + fragment.phase) * 0.23 + approach * 0.14,
      );
      const acceleration = 0.12 + approach * approach * 1.8;
      fragment.root.rotation.x += delta * acceleration * 0.6;
      fragment.root.rotation.y += delta * acceleration * 0.8;
      fragment.root.rotation.z = fragment.phase + angle * 0.7;
      fragment.root.visible = radius > 1.025;
      const horizonFade = MathUtils.smoothstep(radius, 0.78, 1.35);
      const scale = fragment.scale * (1.0 - approach * 0.28) * horizonFade;
      fragment.root.scale.setScalar(scale);
      fragment.materials.forEach((material) => {
        if (material.transparent) material.opacity = material.userData.baseOpacity * horizonFade;
      });
    }

    blackHole.getWorldPosition(projectedPosition).project(camera);
    worldPlane.material.uniforms.uBlackHoleUv.value.set(
      projectedPosition.x * 0.5 + 0.5,
      projectedPosition.y * 0.5 + 0.5,
    );
  }

  return {
    particles: starField,
    strips: [],
    frames: [],
    portal: disk,
    streaks: [],
    blackHole,
    worldPlane,
    fragments,
    resize,
    setScrollProgress,
    update,
  };
}
