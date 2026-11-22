# ASSET MANIFEST — Parallel Parking: Cart Chaos

This manifest documents every visual, 3D, texture, audio, animation, UI, and typography asset used in **Parallel Parking: Cart Chaos**, verified against the repository tree and `package.json` / `node_modules` metadata.

> **Summary**: Zero external media files (`.png`, `.jpg`, `.glb`, `.gltf`, `.mp3`, `.wav`, `.woff2`) or external URLs are loaded by the application. Every game model, texture, sound effect, animation, and UI graphic is generated procedurally or written directly in TypeScript/SVG.

---

## 1. 3D Models & Environmental Geometry

| Asset Name | Asset Type | Creation Method | Original Source / Creator | License & Usage Permissions | Commercial Use Permitted | Attribution Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Shopping Cart** (`buildShoppingCart` — chassis, wire basket ribs, red child seat, push handle, 4 wheels, 2 articulated front caster forks, groceries) | 3D Model (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work (code in repository) | Yes | None required |
| **10 Unlockable Shopping Cart Variants & Cosmetics** (`buildCustomShoppingCart` — Classic, Speed Demon, Heavy Duty, Wobbly Wheels, Tiny Trolley, Luxury, Rust Bucket, Monster, Shopping Basket Cart, Golden Cart; custom wheel styles & attachments: spoiler, flag, horn, umbrella) | 3D Models (`THREE.Group`) | Procedurally created in code (`src/game/cartModels.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **3D Store Owner NPC** (`buildStoreOwner` — shirt, tie, apron, nametag, articulated legs/arms/head, mustache, animated brows/mouth/blush) | 3D Character (`THREE.Group`) | Procedurally created in code (`src/game/ownerModel.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Parked Customer Cars** (`buildParkedCar` — beveled `ExtrudeGeometry` sedan, SUV & hatchback profiles, contoured tinted cabin glass, side mirrors, grille, bumpers, headlights/taillights, SUV roof rails, 4 tires & rims) | 3D Model (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Pedestrian Shoppers** (`buildPedestrian` — hip/shoulder-pivoted articulated legs, sneakers, jacket torso, arms, head, cap, carried grocery tote) | 3D Model (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Cart Corral Shelter** (`buildCartCorral` — curved translucent barrel-vault canopy, steel rails, corner safety bumpers) | 3D Model (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Safety Bollards & Barriers** (`buildBollard`, `buildParkingBarrier` — yellow striped posts & red/white striped barriers) | 3D Model (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Beveled Wheel Stops, Benches, Trash Bins & Parking Signs** (`buildWheelStop`, `buildBench`, `buildTrashBin`, `buildParkingSign`) | 3D Models (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Landscaped Islands & West Loading Dock** (`buildIsland`, `buildLoadingDock` — curbed tree planters, mulch beds, shrubs, concrete service deck, roll-up doors, crates) | 3D Environment (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Expanded 68m × 44m Supermarket Plaza & Lot Markings** (`buildSupermarketBackdrop` — expanded 52m storefront, pilasters, Parking Attendant Booth, Cart Collection Station, zebra crosswalks, 3-aisle lane arrows, stall lines, streetlamps) | 3D Environment (`THREE.Group`) | Procedurally created in code (`src/game/models.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Cart Showroom Turntable** (`CartShowroomCanvas` — tiered plinth & 360° interactive preview) | 3D Scene (`THREE.Group`) | Procedurally created in code (`src/components/CartGarageModal.tsx`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Parking Bay Beacons & Target Chevron** (4 corner LED cones + rotating/bobbing cone chevron) | 3D Prop (`THREE.Group` / `THREE.Mesh`) | Procedurally created in code (`src/game/CartChaosEngine.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |
| **Spilled Grocery Bags & Impact Particles** (pooled bag boxes & 48 `InstancedMesh` cubes for impacts & trails) | 3D Prop / VFX | Procedurally created in code (`src/game/CartChaosEngine.ts`) | Project Author (original Three.js procedural geometry) | Original project work | Yes | None required |

---

## 2. Textures & Environment Lighting

| Asset Name | Asset Type | Creation Method | Original Source / Creator | License & Usage Permissions | Commercial Use Permitted | Attribution Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Asphalt Albedo & Bump Maps** (`createAsphaltTextures`) | Procedural 2D Texture (`THREE.CanvasTexture`, 512×512) | Procedurally created in code (`src/game/models.ts`) | Project Author (HTML5 2D Canvas aggregate/seam generator) | Original project work | Yes | None required |
| **Parking Bay Ground Decal & Sign Plates** (`createParkingBayTexture`, `buildParkingSign`) | Procedural 2D Texture (`THREE.CanvasTexture`, 512×512 / 128×128) | Procedurally created in code (`src/game/models.ts`) | Project Author (HTML5 2D Canvas markings, `"PARK"` / `"REV IN"` arrows, P/CART/EXIT signs) | Original project work | Yes | None required |
| **Mega Mart Storefront Sign** (`createStorefrontSignTexture`) | Procedural 2D Texture (`THREE.CanvasTexture`, 1024×256) | Procedurally created in code (`src/game/models.ts`) | Project Author (HTML5 2D Canvas signage) | Original project work (subject to trademark check on fictional `"MEGA MART"` name if used commercially) | Yes | None required |
| **Radial Contact Shadow Disc** (`createRadialShadowTexture`) | Procedural Alpha Texture (`THREE.CanvasTexture`, 128×128) | Procedurally created in code (`src/game/models.ts`) | Project Author (Canvas radial gradient) | Original project work | Yes | None required |
| **Studio IBL Environment Map** (`RoomEnvironment` + `PMREMGenerator`) | Procedural Environment Map | Generated at runtime via Three.js addon (`three/addons/environments/RoomEnvironment.js`) | Three.js authors (`three@0.187.0`) | MIT License | Yes | Retain Three.js MIT copyright & permission notice |

---

## 3. Audio & Sound Effects

| Asset Name | Asset Type | Creation Method | Original Source / Creator | License & Usage Permissions | Commercial Use Permitted | Attribution Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wheel Rattle Loop** (bandpass noise + speed-modulated LFO) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Squeaky Caster Chirp** (modulated sine oscillator) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Reverse Warning Beeper** (square-wave pulse at 980 Hz) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Emergency Brake Skid** (`playBrake` — swept bandpass noise) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Metallic Cart Crash Clang** (`playCrash` — inharmonic steel partials) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Grocery Bag Drop** (`playBagDrop` — high-pass rustle) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Pedestrian Surprise Chirp & Event Alert** (`playPedestrianHey`, `playEventAlert`) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Victory Fanfare & Failure Trombone** (`playVictory`, `playFail`) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Store Owner Voice, Footsteps & Meltdown Siren** (`playOwnerVoice`, `playOwnerFootstep`, `playMeltdownSiren`) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |
| **Coin Chime & Cart Unlock Fanfare** (`playCoinChime`, `playUnlockFanfare`) | Procedural Sound Effect | Synthesized in code via Web Audio API (`src/game/audio.ts`) | Project Author | Original project work | Yes | None required |

---

## 4. Animations & Physics Behaviors

| Asset Name | Asset Type | Creation Method | Original Source / Creator | License & Usage Permissions | Commercial Use Permitted | Attribution Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Articulated Caster Swivel & Wheel Spin** | Procedural 3D Animation | Written in code (`src/game/cartPhysicsMath.ts`, `src/game/CartChaosEngine.ts`) | Project Author | Original project work | Yes | None required |
| **Cart Suspension Pitch/Roll & Bad-Wheel Pulse** | Procedural 3D Animation | Written in code (`src/game/CartChaosEngine.ts`) | Project Author | Original project work | Yes | None required |
| **Pedestrian Walking Gait & Rogue Cart Motion** | Procedural 3D Animation | Written in code (`src/game/CartChaosEngine.ts`) | Project Author | Original project work | Yes | None required |
| **Spilled Bag Bounce & Impact Particle Burst** | Procedural 3D Animation | Written in code (`src/game/CartChaosEngine.ts`) | Project Author | Original project work | Yes | None required |
| **Store Owner 13-State Rig & 6-Expression Animations** (`StoreOwnerCharacter` — `idle`, `walk`, `angry_walk`, `run`, `turn`, `point`, `angry_gesture`, `shake_fist`, `hands_on_head`, `shocked`, `facepalm`, `arms_crossed`, `celebrate` + facial brows/mouth/blush) | Procedural 3D Character Animation (`THREE.AnimationMixer`) | Written in code (`src/game/ownerModel.ts`, `src/game/characterAnimation.ts`, `src/game/CartChaosEngine.ts`) | Project Author | Original project work | Yes | None required |
| **Bay Chevron Bob/Spin & Chase/Overhead Camera Damping** | Procedural Camera/Prop Animation | Written in code (`src/game/CartChaosEngine.ts`) | Project Author | Original project work | Yes | None required |

---

## 5. UI Graphics, Icons & Fonts

| Asset Name | Asset Type | Creation Method | Original Source / Creator | License & Usage Permissions | Commercial Use Permitted | Attribution Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Title Lockup & Cart Wheel Emblem** (`TitleOverlay.tsx`) | Vector Graphic (Inline SVG) | Written in code (`src/components/TitleOverlay.tsx`) | Project Author | Original project work | Yes | None required |
| **HUD Utility Icons** (Camera, Mute/Unmute, Restart, Pause, Star Sockets, Caster Wheel Diagram) | Vector Graphics (Inline SVG) | Written in code (`src/components/GameHud.tsx`, `src/components/Modals.tsx`) | Project Author | Original project work | Yes | None required |
| **UI & Canvas Typography Stack** (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) | Font Stack (OS System Fonts) | CSS/Canvas font-family declaration (`src/index.css`, `src/game/models.ts`) | User's Operating System (no font files bundled or fetched) | Rendered natively by host OS/browser; no font binary redistributed | Yes (not bundled) | None (no font files shipped) |
