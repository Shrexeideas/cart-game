import * as THREE from 'three';

export interface CartVisualRig {
  root: THREE.Group;
  bodyTiltGroup: THREE.Group;
  leftCasterPivot: THREE.Group;
  rightCasterPivot: THREE.Group;
  wheelMeshes: THREE.Mesh[];
  wheelRadius: number;
  badWheelRing: THREE.Mesh;
  groceryGroup: THREE.Group;
}

export { buildPedestrian, type PedestrianRig } from './pedestrianModel';

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 14, 22, 0.56)');
  grad.addColorStop(0.65, 'rgba(10, 14, 22, 0.24)');
  grad.addColorStop(1, 'rgba(10, 14, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAsphaltTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = '#363c46';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 7200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.7 + Math.random() * 1.9;
    const shade = 44 + Math.floor(Math.random() * 34);
    cCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
    cCtx.fillRect(x, y, r, r);

    const bShade = 94 + Math.floor(Math.random() * 76);
    bCtx.fillStyle = `rgb(${bShade}, ${bShade}, ${bShade})`;
    bCtx.fillRect(x, y, r, r);
  }

  cCtx.strokeStyle = 'rgba(20, 24, 30, 0.35)';
  cCtx.lineWidth = 2;
  cCtx.beginPath();
  cCtx.moveTo(0, 256);
  cCtx.lineTo(size, 256);
  cCtx.stroke();

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(22, 18);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(22, 18);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createStorefrontSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#182235';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 0, 1024, 28);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 228, 1024, 28);

  ctx.font = '900 94px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#facc15';
  ctx.fillText('MEGA MART', 512, 112);

  ctx.font = '700 30px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('SUPERMARKET · PRODUCE · CHAOTIC TROLLEYS', 512, 184);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createParkingBayTexture(
  width: number,
  length: number,
  maxAnisotropy: number,
  requireReverse = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);

  ctx.fillStyle = requireReverse ? 'rgba(249, 115, 22, 0.2)' : 'rgba(34, 197, 94, 0.16)';
  ctx.fillRect(16, 16, 480, 480);

  ctx.strokeStyle = requireReverse ? '#fb923c' : '#facc15';
  ctx.lineWidth = 22;
  ctx.strokeRect(18, 18, 476, 476);

  ctx.strokeStyle = requireReverse ? '#fef08a' : '#4ade80';
  ctx.lineWidth = 10;
  const m = 48;
  const b = 68;
  ctx.beginPath();
  ctx.moveTo(m, m + b); ctx.lineTo(m, m); ctx.lineTo(m + b, m);
  ctx.moveTo(512 - m - b, m); ctx.lineTo(512 - m, m); ctx.lineTo(512 - m, m + b);
  ctx.moveTo(m, 512 - m - b); ctx.lineTo(m, 512 - m); ctx.lineTo(m + b, 512 - m);
  ctx.moveTo(512 - m - b, 512 - m); ctx.lineTo(512 - m, 512 - m); ctx.lineTo(512 - m, 512 - m - b);
  ctx.stroke();

  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(Math.PI / 2);
  ctx.font = '900 66px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = requireReverse ? 'rgba(254, 215, 170, 0.9)' : 'rgba(250, 204, 21, 0.78)';
  ctx.fillText(requireReverse ? 'REV IN' : 'PARK', 0, requireReverse ? -26 : 0);

  if (requireReverse) {
    // Directional arrow pointing along +local Z (exact bay.yaw forward)
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(74, 40);
    ctx.lineTo(24, 14);
    ctx.lineTo(24, 28);
    ctx.lineTo(-68, 28);
    ctx.lineTo(-68, 52);
    ctx.lineTo(24, 52);
    ctx.lineTo(24, 66);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  void width;
  void length;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds a detailed multi-part Shopping Cart with articulated front casters.
 */
export function buildShoppingCart(
  shadowTex: THREE.CanvasTexture,
  accentColor = 0xdc2626,
  isPlayer = true
): CartVisualRig {
  const root = new THREE.Group();

  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18,
  });
  const plasticMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.05,
    roughness: 0.56,
  });
  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.1,
    roughness: 0.85,
  });
  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.7,
    roughness: 0.3,
  });

  const wheelMeshes: THREE.Mesh[] = [];
  const wheelRadius = 0.068;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.036, 16);
  wheelGeo.rotateZ(Math.PI / 2);

  const forkGeo = new THREE.BoxGeometry(0.05, 0.09, 0.06);

  for (const sx of [-0.25, 0.25]) {
    const fork = new THREE.Mesh(forkGeo, chromeMat);
    fork.position.set(sx, 0.11, -0.36);
    fork.castShadow = true;
    root.add(fork);

    const w = new THREE.Mesh(wheelGeo, darkRubberMat);
    w.position.set(sx, wheelRadius, -0.36);
    w.castShadow = true;
    root.add(w);
    wheelMeshes.push(w);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.042, 12), wheelRimMat);
    hub.rotation.z = Math.PI / 2;
    w.add(hub);
  }

  const makeCaster = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, 0.36);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), chromeMat);
    stem.position.set(0, 0.14, 0);
    pivot.add(stem);

    const fork = new THREE.Mesh(forkGeo, chromeMat);
    fork.position.set(0, 0.095, -0.025);
    fork.rotation.x = 0.22;
    fork.castShadow = true;
    pivot.add(fork);

    const wheel = new THREE.Mesh(wheelGeo, darkRubberMat);
    wheel.position.set(0, wheelRadius, -0.035);
    wheel.castShadow = true;
    pivot.add(wheel);
    wheelMeshes.push(wheel);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.042, 12), wheelRimMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);

    root.add(pivot);
    return pivot;
  };

  const leftCasterPivot = makeCaster(-0.23);
  const rightCasterPivot = makeCaster(0.23);

  const badWheelRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.014, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 })
  );
  badWheelRing.rotation.x = Math.PI / 2;
  badWheelRing.position.set(-0.23, 0.03, 0.36);
  badWheelRing.visible = false;
  root.add(badWheelRing);

  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const sideRailGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.86, 10);
  sideRailGeo.rotateX(Math.PI / 2);
  for (const sx of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(sideRailGeo, chromeMat);
    rail.position.set(sx, 0.18, 0);
    rail.castShadow = true;
    bodyTiltGroup.add(rail);
  }
  const crossRear = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 10), chromeMat);
  crossRear.rotation.z = Math.PI / 2;
  crossRear.position.set(0, 0.18, -0.38);
  bodyTiltGroup.add(crossRear);

  for (const sx of [-0.25, 0.25]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.72, 10), chromeMat);
    strut.position.set(sx, 0.51, -0.34);
    strut.rotation.x = -0.22;
    strut.castShadow = true;
    bodyTiltGroup.add(strut);
  }

  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.58, 12),
    plasticMat
  );
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 0.92, -0.45);
  handleBar.castShadow = true;
  bodyTiltGroup.add(handleBar);

  const basketFloor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 0.78), chromeMat);
  basketFloor.position.set(0, 0.42, 0.02);
  basketFloor.castShadow = true;
  bodyTiltGroup.add(basketFloor);

  const rimTopY = 0.84;
  const rimFront = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.035), plasticMat);
  rimFront.position.set(0, rimTopY, 0.44);
  bodyTiltGroup.add(rimFront);

  const rimRear = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.035, 0.035), plasticMat);
  rimRear.position.set(0, rimTopY, -0.34);
  bodyTiltGroup.add(rimRear);

  for (const sx of [-0.25, 0.25]) {
    const rimSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.8), plasticMat);
    rimSide.position.set(sx, rimTopY, 0.05);
    bodyTiltGroup.add(rimSide);

    for (let z = -0.3; z <= 0.4; z += 0.14) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.42, 6), chromeMat);
      rib.position.set(sx, 0.63, z);
      bodyTiltGroup.add(rib);
    }
  }

  for (let x = -0.18; x <= 0.18; x += 0.09) {
    const frontRib = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.42, 6), chromeMat);
    frontRib.position.set(x, 0.63, 0.43);
    bodyTiltGroup.add(frontRib);
  }
  const midBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.018, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.22, wireframe: true })
  );
  midBand.position.set(0, 0.63, 0.05);
  bodyTiltGroup.add(midBand);

  const childSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.03), plasticMat);
  childSeat.position.set(0, 0.69, -0.24);
  childSeat.rotation.x = 0.16;
  bodyTiltGroup.add(childSeat);

  const noseBumper = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.055, 0.055), plasticMat);
  noseBumper.position.set(0, 0.42, 0.43);
  bodyTiltGroup.add(noseBumper);

  const groceryGroup = new THREE.Group();
  if (isPlayer) {
    const cereal = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.22, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 })
    );
    cereal.position.set(-0.11, 0.54, 0.06);
    cereal.rotation.z = 0.12;
    groceryGroup.add(cereal);

    const milk = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
    );
    milk.position.set(0.12, 0.53, 0.14);
    groceryGroup.add(milk);

    const melon = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.62 })
    );
    melon.position.set(0.02, 0.53, -0.06);
    groceryGroup.add(melon);

    const baguette = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.04, 0.28, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
    );
    baguette.position.set(-0.08, 0.62, 0.22);
    baguette.rotation.set(0.5, 0.2, 0.35);
    groceryGroup.add(baguette);
  }
  bodyTiltGroup.add(groceryGroup);

  return {
    root,
    bodyTiltGroup,
    leftCasterPivot,
    rightCasterPivot,
    wheelMeshes,
    wheelRadius,
    badWheelRing,
    groceryGroup,
  };
}

/**
 * Builds a contoured, beveled procedural vehicle (sedan, suv, or hatchback) using ExtrudeGeometry.
 * Local +Z is front headlights, -Z is rear trunk/tailgate, y=0 is ground contact.
 */
export function buildParkedCar(
  shadowTex: THREE.CanvasTexture,
  bodyColor = 0x3b82f6,
  variant: 'sedan' | 'suv' | 'hatchback' = 'sedan'
): THREE.Group {
  const group = new THREE.Group();

  const totalLen = variant === 'suv' ? 4.2 : variant === 'hatchback' ? 3.7 : 4.05;
  const bodyWidth = variant === 'suv' ? 1.84 : 1.72;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyWidth + 0.55, totalLen + 0.55),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.72 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: 0.42,
    roughness: 0.24,
  });
  const cabinGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.75,
    roughness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.15,
    roughness: 0.78,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.88,
    roughness: 0.2,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.88,
  });

  // Side silhouette profile in (z, y) coordinates where +X of Shape becomes +Z after rotation.y = -Math.PI/2
  const shape = new THREE.Shape();
  if (variant === 'suv') {
    shape.moveTo(-2.02, 0.24);
    shape.lineTo(1.98, 0.24);
    shape.lineTo(2.04, 0.58);
    shape.lineTo(1.88, 0.88);
    shape.lineTo(1.12, 0.96); // hood
    shape.lineTo(0.62, 1.54); // windshield
    shape.lineTo(-1.58, 1.54); // long SUV roof
    shape.lineTo(-1.98, 0.98); // tailgate
    shape.lineTo(-2.05, 0.55);
    shape.closePath();
  } else if (variant === 'hatchback') {
    shape.moveTo(-1.76, 0.2);
    shape.lineTo(1.76, 0.2);
    shape.lineTo(1.82, 0.52);
    shape.lineTo(1.68, 0.78);
    shape.lineTo(0.95, 0.86);
    shape.lineTo(0.45, 1.38);
    shape.lineTo(-1.25, 1.38);
    shape.lineTo(-1.74, 0.82);
    shape.closePath();
  } else {
    // Classic sedan 3-box silhouette
    shape.moveTo(-1.95, 0.2);
    shape.lineTo(1.95, 0.2);
    shape.lineTo(2.0, 0.52);
    shape.lineTo(1.86, 0.78);
    shape.lineTo(0.98, 0.86);
    shape.lineTo(0.48, 1.36);
    shape.lineTo(-0.88, 1.36);
    shape.lineTo(-1.42, 0.9);
    shape.lineTo(-1.92, 0.82);
    shape.closePath();
  }

  const extrudeDepth = bodyWidth - 0.14;
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 3,
  });
  bodyGeo.translate(0, 0, -extrudeDepth / 2);
  bodyGeo.rotateY(-Math.PI / 2);

  const hull = new THREE.Mesh(bodyGeo, bodyMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // Sculpted tinted window greenhouse (proud of painted body bevel so side/front/rear glass reads crisply)
  const glassShape = new THREE.Shape();
  if (variant === 'suv') {
    glassShape.moveTo(-1.56, 0.98);
    glassShape.lineTo(1.08, 0.98);
    glassShape.lineTo(0.62, 1.49);
    glassShape.lineTo(-1.5, 1.49);
  } else if (variant === 'hatchback') {
    glassShape.moveTo(-1.42, 0.88);
    glassShape.lineTo(0.92, 0.88);
    glassShape.lineTo(0.46, 1.33);
    glassShape.lineTo(-1.2, 1.33);
  } else {
    glassShape.moveTo(-1.32, 0.9);
    glassShape.lineTo(0.96, 0.9);
    glassShape.lineTo(0.48, 1.32);
    glassShape.lineTo(-0.88, 1.32);
  }
  glassShape.closePath();

  const glassDepth = bodyWidth + 0.02;
  const glassGeo = new THREE.ExtrudeGeometry(glassShape, {
    depth: glassDepth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  glassGeo.translate(0, 0, -glassDepth / 2);
  glassGeo.rotateY(-Math.PI / 2);
  const greenhouse = new THREE.Mesh(glassGeo, cabinGlassMat);
  group.add(greenhouse);

  // Side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.12);
  for (const sx of [-bodyWidth / 2 - 0.07, bodyWidth / 2 + 0.07]) {
    const mirror = new THREE.Mesh(mirrorGeo, bodyMat);
    mirror.position.set(sx, 0.96, 0.62);
    group.add(mirror);
  }

  // Front grille + bumpers + lights (offset outside ExtrudeGeometry bevelThickness 0.07)
  const frontZ = (variant === 'suv' ? 2.02 : variant === 'hatchback' ? 1.78 : 1.97) + 0.07;
  const rearZ = (variant === 'suv' ? -2.02 : variant === 'hatchback' ? -1.75 : -1.94) - 0.07;

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.96, 0.2, 0.16), trimMat);
  frontBumper.position.set(0, 0.32, frontZ);
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.96, 0.2, 0.16), trimMat);
  rearBumper.position.set(0, 0.32, rearZ);
  group.add(rearBumper);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.08), trimMat);
  grille.position.set(0, 0.56, frontZ + 0.03);
  group.add(grille);

  // Headlights & taillights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef08a, emissiveIntensity: 0.55 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.5 });
  for (const sx of [-bodyWidth * 0.34, bodyWidth * 0.34]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.08), headMat);
    hl.position.set(sx, 0.62, frontZ + 0.02);
    group.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tl.position.set(sx, 0.68, rearZ - 0.02);
    group.add(tl);
  }

  // SUV roof rack rails
  if (variant === 'suv') {
    const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8);
    railGeo.rotateX(Math.PI / 2);
    for (const sx of [-0.58, 0.58]) {
      const rail = new THREE.Mesh(railGeo, chromeMat);
      rail.position.set(sx, 1.62, -0.45);
      group.add(rail);
    }
  }

  // 4 tires with rims & lug hub
  const wheelRadius = variant === 'suv' ? 0.36 : 0.31;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.23, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, 0.25, 14);
  rimGeo.rotateZ(Math.PI / 2);
  const wheelX = bodyWidth / 2 - 0.02;
  const wheelbaseZ = variant === 'hatchback' ? 1.12 : 1.28;

  for (const [wx, wz] of [
    [-wheelX, wheelbaseZ],
    [wheelX, wheelbaseZ],
    [-wheelX, -wheelbaseZ],
    [wheelX, -wheelbaseZ],
  ]) {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, wheelRadius, wz);
    tire.castShadow = true;
    group.add(tire);

    const rim = new THREE.Mesh(rimGeo, chromeMat);
    tire.add(rim);
  }

  return group;
}


/**
 * Builds an arched Cart Return Station / Corral with curved canopy & open front entrance.
 */
export function buildCartCorral(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.24 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.35,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });

  // Horizontal side rails + back rail (open on +Z end so carts nest inside)
  for (const sx of [-1.06, 1.06]) {
    for (const ry of [0.3, 0.72]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 3.15, 10), metalMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(sx, ry, 0);
      bar.castShadow = true;
      group.add(bar);
    }
    const cornerGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 10), bumperMat);
    cornerGuard.position.set(sx, 0.425, 1.55);
    group.add(cornerGuard);
  }

  const backBar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 2.12, 10), metalMat);
  backBar.rotation.z = Math.PI / 2;
  backBar.position.set(0, 0.5, -1.55);
  group.add(backBar);

  // Curved arched roof (barrel vault along Z)
  const archGeo = new THREE.CylinderGeometry(1.18, 1.18, 3.25, 16, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
  archGeo.rotateX(Math.PI / 2);
  const archMat = canopyMat.clone();
  archMat.side = THREE.DoubleSide;
  const arch = new THREE.Mesh(archGeo, archMat);
  arch.position.set(0, 1.05, 0);
  arch.castShadow = true;
  group.add(arch);

  for (const [px, pz] of [[-1.06, -1.45], [1.06, -1.45], [-1.06, 0], [1.06, 0], [-1.06, 1.45], [1.06, 1.45]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 10), metalMat);
    post.position.set(px, 0.75, pz);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

export function buildBollard(): THREE.Group {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.14, 0.88, 14),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.2 })
  );
  post.position.y = 0.44;
  post.castShadow = true;
  group.add(post);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.136, 0.136, 0.14, 14),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  );
  stripe.position.y = 0.68;
  group.add(stripe);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
  );
  cap.position.y = 0.88;
  group.add(cap);
  return group;
}

export function buildWheelStop(width: number, height: number, length: number): THREE.Group {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const hl = length / 2;
  shape.moveTo(-hl, 0);
  shape.lineTo(hl, 0);
  shape.lineTo(hl * 0.68, height);
  shape.lineTo(-hl * 0.68, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(Math.PI / 2);

  const concrete = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.86 })
  );
  concrete.castShadow = true;
  concrete.receiveShadow = true;
  group.add(concrete);

  // Safety yellow reflective stripes
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const count = Math.max(2, Math.floor(width / 1.4));
  for (let i = 0; i < count; i++) {
    const sx = -width * 0.35 + (count === 1 ? 0 : (i / (count - 1)) * (width * 0.7));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, height * 0.32, length * 0.72), stripeMat);
    band.position.set(sx, height * 0.92, 0);
    group.add(band);
  }
  return group;
}

export function buildBench(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 });

  for (const lx of [-0.72, 0.72]) {
    const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.56), ironMat);
    legFront.position.set(lx, 0.22, 0);
    legFront.castShadow = true;
    group.add(legFront);

    const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.46), ironMat);
    armRest.position.set(lx, 0.55, 0);
    group.add(armRest);

    const backPost = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.08), ironMat);
    backPost.position.set(lx, 0.66, -0.25);
    backPost.rotation.x = -0.15;
    group.add(backPost);
  }

  for (const sz of [-0.15, 0, 0.15]) {
    const seatSlat = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.05, 0.12), woodMat);
    seatSlat.position.set(0, 0.45, sz);
    seatSlat.castShadow = true;
    group.add(seatSlat);
  }
  for (const by of [0.64, 0.8]) {
    const backSlat = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.11, 0.05), woodMat);
    backSlat.position.set(0, by, -0.25);
    backSlat.rotation.x = -0.15;
    backSlat.castShadow = true;
    group.add(backSlat);
  }
  return group;
}

export function buildTrashBin(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.72, 16), bodyMat);
  body.position.y = 0.36;
  body.castShadow = true;
  group.add(body);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 8, 18), trimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.72;
  group.add(collar);

  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    trimMat
  );
  hood.position.y = 0.73;
  hood.castShadow = true;
  group.add(hood);

  return group;
}

export function buildParkingSign(label = 'P'): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
  );
  base.position.y = 0.07;
  group.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.25, 10), poleMat);
  pole.position.y = 1.125;
  pole.castShadow = true;
  group.add(pole);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = label === 'EXIT' ? '#dc2626' : label === 'CART' ? '#0284c7' : '#1d4ed8';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 112, 112);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${label.length > 1 ? 36 : 72}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plateMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.05), [
    poleMat, poleMat, poleMat, poleMat, plateMat, plateMat,
  ]);
  plate.position.set(0, 2.08, 0);
  plate.castShadow = true;
  group.add(plate);

  return group;
}

export function buildParkingBarrier(width: number): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const footMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });

  for (const sx of [-width * 0.42, width * 0.42]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.42), footMat);
    foot.position.set(sx, 0.04, 0);
    group.add(foot);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.82, 8), metalMat);
    leg.position.set(sx, 0.44, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  // Alternating red/white striped barrier planks
  const segs = 5;
  const segW = width / segs;
  for (let i = 0; i < segs; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(segW, 0.24, 0.08),
      i % 2 === 0 ? redMat : metalMat
    );
    plank.position.set(-width / 2 + segW * (i + 0.5), 0.72, 0);
    plank.castShadow = true;
    group.add(plank);
  }
  return group;
}

export function buildIsland(width: number, length: number): THREE.Group {
  const group = new THREE.Group();
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.84 });
  const mulchMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.94 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.78 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.26, length), curbMat);
  base.position.y = 0.13;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const bed = new THREE.Mesh(new THREE.BoxGeometry(width - 0.36, 0.08, length - 0.36), mulchMat);
  bed.position.y = 0.27;
  bed.receiveShadow = true;
  group.add(bed);

  // Ornamental shrubs & trees along island
  const treeCount = width > 7 ? 2 : 1;
  for (let i = 0; i < treeCount; i++) {
    const tx = treeCount === 1 ? 0 : -width * 0.26 + i * (width * 0.52);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.85, 8), trunkMat);
    trunk.position.set(tx, 1.15, 0);
    trunk.castShadow = true;
    group.add(trunk);

    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.08, 1), leafMat);
    crown.position.set(tx, 2.45, 0);
    crown.castShadow = true;
    group.add(crown);
  }

  for (const sx of [-width * 0.38, 0, width * 0.38]) {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.44, 0), grassMat);
    bush.position.set(sx, 0.52, (sx === 0 ? 0.35 : -0.25));
    bush.castShadow = true;
    group.add(bush);
  }

  return group;
}

export function buildLoadingDock(width: number, length: number): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const dockDoorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.45 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });

  // Raised concrete loading platform
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.9, length), concreteMat);
  deck.position.y = 0.45;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Safety yellow edge strip along front (+Z)
  const hazardEdge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.14, 0.16), yellowMat);
  hazardEdge.position.set(0, 0.86, length / 2);
  group.add(hazardEdge);

  // Rear warehouse wall with 2 corrugated roll-up doors
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, 3.6, 1.2), dockDoorMat);
  backWall.position.set(0, 2.4, -length / 2 + 0.5);
  backWall.castShadow = true;
  group.add(backWall);

  for (const dx of [-width * 0.24, width * 0.24]) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.4, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.4, roughness: 0.5 })
    );
    door.position.set(dx, 2.1, -length / 2 + 1.15);
    group.add(door);
  }

  // Stacked produce crates on the dock
  for (const [cx, cz, s] of [[-2.2, 0.6, 0.65], [-1.4, 0.8, 0.52], [2.4, 0.4, 0.72]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    crate.position.set(cx, 0.9 + s / 2, cz);
    crate.castShadow = true;
    group.add(crate);
  }

  return group;
}

/**
 * Builds the expanded 68m x 44m Mega Mart complex backdrop, sidewalks, parking rows,
 * intersections, crosswalks, directional arrows, perimeter fencing, and street lighting.
 */
export function buildSupermarketBackdrop(
  maxAnisotropy: number,
  sharedShadowTex?: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.82 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.28,
    metalness: 0.5,
    roughness: 0.12,
  });

  // Full 68m wide sidewalk apron in front of store
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(68, 0.18, 6.4),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.88 })
  );
  sidewalk.position.set(0, 0.09, -7.2);
  sidewalk.receiveShadow = true;
  group.add(sidewalk);

  // Yellow safety curb border along sidewalk edge
  const sidewalkCurb = new THREE.Mesh(
    new THREE.BoxGeometry(68, 0.18, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })
  );
  sidewalkCurb.position.set(0, 0.095, -4.05);
  group.add(sidewalkCurb);

  // Main building facade (expanded 54m wide)
  const building = new THREE.Mesh(new THREE.BoxGeometry(52, 8.6, 10.5), wallMat);
  building.position.set(2, 4.3, -15.2);
  building.receiveShadow = true;
  building.castShadow = true;
  group.add(building);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(52.8, 0.72, 11.1), roofTrimMat);
  cornice.position.set(2, 8.75, -15.2);
  group.add(cornice);

  // Architectural facade pilasters
  for (let px = -22; px <= 26; px += 6) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.65, 8.4, 0.35), trimMat);
    pilaster.position.set(px, 4.2, -9.95);
    group.add(pilaster);
  }

  // Mega Mart Sign
  const signTex = createStorefrontSignTexture(maxAnisotropy);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(16.5, 3.3, 0.42),
    [
      trimMat, trimMat, trimMat, trimMat,
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.32 }),
      trimMat,
    ]
  );
  signBoard.position.set(0, 6.2, -9.72);
  group.add(signBoard);

  // Striped canopy awning over entrance
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(17.5, 0.32, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
  );
  awning.position.set(0, 3.55, -8.85);
  awning.rotation.x = 0.18;
  awning.castShadow = true;
  group.add(awning);

  // Sliding glass entrance doors + display windows across storefront
  const doors = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.9, 0.25), glassMat);
  doors.position.set(0, 1.55, -9.9);
  group.add(doors);

  for (const wx of [-18, -12, -7.2, 7.2, 12, 18, 23.5]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.4, 0.22), glassMat);
    win.position.set(wx, 2.1, -9.9);
    group.add(win);
  }

  // Perimeter planter trees & light poles across the 68m lot
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.3 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfde047, emissiveIntensity: 0.9 });

  for (const tx of [-17.5, -13.5, 13.5, 17.5]) {
    const tree = new THREE.Group();
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.8), trimMat);
    planter.position.y = 0.175;
    tree.add(planter);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.9, 8), trunkMat);
    trunk.position.y = 1.15;
    trunk.castShadow = true;
    tree.add(trunk);

    const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), leafMat);
    crown1.position.y = 2.6;
    crown1.castShadow = true;
    tree.add(crown1);

    const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 1), leafMat);
    crown2.position.set(0.45, 2.15, 0.35);
    tree.add(crown2);

    tree.position.set(tx, 0, -5.8);
    group.add(tree);
  }

  // Streetlights distributed across North & South aisles
  for (const [lx, lz] of [[-20, -4.6], [-10, -4.6], [10, -4.6], [20, -4.6], [-14.5, 7.4], [14.5, 7.4], [-13.5, 18.8], [13.5, 18.8]]) {
    const poleGroup = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.4, 10), poleMat);
    pole.position.y = 2.7;
    pole.castShadow = true;
    poleGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.1), poleMat);
    arm.position.set(0, 5.35, 0.45);
    poleGroup.add(arm);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.26), lampMat);
    lamp.position.set(0, 5.26, 0.9);
    poleGroup.add(lamp);

    poleGroup.position.set(lx, 0, lz);
    group.add(poleGroup);
  }

  // Parking Attendant Booth
  const booth = new THREE.Group();
  const boothBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.35, 2.0),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 })
  );
  boothBody.position.y = 1.175;
  boothBody.castShadow = true;
  booth.add(boothBody);

  const boothRoof = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.25, 2.4),
    roofTrimMat
  );
  boothRoof.position.y = 2.46;
  boothRoof.castShadow = true;
  booth.add(boothRoof);

  const boothWindow = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.9, 2.06),
    glassMat
  );
  boothWindow.position.y = 1.5;
  booth.add(boothWindow);
  booth.position.set(-14.2, 0, -7.8);
  group.add(booth);

  // Sidewalk Shopping Cart Station + nested carts
  const station = buildCartCorral();
  station.position.set(13.8, 0.18, -7.2);
  station.rotation.y = Math.PI / 2;
  group.add(station);

  const stationShadow = sharedShadowTex ?? createRadialShadowTexture();
  for (let i = 0; i < 4; i++) {
    const parked = buildShoppingCart(stationShadow, i % 2 === 0 ? 0xdc2626 : 0x2563eb, false);
    parked.root.position.set(12.8 + i * 0.52, 0.18, -7.2);
    parked.root.rotation.y = Math.PI / 2;
    group.add(parked.root);
  }

  // Perimeter curb fencing around West, East, and South edges of the 68m x 44m lot
  const perimeterCurbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const westBorder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 42), perimeterCurbMat);
  westBorder.position.set(-33.6, 0.17, 10);
  group.add(westBorder);

  const eastBorder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 42), perimeterCurbMat);
  eastBorder.position.set(33.6, 0.17, 10);
  group.add(eastBorder);

  const southBorder = new THREE.Mesh(new THREE.BoxGeometry(68, 0.34, 0.8), perimeterCurbMat);
  southBorder.position.set(0, 0.17, 29.6);
  group.add(southBorder);

  // Painted Zebra Crosswalks (Storefront Center + Middle Hub + South Boulevard)
  const crosswalkMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  for (const cz of [-4.45, 7.4, 18.8]) {
    const centerX = cz < 0 ? 0 : -6.8;
    for (let cx = centerX - 3.6; cx <= centerX + 3.6; cx += 0.9) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 1.8), crosswalkMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(cx, 0.024, cz);
      group.add(bar);
    }
  }

  // East-West Boulevard Dashed Lane Lines & Directional Arrows
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  for (const laneZ of [1.8, 13.4, 24.4]) {
    for (let x = -28; x <= 28; x += 3.6) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.14), arrowMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, laneZ);
      group.add(dash);
    }

    for (const [ax, rot] of [[-18, Math.PI / 2], [0, Math.PI / 2], [18, -Math.PI / 2]] as const) {
      const arrowGroup = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 1.1), arrowMat);
      shaft.rotation.x = -Math.PI / 2;
      arrowGroup.add(shaft);

      const head = new THREE.Mesh(new THREE.CircleGeometry(0.38, 3), arrowMat);
      head.rotation.x = -Math.PI / 2;
      head.position.z = -0.68;
      arrowGroup.add(head);

      arrowGroup.position.set(ax, 0.024, laneZ + 0.9);
      arrowGroup.rotation.y = rot;
      group.add(arrowGroup);
    }
  }

  // Painted parking stall lines along South Perimeter & Outer Wings
  for (let px = -30; px <= 30; px += 3.2) {
    if (Math.abs(px) < 4) continue;
    const stallLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 3.6), crosswalkMat);
    stallLine.rotation.x = -Math.PI / 2;
    stallLine.position.set(px, 0.02, 22.0);
    group.add(stallLine);
  }

  return group;
}
