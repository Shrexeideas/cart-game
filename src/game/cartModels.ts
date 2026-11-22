import * as THREE from 'three';
import { getCartDefinition } from './carts';
import type { CartVisualRig } from './models';
import type { CartAccessory, CartId, CosmeticLoadout, WheelStyle } from './types';

function createWheelMesh(
  style: WheelStyle,
  radius: number,
  width: number,
  rustMode = false
): THREE.Mesh {
  const tireMat = new THREE.MeshStandardMaterial({
    color:
      style === 'sport'
        ? 0x0f172a
        : style === 'offroad'
          ? 0x1c1917
          : rustMode
            ? 0x57534e
            : 0x1e293b,
    roughness: style === 'sport' ? 0.52 : 0.9,
    metalness: 0.08,
  });

  const rimColor =
    style === 'gold'
      ? 0xfacc15
      : style === 'sport'
        ? 0xef4444
        : style === 'offroad'
          ? 0x94a3b8
          : rustMode
            ? 0x9a3412
            : 0xcbd5e1;

  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    metalness: style === 'gold' ? 0.95 : 0.72,
    roughness: style === 'gold' ? 0.16 : rustMode ? 0.85 : 0.28,
  });

  const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Mesh(wheelGeo, tireMat);
  wheel.castShadow = true;

  const hubGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.008, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  wheel.add(hub);

  if (style === 'offroad') {
    // Chunky tread lugs around tire
    const lugGeo = new THREE.BoxGeometry(width + 0.004, radius * 0.3, 0.028);
    for (let i = 0; i < 6; i++) {
      const lug = new THREE.Mesh(lugGeo, tireMat);
      const a = (i / 6) * Math.PI * 2;
      lug.position.set(0, Math.cos(a) * radius * 0.92, Math.sin(a) * radius * 0.92);
      lug.rotation.x = a;
      wheel.add(lug);
    }
  }

  return wheel;
}

function attachAccessory(
  bodyTiltGroup: THREE.Group,
  accessory: CartAccessory,
  accentMat: THREE.Material,
  chromeMat: THREE.Material,
  topY: number,
  rearZ: number
): void {
  if (accessory === 'none') return;

  if (accessory === 'spoiler') {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 });
    for (const sx of [-0.19, 0.19]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.06), chromeMat);
      strut.position.set(sx, topY + 0.08, rearZ + 0.02);
      bodyTiltGroup.add(strut);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.035, 0.18), wingMat);
    wing.position.set(0, topY + 0.17, rearZ - 0.01);
    wing.rotation.x = -0.18;
    wing.castShadow = true;
    bodyTiltGroup.add(wing);
    return;
  }

  if (accessory === 'flag') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.65, 8), chromeMat);
    pole.position.set(-0.24, topY + 0.32, rearZ + 0.04);
    bodyTiltGroup.add(pole);

    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.24, 3),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    pennant.rotation.z = -Math.PI / 2;
    pennant.position.set(-0.12, topY + 0.56, rearZ + 0.04);
    bodyTiltGroup.add(pennant);
    return;
  }

  if (accessory === 'horn') {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.45 })
    );
    bulb.position.set(0.22, topY + 0.12, rearZ - 0.06);
    bodyTiltGroup.add(bulb);
    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
    );
    bell.rotation.x = Math.PI / 2;
    bell.position.set(0.22, topY + 0.12, rearZ + 0.02);
    bodyTiltGroup.add(bell);
    return;
  }

  if (accessory === 'umbrella') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.82, 8), chromeMat);
    pole.position.set(0.18, topY + 0.38, rearZ + 0.08);
    bodyTiltGroup.add(pole);

    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.18, 8),
      accentMat
    );
    canopy.position.set(0.18, topY + 0.78, rearZ + 0.08);
    canopy.castShadow = true;
    bodyTiltGroup.add(canopy);
  }
}

export function buildCustomShoppingCart(
  cartId: CartId,
  shadowTex: THREE.CanvasTexture,
  cosmetics?: Partial<CosmeticLoadout>
): CartVisualRig {
  const def = getCartDefinition(cartId);
  const accentHex = cosmetics?.accentColor ?? def.primaryColor;
  const wheelStyle: WheelStyle = cosmetics?.wheelStyle ?? def.defaultWheelStyle;
  const accessory: CartAccessory = cosmetics?.accessory ?? 'none';

  const root = new THREE.Group();

  // Ground shadow scaled to footprint
  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(0.5, def.physics.footprintL * 0.62), 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  const isRust = cartId === 'rust_bucket';
  const isGold = cartId === 'golden';
  const isLuxury = cartId === 'luxury';
  const isMonster = cartId === 'monster';
  const isHeavy = cartId === 'heavy_duty';
  const isTiny = cartId === 'tiny_trolley';
  const isSpeed = cartId === 'speed_demon';
  const isWobbly = cartId === 'wobbly_wheels';
  const isBasket = cartId === 'basket_cart';

  const frameMat = new THREE.MeshStandardMaterial({
    color: def.frameColor,
    metalness: isRust ? 0.32 : isGold ? 0.96 : isLuxury ? 0.88 : 0.84,
    roughness: isRust ? 0.88 : isGold ? 0.14 : isSpeed ? 0.35 : 0.22,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: isGold ? 0.92 : isLuxury ? 0.25 : 0.08,
    roughness: isGold ? 0.18 : isRust ? 0.85 : 0.45,
  });

  const wheelMeshes: THREE.Mesh[] = [];

  // Wheel dimensions per cart archetype
  const wheelRadius = isMonster ? 0.145 : isHeavy ? 0.092 : isTiny ? 0.052 : 0.068;
  const wheelWidth = isMonster ? 0.085 : isHeavy ? 0.052 : isTiny ? 0.028 : 0.036;
  const axleHalfW = isMonster ? 0.34 : isHeavy ? 0.32 : isTiny ? 0.19 : isBasket ? 0.21 : 0.25;
  const rearZ = isTiny ? -0.26 : isBasket ? -0.3 : isHeavy ? -0.44 : -0.36;
  const frontZ = isTiny ? 0.26 : isBasket ? 0.3 : isHeavy ? 0.44 : 0.36;

  // Rear fixed wheels
  const forkHeight = isMonster ? 0.2 : 0.1;
  for (const [idx, sx] of [-axleHalfW, axleHalfW].entries()) {
    const fork = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, forkHeight, 0.06),
      frameMat
    );
    fork.position.set(sx, wheelRadius + forkHeight * 0.4, rearZ);
    if (isWobbly && idx === 0) fork.rotation.z = 0.14;
    fork.castShadow = true;
    root.add(fork);

    const wRadius = isWobbly && idx === 1 ? wheelRadius * 0.82 : wheelRadius;
    const w = createWheelMesh(wheelStyle, wRadius, wheelWidth, isRust);
    w.position.set(sx, wRadius, rearZ);
    root.add(w);
    wheelMeshes.push(w);
  }

  // Front swivel casters
  const makeCaster = (x: number, isBadSlot: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, frontZ);

    const r = isWobbly && isBadSlot ? wheelRadius * 0.78 : wheelRadius;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 10), frameMat);
    stem.position.set(0, r * 2 + 0.04, 0);
    pivot.add(stem);

    const fork = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, forkHeight * 0.9, 0.055),
      frameMat
    );
    fork.position.set(0, r + forkHeight * 0.32, -0.025);
    fork.rotation.x = 0.22;
    if (isWobbly && isBadSlot) fork.rotation.z = -0.2;
    fork.castShadow = true;
    pivot.add(fork);

    const w = createWheelMesh(
      isWobbly && isBadSlot ? 'standard' : wheelStyle,
      r,
      wheelWidth,
      isRust
    );
    w.position.set(0, r, -0.035);
    pivot.add(w);
    wheelMeshes.push(w);

    root.add(pivot);
    return pivot;
  };

  const leftCasterPivot = makeCaster(-axleHalfW * 0.92, true);
  const rightCasterPivot = makeCaster(axleHalfW * 0.92, false);

  const badWheelRing = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius + 0.04, 0.014, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 })
  );
  badWheelRing.rotation.x = Math.PI / 2;
  badWheelRing.position.set(-axleHalfW * 0.92, 0.03, frontZ);
  badWheelRing.visible = false;
  root.add(badWheelRing);

  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const deckY = isMonster ? 0.38 : isHeavy ? 0.24 : isTiny ? 0.15 : 0.19;
  const sideRailLen = frontZ - rearZ + 0.12;

  // Lower Chassis Rails
  for (const sx of [-axleHalfW, axleHalfW]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, sideRailLen, 10),
      frameMat
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.set(sx, deckY, (frontZ + rearZ) / 2);
    rail.castShadow = true;
    bodyTiltGroup.add(rail);
  }

  // Unique Upper Body Silhouette per Cart Model
  let topRimY = 0.84;
  let handleZ = rearZ - 0.1;

  if (isHeavy) {
    // Flatbed Heavy Duty Warehouse Cart
    topRimY = 0.56;
    handleZ = rearZ - 0.04;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.12), accentMat);
    deck.position.set(0, deckY + 0.04, 0);
    deck.castShadow = true;
    bodyTiltGroup.add(deck);

    // Tall rear steel push cage + lumber cargo box
    for (const sx of [-0.31, 0.31]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.78, 10), frameMat);
      post.position.set(sx, deckY + 0.42, rearZ);
      post.castShadow = true;
      bodyTiltGroup.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.68, 12), accentMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, deckY + 0.78, rearZ);
    bodyTiltGroup.add(bar);

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.28, 0.64),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.88 })
    );
    crate.position.set(0, deckY + 0.21, 0.08);
    crate.castShadow = true;
    bodyTiltGroup.add(crate);
  } else if (isBasket) {
    // Tall narrow 2-tier hand-basket carrier
    topRimY = 0.9;
    handleZ = rearZ - 0.08;
    for (const sx of [-0.2, 0.2]) {
      const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.78, 8), frameMat);
      upright.position.set(sx, deckY + 0.4, rearZ + 0.04);
      bodyTiltGroup.add(upright);
    }
    for (const [tierY, col] of [
      [0.34, accentHex],
      [0.68, 0xfacc15],
    ] as const) {
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.2, 0.62),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 })
      );
      tray.position.set(0, tierY, 0.02);
      tray.castShadow = true;
      bodyTiltGroup.add(tray);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 10), accentMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.98, handleZ);
    bodyTiltGroup.add(handle);
  } else {
    // Wire-basket trolley archetypes (Classic, Speed Demon, Tiny, Wobbly, Luxury, Rust, Monster, Golden)
    const scaleW = isTiny ? 0.76 : isMonster ? 1.18 : 1.0;
    const scaleL = isTiny ? 0.72 : isSpeed ? 1.08 : isMonster ? 1.12 : 1.0;
    const basketBaseY = isMonster ? 0.58 : isTiny ? 0.34 : 0.42;
    const basketH = isSpeed ? 0.32 : isTiny ? 0.34 : 0.42;
    topRimY = basketBaseY + basketH;
    handleZ = rearZ - 0.09;

    // Diagonal rear support struts
    for (const sx of [-0.25 * scaleW, 0.25 * scaleW]) {
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, basketBaseY + basketH - deckY + 0.1, 10),
        frameMat
      );
      strut.position.set(sx, (deckY + topRimY) / 2, rearZ + 0.02);
      strut.rotation.x = -0.2;
      strut.castShadow = true;
      bodyTiltGroup.add(strut);
    }

    // Push Handle
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.56 * scaleW, 12),
      accentMat
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, topRimY + 0.08, handleZ);
    if (isWobbly) handle.rotation.y = 0.14;
    handle.castShadow = true;
    bodyTiltGroup.add(handle);

    // Basket floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * scaleW, 0.026, 0.76 * scaleL),
      frameMat
    );
    floor.position.set(0, basketBaseY, 0.02);
    floor.castShadow = true;
    bodyTiltGroup.add(floor);

    // Rim rails
    const rimFront = new THREE.Mesh(
      new THREE.BoxGeometry(0.46 * scaleW, 0.036, 0.04),
      accentMat
    );
    rimFront.position.set(0, topRimY, 0.42 * scaleL);
    bodyTiltGroup.add(rimFront);

    const rimRear = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * scaleW, 0.036, 0.04),
      accentMat
    );
    rimRear.position.set(0, topRimY, -0.34 * scaleL);
    bodyTiltGroup.add(rimRear);

    for (const sx of [-0.24 * scaleW, 0.24 * scaleW]) {
      const rimSide = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.036, 0.78 * scaleL),
        accentMat
      );
      rimSide.position.set(sx, topRimY, 0.04);
      bodyTiltGroup.add(rimSide);

      for (let z = -0.28 * scaleL; z <= 0.38 * scaleL; z += 0.13) {
        if (isRust && Math.abs(z) < 0.08) continue; // Missing slat detail!
        const rib = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.007, basketH, 6),
          frameMat
        );
        rib.position.set(sx, basketBaseY + basketH / 2, z);
        if (isRust) rib.rotation.z = (z > 0 ? 1 : -1) * 0.08;
        bodyTiltGroup.add(rib);
      }
    }

    // Front grille ribs
    for (let x = -0.18 * scaleW; x <= 0.18 * scaleW; x += 0.09) {
      const frontRib = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, basketH, 6),
        frameMat
      );
      frontRib.position.set(x, basketBaseY + basketH / 2, 0.41 * scaleL);
      bodyTiltGroup.add(frontRib);
    }

    // Archetype signature details!
    if (isSpeed) {
      // Racing twin stripes + aerodynamic wedge nose + built-in rear spoiler
      const wedge = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.28, 4),
        accentMat
      );
      wedge.rotation.x = Math.PI / 2;
      wedge.rotation.y = Math.PI / 4;
      wedge.position.set(0, basketBaseY + 0.06, 0.52);
      bodyTiltGroup.add(wedge);
      attachAccessory(bodyTiltGroup, 'spoiler', accentMat, frameMat, topRimY, rearZ);
    } else if (isMonster) {
      // Lifted coil-over suspension struts + chrome front bullbar
      for (const [sx, sz] of [
        [-axleHalfW, rearZ],
        [axleHalfW, rearZ],
        [-axleHalfW * 0.9, frontZ],
        [axleHalfW * 0.9, frontZ],
      ]) {
        const shock = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
        );
        shock.position.set(sx, 0.34, sz);
        bodyTiltGroup.add(shock);
      }
      const bullbar = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.024, 8, 16, Math.PI),
        frameMat
      );
      bullbar.rotation.x = Math.PI / 2;
      bullbar.position.set(0, 0.52, frontZ + 0.12);
      bodyTiltGroup.add(bullbar);
    } else if (isLuxury) {
      // Velvet side cushions + gold VIP crest
      const velvetMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.92 });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.04), velvetMat);
      pad.position.set(0, basketBaseY + 0.26, -0.24);
      bodyTiltGroup.add(pad);
      const plaque = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09, 0),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.12 })
      );
      plaque.position.set(0, topRimY - 0.12, 0.43);
      bodyTiltGroup.add(plaque);
    } else if (isGold) {
      // Crown diamond emblem on front grille
      const crown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        new THREE.MeshStandardMaterial({
          color: 0x34d399,
          emissive: 0x10b981,
          emissiveIntensity: 0.45,
          roughness: 0.15,
        })
      );
      crown.position.set(0, topRimY + 0.08, 0.42);
      bodyTiltGroup.add(crown);
    } else if (isTiny) {
      // Built-in tall "JUNIOR SHOPPER" pennant pole
      attachAccessory(bodyTiltGroup, 'flag', accentMat, frameMat, topRimY, rearZ);
    } else {
      // Classic child seat flap
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scaleW, 0.22, 0.03), accentMat);
      seat.position.set(0, basketBaseY + 0.26, -0.22 * scaleL);
      seat.rotation.x = 0.16;
      bodyTiltGroup.add(seat);
    }
  }

  // User-equipped Cosmetic Accessory (skip duplicate if already built-in)
  if (accessory !== 'none' && !(isSpeed && accessory === 'spoiler') && !(isTiny && accessory === 'flag')) {
    attachAccessory(bodyTiltGroup, accessory, accentMat, frameMat, topRimY, handleZ + 0.06);
  }

  // Groceries inside basket
  const groceryGroup = new THREE.Group();
  if (!isHeavy && !isBasket) {
    const scale = isTiny ? 0.72 : 1.0;
    const baseY = isMonster ? 0.68 : isTiny ? 0.44 : 0.53;
    const cereal = new THREE.Mesh(
      new THREE.BoxGeometry(0.13 * scale, 0.2 * scale, 0.08 * scale),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 })
    );
    cereal.position.set(-0.1 * scale, baseY, 0.05);
    cereal.rotation.z = 0.12;
    groceryGroup.add(cereal);

    const milk = new THREE.Mesh(
      new THREE.BoxGeometry(0.1 * scale, 0.18 * scale, 0.1 * scale),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
    );
    milk.position.set(0.11 * scale, baseY, 0.12);
    groceryGroup.add(milk);

    const melon = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 * scale, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.62 })
    );
    melon.position.set(0.01, baseY, -0.06);
    groceryGroup.add(melon);
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
