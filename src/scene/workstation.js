import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from 'three';

const metal = new MeshStandardMaterial({ color: 0x18232f, metalness: 0.86, roughness: 0.28 });
const darkMetal = new MeshStandardMaterial({ color: 0x0b1118, metalness: 0.74, roughness: 0.35 });
const boardMaterial = new MeshStandardMaterial({ color: 0x10232b, metalness: 0.54, roughness: 0.45 });
const glassMaterial = new MeshPhysicalMaterial({
  color: 0x9bdcff,
  metalness: 0.35,
  roughness: 0.12,
  transparent: true,
  opacity: 0.16,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  side: 2,
  depthWrite: false,
});
const blueGlow = new MeshStandardMaterial({ color: 0x1786ed, emissive: 0x147eff, emissiveIntensity: 1.75, metalness: 0.36, roughness: 0.24 });
const cyanGlow = new MeshStandardMaterial({ color: 0x36dce3, emissive: 0x13b9d1, emissiveIntensity: 1.65, metalness: 0.24, roughness: 0.2 });
const orangeGlow = new MeshStandardMaterial({ color: 0xf29a61, emissive: 0xbd4d13, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.28 });

function addBox(parent, size, material, position, rotation = [0, 0, 0]) {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addFan(parent, radius, material) {
  const rotor = new Group();
  const rim = new Mesh(new TorusGeometry(radius, 0.035, 8, 36), material);
  rotor.add(rim);
  const hub = new Mesh(new CylinderGeometry(radius * 0.15, radius * 0.15, 0.1, 16), metal);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  for (let bladeIndex = 0; bladeIndex < 7; bladeIndex += 1) {
    const angle = (bladeIndex / 7) * Math.PI * 2;
    const blade = addBox(rotor, [radius * 0.52, 0.045, 0.035], material, [Math.cos(angle) * radius * 0.46, Math.sin(angle) * radius * 0.46, 0]);
    blade.rotation.z = angle + 0.24;
  }
  parent.add(rotor);
  return rotor;
}

function addCable(parent, points, material) {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
  const cable = new Mesh(new TubeGeometry(curve, 28, 0.025, 5, false), material);
  parent.add(cable);
  return cable;
}

function tagComponent(object, component) {
  object.userData.component = component;
  object.traverse((child) => { child.userData.componentId = component.id; });
  return { ...component, object };
}

export function createWorkstation(scene) {
  const rig = new Group();
  rig.scale.setScalar(0.82);
  scene.add(rig);

  const shell = new Group();
  rig.add(shell);
  // Open-frame aluminum chassis and dark rear panel.
  addBox(shell, [2.92, 0.11, 1.78], metal, [0, 2.04, 0]);
  addBox(shell, [2.92, 0.11, 1.78], metal, [0, -2.04, 0]);
  addBox(shell, [0.11, 4.0, 1.78], metal, [-1.4, 0, 0]);
  addBox(shell, [0.11, 4.0, 1.78], metal, [1.4, 0, 0]);
  addBox(shell, [2.8, 3.9, 0.09], darkMetal, [0, 0, -0.84]);
  addBox(shell, [0.1, 4.0, 0.1], blueGlow, [-1.42, 0, 0.89]);
  addBox(shell, [0.1, 4.0, 0.1], cyanGlow, [1.42, 0, 0.89]);
  addBox(shell, [2.84, 0.08, 0.1], metal, [0, 2.02, 0.89]);
  addBox(shell, [2.84, 0.08, 0.1], metal, [0, -2.02, 0.89]);

  const glass = new Group();
  rig.add(glass);
  const frontGlass = new Mesh(new PlaneGeometry(2.78, 3.82), glassMaterial);
  frontGlass.position.set(0, 0, 0.91);
  frontGlass.raycast = () => {};
  glass.add(frontGlass);
  const glassEdge = new MeshBasicMaterial({ color: 0x8dd9ff, transparent: true, opacity: 0.48 });
  addBox(glass, [0.018, 3.8, 0.018], glassEdge, [-1.385, 0, 0.925]);
  addBox(glass, [0.018, 3.8, 0.018], glassEdge, [1.385, 0, 0.925]);
  addBox(glass, [2.78, 0.018, 0.018], glassEdge, [0, 1.9, 0.925]);
  addBox(glass, [2.78, 0.018, 0.018], glassEdge, [0, -1.9, 0.925]);
  const sideGlass = new Mesh(new PlaneGeometry(1.7, 3.8), glassMaterial);
  sideGlass.rotation.y = Math.PI / 2;
  sideGlass.position.set(1.41, 0, 0);
  sideGlass.raycast = () => {};
  glass.add(sideGlass);

  const motherboard = new Group();
  rig.add(motherboard);
  addBox(motherboard, [2.45, 3.52, 0.075], boardMaterial, [-0.08, 0, 0.15]);
  for (let index = 0; index < 14; index += 1) {
    const trace = addBox(motherboard, [0.014, 0.42 + (index % 3) * 0.12, 0.018], index % 4 === 0 ? cyanGlow : metal, [-1.08 + (index % 5) * 0.47, -1.35 + Math.floor(index / 5) * 0.9, 0.2]);
    trace.rotation.z = (index % 2 ? 1 : -1) * 0.48;
  }
  for (let index = 0; index < 9; index += 1) {
    const chip = addBox(motherboard, [0.13 + (index % 3) * 0.04, 0.12, 0.04], darkMetal, [-1.05 + (index % 3) * 0.94, -1.45 + Math.floor(index / 3) * 0.47, 0.24]);
    chip.rotation.z = index % 2 ? 0.12 : -0.1;
  }

  const gpu = new Group();
  gpu.position.set(0.02, -0.64, 0.47);
  rig.add(gpu);
  addBox(gpu, [2.35, 0.62, 0.34], darkMetal, [0, 0, 0]);
  addBox(gpu, [2.25, 0.08, 0.36], blueGlow, [0, 0.28, 0]);
  addBox(gpu, [0.11, 0.68, 0.04], metal, [-1.16, 0, 0.2]);
  const gpuFans = [-0.69, 0, 0.69].map((x) => {
    const fan = addFan(gpu, 0.22, x === 0 ? cyanGlow : blueGlow);
    fan.position.set(x, -0.01, 0.205);
    return fan;
  });
  const gpuLogo = new Mesh(new BoxGeometry(0.47, 0.04, 0.02), cyanGlow);
  gpuLogo.position.set(0.56, 0.16, 0.2);
  gpu.add(gpuLogo);

  const cpuCooler = new Group();
  cpuCooler.position.set(0.05, 1.12, 0.46);
  rig.add(cpuCooler);
  addBox(cpuCooler, [1.18, 0.73, 0.34], metal, [0, 0, 0]);
  addBox(cpuCooler, [0.56, 0.53, 0.12], darkMetal, [-0.38, 0, 0.21]);
  const coolerFan = addFan(cpuCooler, 0.25, cyanGlow);
  coolerFan.position.set(-0.38, 0, 0.3);
  addBox(cpuCooler, [0.12, 0.5, 0.12], blueGlow, [0.43, 0, 0.23]);

  const ram = new Group();
  rig.add(ram);
  for (let index = 0; index < 2; index += 1) {
    const stick = new Group();
    stick.position.set(0.98 + index * 0.22, 0.34 + index * 0.48, 0.48);
    ram.add(stick);
    addBox(stick, [0.11, 0.86, 0.1], darkMetal, [0, 0, 0]);
    addBox(stick, [0.055, 0.7, 0.025], index ? blueGlow : cyanGlow, [0, 0, 0.065]);
    for (let pin = 0; pin < 8; pin += 1) addBox(stick, [0.045, 0.025, 0.018], metal, [0, -0.34 + pin * 0.095, 0.067]);
  }

  const psu = new Group();
  psu.position.set(-0.05, -1.57, 0.3);
  rig.add(psu);
  addBox(psu, [2.22, 0.62, 0.58], darkMetal, [0, 0, 0]);
  addBox(psu, [1.82, 0.04, 0.02], blueGlow, [0, 0.24, 0.3]);
  for (let index = 0; index < 6; index += 1) addBox(psu, [0.035, 0.34, 0.02], metal, [-0.76 + index * 0.1, 0, 0.3]);

  const radiator = new Group();
  radiator.position.set(0.08, 1.68, 0.42);
  rig.add(radiator);
  addBox(radiator, [2.28, 0.17, 0.44], darkMetal, [0, 0, -0.08]);
  for (let fin = 0; fin < 16; fin += 1) {
    addBox(radiator, [0.025, 0.13, 0.38], fin % 4 === 0 ? cyanGlow : metal, [-1.04 + fin * 0.139, 0, -0.07]);
  }
  const radiatorFans = [-0.57, 0.57].map((x) => {
    const fan = addFan(radiator, 0.21, cyanGlow);
    fan.position.set(x, 0, 0.18);
    return fan;
  });

  const storage = new Group();
  storage.position.set(0.78, -1.22, -0.27);
  rig.add(storage);
  addBox(storage, [0.58, 0.34, 0.1], darkMetal, [0, 0, 0]);
  addBox(storage, [0.44, 0.035, 0.015], cyanGlow, [0, 0.1, 0.06]);
  addBox(storage, [0.43, 0.035, 0.015], blueGlow, [0, -0.1, 0.06]);
  addBox(storage, [0.07, 0.035, 0.018], orangeGlow, [0.19, 0, 0.062]);

  const frontFans = new Group();
  rig.add(frontFans);
  const caseFans = [-1.22, 0, 1.22].map((y, index) => {
    const fanGroup = new Group();
    fanGroup.position.set(-0.92, y, 0.58);
    frontFans.add(fanGroup);
    const rotor = addFan(fanGroup, 0.37, index === 1 ? cyanGlow : blueGlow);
    rotor.position.z = 0.035;
    return rotor;
  });

  const cables = new Group();
  rig.add(cables);
  addCable(cables, [[1.05, -0.76, 0.35], [1.22, -0.92, 0.1], [1.05, -1.26, 0.22], [0.68, -1.48, 0.34]], blueGlow);
  addCable(cables, [[0.74, 1.06, 0.34], [1.02, 0.96, 0.13], [1.05, 0.69, 0.2], [0.82, 0.38, 0.35]], orangeGlow);

  const components = [
    { object: shell, id: 'chassis', name: 'Aluminum chassis', role: 'CASE', description: 'The rigid frame protects and supports every internal component.', delta: [0, 0, 0], rotate: [0, 0, 0] },
    { object: glass, id: 'tempered-glass', name: 'Tempered-glass panel', role: 'CASE PANEL', description: 'A clear side panel reveals the internal workstation while shielding the components.', delta: [0.85, 0.12, 1.1], rotate: [0.08, -0.44, 0.03] },
    { object: gpu, id: 'gpu', name: 'Graphics card', role: 'GPU', description: 'Handles graphics rendering, visual effects and GPU-accelerated creative work.', delta: [-1.22, -0.28, 1.15], rotate: [0.14, 0.34, -0.1] },
    { object: cpuCooler, id: 'cpu-cooling', name: 'CPU cooling system', role: 'CPU COOLER', description: 'Moves heat away from the processor to keep demanding editing sessions stable.', delta: [0.8, 1.08, 0.6], rotate: [-0.12, -0.3, 0.12] },
    { object: ram, id: 'ram', name: 'Memory modules', role: 'RAM', description: 'Provides fast temporary memory for active applications and complex timelines.', delta: [1.14, 0.55, -0.3], rotate: [0.08, 0.22, 0.1] },
    { object: psu, id: 'power-supply', name: 'Power supply', role: 'PSU', description: 'Converts and distributes stable power to the workstation components.', delta: [-0.8, -1.18, 0.45], rotate: [0.12, -0.25, -0.1] },
    { object: frontFans, id: 'case-fans', name: 'Case cooling fans', role: 'AIRFLOW', description: 'Moves cool air through the chassis and carries warm air away from the system.', delta: [-1.42, 0.1, 1.45], rotate: [0.2, -0.28, 0.08] },
    { object: motherboard, id: 'motherboard', name: 'Motherboard', role: 'MAIN BOARD', description: 'The main circuit board connecting the processor, memory, graphics and storage.', delta: [0.16, 0.05, -1.05], rotate: [0.08, 0.25, -0.04] },
    { object: cables, id: 'cables', name: 'Internal cabling', role: 'CABLE ROUTING', description: 'Routes power and data cleanly between the workstation components.', delta: [0.6, -0.25, 0.9], rotate: [-0.12, 0.28, 0.2] },
    { object: radiator, id: 'radiator', name: 'Liquid cooling radiator', role: 'RADIATOR', description: 'Dissipates heat from the liquid cooling loop through a finned radiator and fans.', delta: [0.75, 1.65, 0.85], rotate: [-0.15, -0.2, 0.18] },
    { object: storage, id: 'storage', name: 'Solid-state storage', role: 'NVME STORAGE', description: 'Stores project files and provides fast access to active footage and applications.', delta: [1.5, -1.15, -0.15], rotate: [0.12, 0.26, -0.1] },
  ].map((part) => {
    const component = tagComponent(part.object, { id: part.id, name: part.name, role: part.role, description: part.description });
    return {
      ...part,
      ...component,
      origin: part.object.position.clone(),
      originRotation: part.object.rotation.clone(),
    };
  });

  return {
    rig,
    components,
    fans: [...gpuFans, coolerFan, ...caseFans, ...radiatorFans],
    rgbMaterials: [blueGlow, cyanGlow, orangeGlow],
    shell,
  };
}

export function createExternalSetup(scene) {
  const setup = new Group();
  const ownedMaterials = [];
  scene.add(setup);

  const desk = new Group();
  setup.add(desk);
  const deskGlass = new MeshPhysicalMaterial({ color: 0x142431, metalness: 0.58, roughness: 0.24, transparent: true, opacity: 0.78, clearcoat: 0.9, clearcoatRoughness: 0.16 });
    ownedMaterials.push(deskGlass);
  addBox(desk, [8.8, 0.16, 2.8], deskGlass, [0, -2.3, 0]);
  for (const x of [-3.75, 3.75]) {
    addBox(desk, [0.16, 2.0, 0.16], metal, [x, -3.3, -0.85]);
    addBox(desk, [0.16, 2.0, 0.16], metal, [x, -3.3, 0.85]);
  }
  addBox(desk, [8.0, 0.035, 0.025], cyanGlow, [0, -2.205, -1.2]);

  const monitor = new Group();
  setup.add(monitor);
  monitor.position.set(-2.2, 0.12, -0.62);
  addBox(monitor, [3.25, 2.14, 0.15], metal, [0, 0, 0]);
  const displayMaterial = new MeshBasicMaterial({ color: 0x07121b });
  ownedMaterials.push(displayMaterial);
  const display = new Mesh(new PlaneGeometry(3.05, 1.94), displayMaterial);
  display.position.z = 0.081;
  monitor.add(display);
  addBox(monitor, [2.8, 0.018, 0.014], cyanGlow, [0, 0.5, 0.092]);
  addBox(monitor, [1.9, 0.018, 0.014], blueGlow, [-0.44, 0.4, 0.092]);
  for (let index = 0; index < 7; index += 1) {
    addBox(monitor, [0.19 + (index % 3) * 0.08, 0.18, 0.018], index % 4 === 0 ? orangeGlow : blueGlow, [-1.22 + index * 0.39, -0.08 + (index % 2) * 0.18, 0.094]);
  }
  for (let index = 0; index < 10; index += 1) {
    addBox(monitor, [0.028, 0.16 + (index % 4) * 0.035, 0.015], cyanGlow, [-1.32 + index * 0.29, -0.64, 0.095]);
  }
  addBox(monitor, [0.17, 0.96, 0.18], metal, [0, -1.54, -0.04]);
  addBox(monitor, [1.05, 0.09, 0.6], darkMetal, [0, -2.05, -0.02]);
  addBox(monitor, [0.82, 0.025, 0.035], cyanGlow, [0, -2.0, 0.26]);

  const keyboard = new Group();
  setup.add(keyboard);
  keyboard.position.set(-1.72, -2.18, 0.78);
  addBox(keyboard, [2.55, 0.12, 0.76], darkMetal, [0, 0, 0]);
  const keyGeometry = new BoxGeometry(0.13, 0.035, 0.09);
  const keys = new InstancedMesh(keyGeometry, metal, 60);
  const keyTransform = new Object3D();
  let keyIndex = 0;
  for (let row = 0; row < 5; row += 1) {
    const columns = row === 4 ? 8 : 13;
    for (let column = 0; column < columns; column += 1) {
      keyTransform.position.set(-0.88 + column * 0.145, 0.084, -0.27 + row * 0.13);
      keyTransform.scale.set(column === 4 && row === 4 ? 1.7 : 1, 1, 1);
      keyTransform.updateMatrix();
      keys.setMatrixAt(keyIndex, keyTransform.matrix);
      keyIndex += 1;
    }
  }
  keys.instanceMatrix.needsUpdate = true;
  keyboard.add(keys);
  addBox(keyboard, [0.24, 0.025, 0.025], cyanGlow, [0, 0.09, 0.32]);

  const mouse = new Group();
  setup.add(mouse);
  mouse.position.set(-0.1, -2.13, 0.82);
  const mouseShell = new Mesh(new SphereGeometry(0.22, 20, 14), metal);
  mouseShell.scale.set(0.76, 0.65, 1.35);
  mouse.add(mouseShell);
  addBox(mouse, [0.012, 0.11, 0.012], cyanGlow, [0, 0.12, 0.22]);
  addBox(mouse, [0.12, 0.02, 0.04], darkMetal, [0, 0.2, 0.16]);

  const componentDefinitions = [
    [desk, 'desk', 'Glass workstation desk', 'DESK', 'A tempered-glass work surface supports the complete editing setup.'],
    [monitor, 'monitor', 'Editing monitor', 'DISPLAY', 'The large display is the visual workspace for footage, timelines and previews.'],
    [keyboard, 'keyboard', 'Mechanical keyboard', 'INPUT', 'A tactile keyboard for editing shortcuts and precise timeline control.'],
    [mouse, 'mouse', 'Precision mouse', 'POINTER', 'A precision mouse for accurate navigation and detailed editing work.'],
  ];
  const components = componentDefinitions.map(([object, id, name, role, description]) => {
    const component = tagComponent(object, { id, name, role, description });
    return { ...component, external: true };
  });

  return { root: setup, components, ownedMaterials };
}
