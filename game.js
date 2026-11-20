const container = document.querySelector("#game-view");
const startScreen = document.querySelector("#start-screen");
const pauseScreen = document.querySelector("#pause-screen");
const startButton = document.querySelector("#start-button");
const resumeButton = document.querySelector("#resume-button");
const pauseButton = document.querySelector("#pause-button");
const interactionPrompt = document.querySelector("#interaction-prompt");
const relayCount = document.querySelector("#relay-count");
const progressFill = document.querySelector("#progress-fill");
const missionTitle = document.querySelector("#mission-title");
const missionCopy = document.querySelector("#mission-copy");
const commsText = document.querySelector("#comms-text");
const coordinates = document.querySelector("#coordinates");
const minimap = document.querySelector("#minimap");
const mapContext = minimap.getContext("2d");
const toast = document.querySelector("#toast");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080a15);
scene.fog = new THREE.FogExp2(0x080a15, 0.0026);

const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 900);
camera.rotation.order = "YXZ";
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x7787c5, 0x12101b, 1.1));
const moonlight = new THREE.DirectionalLight(0xa6c8ff, 1.15);
moonlight.position.set(-80, 120, 45);
scene.add(moonlight);

const worldSize = 576;
const streetStep = 48;
const halfWorld = worldSize / 2;
const buildings = [];
const buildingMeshes = [];
const random = (() => {
  let seed = 120796;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
})();

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(worldSize + 80, worldSize + 80),
  new THREE.MeshStandardMaterial({ color: 0x161821, roughness: 0.94, metalness: 0.05 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.12;
scene.add(ground);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x11131b, roughness: 0.77, metalness: 0.22 });
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x262633, roughness: 0.84, metalness: 0.15 });
const laneMaterial = new THREE.MeshBasicMaterial({ color: 0x55505b, transparent: true, opacity: 0.46 });
const glowCyan = new THREE.MeshBasicMaterial({ color: 0x53ead9 });
const glowPink = new THREE.MeshBasicMaterial({ color: 0xf34da9 });
const roadSide = halfWorld - 8;

for (let index = -6; index <= 6; index += 1) {
  const streetPosition = index * streetStep;
  const roadX = new THREE.Mesh(new THREE.PlaneGeometry(15, worldSize + 20), roadMaterial);
  roadX.rotation.x = -Math.PI / 2;
  roadX.position.set(streetPosition, -0.07, 0);
  scene.add(roadX);
  const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(worldSize + 20, 15), roadMaterial);
  roadZ.rotation.x = -Math.PI / 2;
  roadZ.position.set(0, -0.068, streetPosition);
  scene.add(roadZ);

  const sidewalkA = new THREE.Mesh(new THREE.PlaneGeometry(3, worldSize + 20), sidewalkMaterial);
  sidewalkA.rotation.x = -Math.PI / 2;
  sidewalkA.position.set(streetPosition + 9.2, -0.04, 0);
  scene.add(sidewalkA);
  const sidewalkB = sidewalkA.clone();
  sidewalkB.position.x = streetPosition - 9.2;
  scene.add(sidewalkB);
  const sidewalkC = new THREE.Mesh(new THREE.PlaneGeometry(worldSize + 20, 3), sidewalkMaterial);
  sidewalkC.rotation.x = -Math.PI / 2;
  sidewalkC.position.set(0, -0.039, streetPosition + 9.2);
  scene.add(sidewalkC);
  const sidewalkD = sidewalkC.clone();
  sidewalkD.position.z = streetPosition - 9.2;
  scene.add(sidewalkD);
}

const lanePositionsX = [];
const lanePositionsZ = [];
for (let lane = -5; lane <= 5; lane += 1) {
  for (let segment = -11; segment <= 11; segment += 1) {
    lanePositionsX.push([segment * 24 + 12, -0.052, lane * streetStep + 3.8]);
    lanePositionsZ.push([lane * streetStep - 3.8, -0.051, segment * 24 + 12]);
  }
}

function addLaneMarkings(positions, geometry) {
  const markings = new THREE.InstancedMesh(geometry, laneMaterial, positions.length);
  const transform = new THREE.Object3D();
  positions.forEach(([x, y, z], index) => {
    transform.position.set(x, y, z);
    transform.rotation.set(-Math.PI / 2, 0, 0);
    transform.updateMatrix();
    markings.setMatrixAt(index, transform.matrix);
  });
  scene.add(markings);
}

addLaneMarkings(lanePositionsX, new THREE.PlaneGeometry(2.2, 0.12));
addLaneMarkings(lanePositionsZ, new THREE.PlaneGeometry(0.12, 2.2));

const windowGeometry = new THREE.PlaneGeometry(1.6, 1.18);
const windowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.9,
});
const windowTransforms = [];
const windowColors = [new THREE.Color(0x60e6dc), new THREE.Color(0xee65bc), new THREE.Color(0xe5a95b)];
const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
const buildingMaterials = [
  0x222431, 0x282532, 0x1e2830, 0x302633, 0x242936, 0x2d2935,
].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.61, metalness: 0.42 }));

function addWindows(x, z, width, depth, height, face, windowRows, windowColumns, yaw = 0) {
  for (let row = 0; row < windowRows; row += 1) {
    const y = 4 + row * 3.25;
    for (let column = 0; column < windowColumns; column += 1) {
      if (random() < 0.28) continue;
      const offset = -((windowColumns - 1) * 3.8) / 2 + column * 3.8;
      const variation = random();
      const tint = windowColors[variation > 0.92 ? 1 : variation > 0.83 ? 2 : 0];
      const localX = face === 0 || face === 2 ? offset : (face === 1 ? 1 : -1) * (width / 2 + 0.035);
      const localZ = face === 1 || face === 3 ? offset : (face === 0 ? 1 : -1) * (depth / 2 + 0.035);
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      windowTransforms.push({
        x: x + localX * cos + localZ * sin,
        y,
        z: z - localX * sin + localZ * cos,
        rotation: yaw + [0, Math.PI / 2, Math.PI, -Math.PI / 2][face],
        tint,
      });
    }
  }
}

const districts = [
  { x: -204, z: -204, w: 25, d: 28, h: 42 },
  { x: 204, z: -204, w: 27, d: 25, h: 51 },
  { x: -204, z: 204, w: 29, d: 26, h: 38 },
  { x: 204, z: 204, w: 25, d: 27, h: 47 },
];

for (let gridX = -5; gridX <= 5; gridX += 1) {
  for (let gridZ = -5; gridZ <= 5; gridZ += 1) {
    const centerX = gridX * streetStep + streetStep / 2;
    const centerZ = gridZ * streetStep + streetStep / 2;
    if (gridX === 4 && gridZ === 4) continue;
    if (Math.abs(centerX) > roadSide - 17 || Math.abs(centerZ) > roadSide - 17 || random() < 0.3) continue;
    const buildingCount = random() > 0.82 ? 2 : 1;
    for (let lot = 0; lot < buildingCount; lot += 1) {
      const width = 11 + random() * 14;
      const depth = 11 + random() * 16;
      const height = 13 + Math.floor(random() * 15) * 3.1;
      const rotation = (random() - 0.5) * 0.7;
      const extentX = (Math.abs(Math.cos(rotation)) * width + Math.abs(Math.sin(rotation)) * depth) / 2;
      const extentZ = (Math.abs(Math.sin(rotation)) * width + Math.abs(Math.cos(rotation)) * depth) / 2;
      if (extentX >= 12.5 || extentZ >= 12.5) continue;
      const x = centerX + (random() - 0.5) * (25 - extentX * 2);
      const z = centerZ + (random() - 0.5) * (25 - extentZ * 2);
      if (buildings.some((other) => (
        x + extentX + 2 > other.minX
        && x - extentX - 2 < other.maxX
        && z + extentZ + 2 > other.minZ
        && z - extentZ - 2 < other.maxZ
      ))) continue;
      const building = new THREE.Mesh(buildingGeometry, buildingMaterials[Math.floor(random() * buildingMaterials.length)]);
      building.position.set(x, height / 2, z);
      building.scale.set(width, height, depth);
      building.rotation.y = rotation;
      building.castShadow = false;
      scene.add(building);
      buildingMeshes.push(building);

      buildings.push({ minX: x - extentX, maxX: x + extentX, minZ: z - extentZ, maxZ: z + extentZ });

      if (height > 26) {
        for (let face = 0; face < 4; face += 1) {
          const facadeLength = face === 0 || face === 2 ? width : depth;
          addWindows(
            x,
            z,
            width,
            depth,
            height,
            face,
            Math.floor((height - 5) / 3.25),
            Math.max(2, Math.floor((facadeLength - 2) / 3.8)),
            rotation,
          );
        }
      }

      if (random() > 0.62) {
        const signColor = random() > 0.5 ? glowCyan : glowPink;
        const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.48, 0.11, 0.12), signColor);
        const signOffset = depth / 2 + 0.12;
        sign.position.set(x + Math.sin(rotation) * signOffset, 6 + random() * 5, z + Math.cos(rotation) * signOffset);
        sign.rotation.y = rotation;
        scene.add(sign);
      }

      if (random() > 0.82) {
        const antennaHeight = 4 + random() * 6;
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.15, antennaHeight, 5),
          new THREE.MeshStandardMaterial({ color: 0x777685, metalness: 0.8, roughness: 0.3 }),
        );
        antenna.position.set(x + (random() - 0.5) * width * 0.6, height + antennaHeight / 2, z + (random() - 0.5) * depth * 0.6);
        scene.add(antenna);
        const beaconTip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), glowPink);
        beaconTip.position.set(antenna.position.x, height + antennaHeight, antenna.position.z);
        scene.add(beaconTip);
      }
    }
  }
}

const windowInstances = new THREE.InstancedMesh(windowGeometry, windowMaterial, windowTransforms.length);
const instanceTransform = new THREE.Object3D();
windowTransforms.forEach(({ x, y, z, rotation, tint }, index) => {
  instanceTransform.position.set(x, y, z);
  instanceTransform.rotation.set(0, rotation, 0);
  instanceTransform.updateMatrix();
  windowInstances.setMatrixAt(index, instanceTransform.matrix);
  windowInstances.setColorAt(index, tint);
});
scene.add(windowInstances);

const tower = { x: 216, z: 216, entryX: 216, entryZ: 237, consoleX: 216, consoleZ: 220, breached: false, unlocked: false };
const towerBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x202431, roughness: 0.54, metalness: 0.54 });
const towerGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0x172b39,
  roughness: 0.3,
  metalness: 0.55,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const towerAccentMaterial = new THREE.MeshBasicMaterial({ color: 0x68f4e3 });
const towerPinkMaterial = new THREE.MeshBasicMaterial({ color: 0xf45cba });

function addTowerPart(width, height, depth, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  buildingMeshes.push(mesh);
  return mesh;
}

function addTowerWall(width, height, depth, x, y, z, material) {
  const mesh = addTowerPart(width, height, depth, x, y, z, material);
  buildings.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  return mesh;
}

addTowerWall(30, 10, 0.8, tower.x, 5, tower.z - 14.6, towerBaseMaterial);
addTowerWall(0.8, 10, 29.2, tower.x - 14.6, 5, tower.z, towerBaseMaterial);
addTowerWall(0.8, 10, 29.2, tower.x + 14.6, 5, tower.z, towerBaseMaterial);
const doorWidth = 6.4;
const doorSegmentWidth = (30 - doorWidth) / 2;
addTowerWall(doorSegmentWidth, 10, 0.8, tower.x - (doorWidth + doorSegmentWidth) / 2, 5, tower.z + 14.6, towerBaseMaterial);
addTowerWall(doorSegmentWidth, 10, 0.8, tower.x + (doorWidth + doorSegmentWidth) / 2, 5, tower.z + 14.6, towerBaseMaterial);
addTowerWall(0.8, 43, 21, tower.x - 10.1, 31.5, tower.z, towerGlassMaterial);
addTowerWall(0.8, 43, 21, tower.x + 10.1, 31.5, tower.z, towerGlassMaterial);
addTowerWall(21, 43, 0.8, tower.x, 31.5, tower.z - 10.1, towerGlassMaterial);
const upperDoorSegment = (21 - doorWidth) / 2;
addTowerWall(upperDoorSegment, 43, 0.8, tower.x - (doorWidth + upperDoorSegment) / 2, 31.5, tower.z + 10.1, towerGlassMaterial);
addTowerWall(upperDoorSegment, 43, 0.8, tower.x + (doorWidth + upperDoorSegment) / 2, 31.5, tower.z + 10.1, towerGlassMaterial);
addTowerPart(doorWidth, 43, 0.8, tower.x, 31.5, tower.z + 10.1, towerGlassMaterial);
addTowerPart(25, 3, 25, tower.x, 54.5, tower.z, towerBaseMaterial);
addTowerPart(14, 18, 14, tower.x, 65, tower.z, towerGlassMaterial);
addTowerPart(0.18, 35, 0.16, tower.x - 10.62, 31, tower.z + 9.4, towerAccentMaterial);
addTowerPart(0.18, 35, 0.16, tower.x + 10.62, 31, tower.z + 9.4, towerPinkMaterial);
addTowerPart(21, 0.14, 0.16, tower.x, 13.8, tower.z + 10.62, towerAccentMaterial);
const towerDoor = addTowerPart(
  doorWidth,
  8,
  0.32,
  tower.x,
  4,
  tower.z + 14.55,
  new THREE.MeshBasicMaterial({ color: 0x397d82, transparent: true, opacity: 0.56, side: THREE.DoubleSide }),
);
const towerDoorCollider = { minX: tower.x - doorWidth / 2, maxX: tower.x + doorWidth / 2, minZ: tower.z + 14.3, maxZ: tower.z + 14.8, towerDoor: true };
buildings.push(towerDoorCollider);
addTowerPart(20, 0.12, 20, tower.x, 0.06, tower.z, new THREE.MeshStandardMaterial({ color: 0x242b37, roughness: 0.7, metalness: 0.3 }));
const towerConsole = addTowerPart(
  2.2,
  1.45,
  0.8,
  tower.consoleX,
  0.85,
  tower.consoleZ,
  new THREE.MeshStandardMaterial({ color: 0x27323c, emissive: 0x123a3a, metalness: 0.72, roughness: 0.35 }),
);
towerConsole.rotation.y = Math.PI;
addTowerPart(1.7, 0.06, 0.08, tower.consoleX, 1.62, tower.consoleZ - 0.38, towerAccentMaterial);
for (const level of [13, 27, 41]) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9.2, 0.09, 5, 48),
    new THREE.MeshBasicMaterial({ color: 0x28555a, transparent: true, opacity: 0.72 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(tower.x, level, tower.z);
  scene.add(ring);
  buildingMeshes.push(ring);
}
const towerCore = new THREE.Mesh(
  new THREE.CylinderGeometry(0.65, 0.9, 43, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x36c8bd, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
);
towerCore.position.set(tower.x, 31.5, tower.z);
scene.add(towerCore);
buildingMeshes.push(towerCore);
const towerInteriorLight = new THREE.PointLight(0x53ead9, 8, 30, 2);
towerInteriorLight.position.set(tower.x, 7, tower.z);
scene.add(towerInteriorLight);
const towerAntenna = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.28, 17, 7),
  new THREE.MeshStandardMaterial({ color: 0x8c8a9b, metalness: 0.8, roughness: 0.3 }),
);
towerAntenna.position.set(tower.x, 82.5, tower.z);
scene.add(towerAntenna);
buildingMeshes.push(towerAntenna);

const towerSignCanvas = document.createElement("canvas");
towerSignCanvas.width = 512;
towerSignCanvas.height = 128;
const towerSignContext = towerSignCanvas.getContext("2d");
towerSignContext.fillStyle = "#081017";
towerSignContext.fillRect(0, 0, 512, 128);
towerSignContext.strokeStyle = "#62f4e3";
towerSignContext.lineWidth = 3;
towerSignContext.strokeRect(5, 5, 502, 118);
towerSignContext.fillStyle = "#62f4e3";
towerSignContext.font = "700 50px monospace";
towerSignContext.textAlign = "center";
towerSignContext.fillText("HELIX", 256, 58);
towerSignContext.fillStyle = "#b8b8c5";
towerSignContext.font = "20px monospace";
towerSignContext.fillText("VANTAGE SYSTEMS", 256, 94);
const towerSignTexture = new THREE.CanvasTexture(towerSignCanvas);
towerSignTexture.encoding = THREE.sRGBEncoding;
const towerSign = new THREE.Mesh(
  new THREE.PlaneGeometry(11, 2.75),
  new THREE.MeshBasicMaterial({ map: towerSignTexture, side: THREE.DoubleSide }),
);
towerSign.position.set(tower.x, 14.8, tower.z + 10.72);
scene.add(towerSign);
buildingMeshes.push(towerSign);

const towerMarker = new THREE.Group();
towerMarker.position.set(tower.entryX, 0.1, tower.entryZ);
const towerMarkerRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.4, 0.065, 6, 32),
  new THREE.MeshBasicMaterial({ color: 0xf45cba, transparent: true, opacity: 0.82 }),
);
towerMarkerRing.rotation.x = Math.PI / 2;
towerMarker.add(towerMarkerRing);
const towerMarkerDiamond = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.46, 0),
  new THREE.MeshBasicMaterial({ color: 0xf45cba }),
);
towerMarkerDiamond.position.y = 2.8;
towerMarker.add(towerMarkerDiamond);
scene.add(towerMarker);

const structureMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x282d3c, metalness: 0.75, roughness: 0.36 });
for (let axis = -5; axis <= 5; axis += 1) {
  for (let segment = -5; segment <= 5; segment += 1) {
    if (random() < 0.43) continue;
    // Keep the removed fixtures' random draws so other seeded city details stay unchanged.
    random();
    random();
    random();
  }
}

const rainCount = 1750;
const rainPositions = new Float32Array(rainCount * 3);
for (let index = 0; index < rainCount; index += 1) {
  rainPositions[index * 3] = (random() - 0.5) * worldSize;
  rainPositions[index * 3 + 1] = random() * 85;
  rainPositions[index * 3 + 2] = (random() - 0.5) * worldSize;
}
const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
const rain = new THREE.Points(
  rainGeometry,
  new THREE.PointsMaterial({ color: 0x9ac9ed, size: 0.085, transparent: true, opacity: 0.56 }),
);
rain.frustumCulled = false;
scene.add(rain);

const relays = [
  { name: "EAST MARKET", x: 24, z: -102, color: 0x61f5e2, completed: false },
  { name: "THE UNDERPASS", x: -101, z: 24, color: 0xf45cba, completed: false },
  { name: "OLD TOWER", x: 103, z: 101, color: 0xffc56b, completed: false },
];

for (const relay of relays) {
  const marker = new THREE.Group();
  marker.position.set(relay.x, 0, relay.z);
  const relayMaterial = new THREE.MeshBasicMaterial({ color: relay.color });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.35, 12), structureMetalMaterial);
  base.position.y = 0.18;
  marker.add(base);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.7, 3.5, 8), relayMaterial);
  column.position.y = 1.95;
  marker.add(column);
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 1), relayMaterial);
  orb.position.y = 4.1;
  marker.add(orb);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: relay.color, transparent: true, opacity: 0.67 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.055, 5, 32), ringMaterial);
  ring.position.y = 3.9;
  marker.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 5, 32), ringMaterial);
  ring2.position.y = 1.2;
  marker.add(ring2);
  const light = new THREE.PointLight(relay.color, 8, 28, 2);
  light.position.y = 3.3;
  marker.add(light);
  const columnLight = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 14, 5), relayMaterial);
  columnLight.position.y = 10.1;
  columnLight.material = new THREE.MeshBasicMaterial({ color: relay.color, transparent: true, opacity: 0.13, depthWrite: false });
  marker.add(columnLight);
  scene.add(marker);
  relay.marker = marker;
  relay.orb = orb;
  relay.ring = ring;
  relay.light = light;
}

const pedestrians = [];
const pedestrianColors = [0x286d76, 0x7d3e72, 0x72653a, 0x405e81, 0x76513b, 0x4c7462];
const pedestrianSpots = [
  [9.5, 96], [-9.5, -96], [96, 9.5], [-96, -9.5], [9.5, 192], [-192, -9.5],
];
for (let index = 0; index < pedestrianSpots.length; index += 1) {
  const person = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: pedestrianColors[index], roughness: 0.72 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x9a7772, roughness: 0.9 });
  const parts = [];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.83, 0.34), coat);
  torso.position.y = 1.02;
  person.add(torso);
  parts.push(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skin);
  head.position.y = 1.66;
  person.add(head);
  parts.push(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 7, 4), new THREE.MeshStandardMaterial({ color: 0x171820, roughness: 0.94 }));
  hair.scale.y = 0.52;
  hair.position.y = 1.78;
  person.add(hair);
  parts.push(hair);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.27), coat);
  leftLeg.position.set(-0.15, 0.34, 0);
  person.add(leftLeg);
  parts.push(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.15;
  person.add(rightLeg);
  parts.push(rightLeg);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.65, 0.2), coat);
  leftArm.position.set(-0.37, 1.01, 0);
  leftArm.rotation.z = -0.08;
  person.add(leftArm);
  parts.push(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.37;
  rightArm.rotation.z = 0.08;
  person.add(rightArm);
  parts.push(rightArm);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.35), glowCyan);
  collar.position.set(0, 1.35, 0);
  person.add(collar);
  parts.push(collar);
  const [x, z] = pedestrianSpots[index];
  person.position.set(x, 0, z);
  scene.add(person);
  const civilian = { kind: "civilian", index, group: person, parts, x, z, health: 1, alive: true, phase: random() * Math.PI * 2, fleeing: false };
  person.userData.actor = civilian;
  pedestrians.push(civilian);
}

const enemies = [];
const enemySpots = [[0, -145], [145, 0], [-145, 0], [0, 145], [96, -96], [211, 216], [221, 216]];
const enemyBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x29212f, metalness: 0.78, roughness: 0.32 });
const enemyArmorMaterials = [0x63263f, 0x23575f, 0x55452b, 0x493460, 0x3f5361]
  .map((color) => new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.34 }));
const enemyEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff477b });
for (let index = 0; index < enemySpots.length; index += 1) {
  const group = new THREE.Group();
  const parts = [];
  const armor = enemyArmorMaterials[index];
  const addPart = (mesh) => {
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.84, 0.42), enemyBodyMaterial);
  torso.position.y = 1.27;
  addPart(torso);
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.37, 0.09), armor);
  chestPlate.position.set(0, 1.39, -0.25);
  addPart(chestPlate);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), enemyBodyMaterial);
  head.position.set(0, 1.96, 0);
  addPart(head);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.42), armor);
  helmet.position.set(0, 2.12, 0.01);
  addPart(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.085, 0.035), enemyEyeMaterial);
  visor.position.set(0, 1.99, -0.263);
  addPart(visor);
  const shoulderLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.36), armor);
  shoulderLeft.position.set(-0.52, 1.63, 0);
  shoulderLeft.rotation.z = -0.12;
  addPart(shoulderLeft);
  const shoulderRight = shoulderLeft.clone();
  shoulderRight.position.x = 0.52;
  shoulderRight.rotation.z = 0.13;
  addPart(shoulderRight);
  const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.23), enemyBodyMaterial);
  armLeft.position.set(-0.54, 1.19, -0.01);
  armLeft.rotation.z = -0.08;
  addPart(armLeft);
  const armRight = armLeft.clone();
  armRight.position.set(0.54, 1.2, -0.12);
  armRight.rotation.z = 0.1;
  addPart(armRight);
  const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.57, 0.31), enemyBodyMaterial);
  legLeft.position.set(-0.2, 0.65, 0.015);
  addPart(legLeft);
  const legRight = legLeft.clone();
  legRight.position.x = 0.2;
  addPart(legRight);
  const bootLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.19, 0.42), armor);
  bootLeft.position.set(-0.2, 0.22, -0.08);
  addPart(bootLeft);
  const bootRight = bootLeft.clone();
  bootRight.position.x = 0.2;
  addPart(bootRight);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.72), enemyBodyMaterial);
  rifle.position.set(0.38, 1.04, -0.44);
  addPart(rifle);
  const rifleCell = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), enemyEyeMaterial);
  rifleCell.position.set(0.38, 1.04, -0.3);
  addPart(rifleCell);
  const [x, z] = enemySpots[index];
  group.position.set(x, 0.15, z);
  scene.add(group);
  const enemy = {
    kind: "hostile", group, parts, x, z, homeX: x, homeZ: z, health: 100, alive: true,
    attackAt: 0, phase: random() * Math.PI * 2, index, insideTower: index >= 5,
    spotted: false, lastSeenX: x, lastSeenZ: z, alertUntil: 0,
  };
  group.userData.actor = enemy;
  enemies.push(enemy);
}

const keys = new Set();
const player = { height: 1.72, radius: 0.72, velocityY: 0, grounded: true, speed: 10, health: 100 };
camera.position.set(-8, player.height, -8);
let yaw = 0;
let pitch = 0;
let active = false;
let started = false;
let nearbyRelay = null;
let nearbyTower = false;
let toastTimeout = 0;
let lastFrame = 0;
let mapFrame = 0;
let cityTime = 23 * 60 + 47;
let aimedTarget = null;
let recoilAt = 0;
let damageFlashUntil = 0;
let activeWeapon = "pistols";
let weaponDrawn = false;
const weaponState = { magazine: 12, reserve: 48, reloadStartedAt: 0, reloadingUntil: 0, lastShotAt: 0 };
const knifeState = { availableAt: 0, inFlight: false };
const raycaster = new THREE.Raycaster();
const aimPoint = new THREE.Vector2(0, 0);
const shotEffects = [];
const ragdolls = [];
const explosions = [];
let knifeFlight = null;

const pistolBody = new THREE.MeshStandardMaterial({ color: 0x252a36, metalness: 0.8, roughness: 0.29 });
const pistolFrame = new THREE.MeshStandardMaterial({ color: 0x343b49, metalness: 0.68, roughness: 0.38 });
const pistolAccent = new THREE.MeshStandardMaterial({ color: 0x62dace, emissive: 0x155f61, metalness: 0.55, roughness: 0.28 });
const pistolGripMaterial = new THREE.MeshStandardMaterial({ color: 0x171b26, metalness: 0.2, roughness: 0.8 });
const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x242735, metalness: 0.24, roughness: 0.82 });
const cuffMaterial = new THREE.MeshStandardMaterial({ color: 0x141923, metalness: 0.46, roughness: 0.52 });
const skinMaterial = new THREE.MeshStandardMaterial({ color: 0x9b7164, roughness: 0.88 });
const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0x292c35, metalness: 0.18, roughness: 0.76 });

function addCylinderBetween(parent, start, end, startRadius, endRadius, material, sides = 8) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const segment = new THREE.Mesh(
    new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), sides),
    material,
  );
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(segment);
  return segment;
}

function createFirstPersonHand() {
  const hand = new THREE.Group();
  hand.name = "view-hand";
  addCylinderBetween(
    hand,
    new THREE.Vector3(0, -0.56, 0.37),
    new THREE.Vector3(0, -0.19, 0.16),
    0.105,
    0.075,
    sleeveMaterial,
  );
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.097, 0.075, 8), cuffMaterial);
  cuff.position.set(0, -0.2, 0.17);
  cuff.rotation.x = -0.5;
  hand.add(cuff);

  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skinMaterial);
  palm.scale.set(0.105, 0.12, 0.105);
  palm.position.set(0, -0.105, 0.105);
  hand.add(palm);

  for (let finger = 0; finger < 4; finger += 1) {
    const x = (finger - 1.5) * 0.046;
    const y = -0.105 - finger * 0.027;
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.033, 7, 6), skinMaterial);
    knuckle.scale.set(0.9, 1.08, 0.9);
    knuckle.position.set(x, y, 0.17);
    hand.add(knuckle);
    addCylinderBetween(
      hand,
      new THREE.Vector3(x, y - 0.014, 0.175),
      new THREE.Vector3(x * 0.82, y - 0.027, 0.105),
      0.024,
      0.022,
      skinMaterial,
      6,
    );
  }

  addCylinderBetween(
    hand,
    new THREE.Vector3(0.105, -0.035, 0.105),
    new THREE.Vector3(0.045, -0.105, 0.19),
    0.036,
    0.03,
    skinMaterial,
    7,
  );
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.045), gloveMaterial);
  glove.position.set(0, -0.238, 0.26);
  hand.add(glove);
  const cuffLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.025), pistolAccent);
  cuffLight.position.set(0, -0.207, 0.205);
  hand.add(cuffLight);
  return hand;
}

const pistol = new THREE.Group();
pistol.position.set(0.34, -0.21, -0.58);
camera.add(pistol);
const grip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.29, 0.2), pistolGripMaterial);
grip.position.set(0, -0.15, 0.015);
grip.rotation.z = -0.12;
pistol.add(grip);
const gripBase = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.035, 0.21), pistolFrame);
gripBase.position.set(0, -0.3, 0.018);
pistol.add(gripBase);
for (let ridge = 0; ridge < 5; ridge += 1) {
  const gripRidge = new THREE.Mesh(new THREE.BoxGeometry(0.174, 0.012, 0.012), pistolFrame);
  gripRidge.position.set(0, -0.25 + ridge * 0.044, 0.121);
  pistol.add(gripRidge);
}
const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.47), pistolFrame);
frame.position.set(0, -0.035, -0.19);
pistol.add(frame);
const slide = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.17, 0.49), pistolBody);
slide.position.set(0, 0.045, -0.215);
pistol.add(slide);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.34, 10), pistolFrame);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.035, -0.55);
pistol.add(barrel);
const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.026, 10), pistolAccent);
muzzleRing.rotation.x = Math.PI / 2;
muzzleRing.position.set(0, 0.035, -0.721);
pistol.add(muzzleRing);
const pistolRail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.28), pistolAccent);
pistolRail.position.set(0, -0.105, -0.23);
pistol.add(pistolRail);
for (let groove = 0; groove < 4; groove += 1) {
  const slideGroove = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.085, 0.018), pistolFrame);
  slideGroove.position.set(0.128, 0.05, -0.03 + groove * 0.055);
  pistol.add(slideGroove);
}
for (const sightZ of [-0.405, -0.035]) {
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.055), pistolFrame);
  sight.position.set(0, 0.145, sightZ);
  pistol.add(sight);
}
const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 6, 12), pistolFrame);
triggerGuard.position.set(0, -0.11, -0.005);
triggerGuard.rotation.x = Math.PI / 2;
pistol.add(triggerGuard);
const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.025), pistolAccent);
trigger.position.set(0, -0.095, -0.015);
pistol.add(trigger);
pistol.add(createFirstPersonHand());
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9dfff3 }));
muzzleFlash.name = "muzzle-flash";
muzzleFlash.position.set(0, 0.035, -0.75);
muzzleFlash.visible = false;
pistol.add(muzzleFlash);
const leftPistol = pistol.clone(true);
leftPistol.position.x = -0.34;
leftPistol.getObjectByName("view-hand").scale.x = -1;
camera.add(leftPistol);
const leftMuzzleFlash = leftPistol.getObjectByName(muzzleFlash.name || "muzzle-flash");
const knifeBladeMaterial = new THREE.MeshStandardMaterial({ color: 0xc6d5dc, metalness: 0.84, roughness: 0.22, emissive: 0x172b32, side: THREE.DoubleSide });
const knifeGripMaterial = new THREE.MeshStandardMaterial({ color: 0x242a34, metalness: 0.52, roughness: 0.48 });
const knifeAccentMaterial = new THREE.MeshStandardMaterial({ color: 0x62dace, emissive: 0x155f61, metalness: 0.62, roughness: 0.34 });
function createKnifeModel() {
  const knife = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.06, 0);
  bladeShape.lineTo(0.06, 0);
  bladeShape.lineTo(0.055, 0.28);
  bladeShape.lineTo(0.035, 0.39);
  bladeShape.lineTo(0, 0.55);
  bladeShape.lineTo(-0.045, 0.38);
  bladeShape.lineTo(-0.06, 0);
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.008,
  });
  bladeGeometry.rotateX(-Math.PI / 2);
  bladeGeometry.translate(0, 0.015, 0);
  const blade = new THREE.Mesh(bladeGeometry, knifeBladeMaterial);
  knife.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.065), knifeGripMaterial);
  guard.position.set(0, 0, -0.015);
  knife.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.065, 0.23, 8), knifeGripMaterial);
  grip.rotation.x = Math.PI / 2;
  grip.position.set(0, 0, 0.075);
  knife.add(grip);
  for (let ridge = 0; ridge < 4; ridge += 1) {
    const gripRidge = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 4, 8), knifeAccentMaterial);
    gripRidge.position.set(0, 0, 0.005 + ridge * 0.048);
    knife.add(gripRidge);
  }
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), knifeAccentMaterial);
  pommel.position.set(0, 0, 0.2);
  knife.add(pommel);
  return knife;
}
const heldKnife = createKnifeModel();
heldKnife.position.set(-0.34, -0.22, -0.55);
heldKnife.rotation.x = -0.22;
const knifeHand = createFirstPersonHand();
knifeHand.scale.x = -1;
heldKnife.add(knifeHand);
camera.add(heldKnife);
const knifeProjectile = createKnifeModel();
knifeProjectile.visible = false;
scene.add(knifeProjectile);
const legsView = new THREE.Group();
legsView.visible = false;
camera.add(legsView);
const legMaterial = new THREE.MeshStandardMaterial({ color: 0x242735, metalness: 0.28, roughness: 0.78 });
const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x11151e, metalness: 0.62, roughness: 0.44 });
const legAccentMaterial = new THREE.MeshBasicMaterial({ color: 0x50cfc5 });
for (const side of [-1, 1]) {
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.31), legMaterial);
  thigh.position.set(side * 0.19, -0.91, -0.32);
  legsView.add(thigh);
  const knee = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.17, 0.34), bootMaterial);
  knee.position.set(side * 0.19, -1.12, -0.51);
  legsView.add(knee);
  const shin = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.39, 0.27), legMaterial);
  shin.position.set(side * 0.19, -1.37, -0.51);
  legsView.add(shin);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.18, 0.42), bootMaterial);
  boot.position.set(side * 0.19, -1.55, -0.69);
  legsView.add(boot);
  const ankleLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.29), legAccentMaterial);
  ankleLight.position.set(side * 0.19, -1.48, -0.54);
  legsView.add(ankleLight);
}
const weaponWorldPosition = new THREE.Vector3();
const weaponWorldDirection = new THREE.Vector3();

const questRelayRow = document.querySelector("#quest-relays");
const questEnemiesRow = document.querySelector("#quest-enemies");
const questTowerRow = document.querySelector("#quest-tower");
const questRelaysCount = document.querySelector("#quest-relays-count");
const questEnemiesCount = document.querySelector("#quest-enemies-count");
const questTowerStatus = document.querySelector("#quest-tower-status");
const interactionLabel = document.querySelector("#interaction-label");
const ammoCurrent = document.querySelector("#ammo-current");
const ammoReserve = document.querySelector("#ammo-reserve");
const weaponCaption = document.querySelector(".weapon-label span:last-child");
const weaponSubline = weaponCaption.querySelector("small");
const inventoryPistols = document.querySelector("#inventory-pistols");
const inventoryKnife = document.querySelector("#inventory-knife");
const knifeStatus = document.querySelector("#knife-status");
const concealmentState = document.querySelector("#concealment-state");
const healthValue = document.querySelector("#health-value");
const healthFill = document.querySelector("#health-fill");
const enemyCount = document.querySelector("#enemy-count");
const targetName = document.querySelector("#target-name");
const combatPanel = document.querySelector(".combat-panel");
const crosshair = document.querySelector(".crosshair");
const vignette = document.querySelector(".vignette");

function lockPointer() {
  if (!document.pointerLockElement) renderer.domElement.requestPointerLock();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function selectWeapon(weapon) {
  if (activeWeapon === weapon) return;
  activeWeapon = weapon;
  weaponDrawn = true;
  showToast(weapon === "pistols" ? "AKIMBO PISTOLS DRAWN" : "THROWING KNIFE DRAWN");
}

function toggleWeapon() {
  weaponDrawn = !weaponDrawn;
  showToast(weaponDrawn ? "WEAPON DRAWN / CONCEALMENT LOST" : "WEAPON HOLSTERED / CONCEALED");
}

function updateQuestProgress() {
  const restoredRelays = relays.filter((relay) => relay.completed).length;
  const streetEnemies = enemies.filter((enemy) => !enemy.insideTower);
  const disabledEnemies = streetEnemies.filter((enemy) => !enemy.alive).length;
  const towerGuardsClear = enemies.filter((enemy) => enemy.insideTower).every((enemy) => !enemy.alive);
  const unlocked = restoredRelays === relays.length && disabledEnemies === streetEnemies.length;
  if (unlocked && !tower.unlocked && !tower.breached) {
    showToast("SECURITY GRID CLEAR / HELIX TOWER DOOR OPEN");
  }
  tower.unlocked = unlocked || tower.breached;
  towerDoor.visible = !tower.unlocked;
  questRelaysCount.textContent = `${String(restoredRelays).padStart(2, "0")}/03`;
  questEnemiesCount.textContent = `${String(disabledEnemies).padStart(2, "0")}/05`;
  questRelayRow.classList.toggle("complete", restoredRelays === relays.length);
  questEnemiesRow.classList.toggle("complete", disabledEnemies === streetEnemies.length);
  questTowerRow.classList.toggle("locked", !tower.unlocked && !tower.breached);
  questTowerRow.classList.toggle("available", tower.unlocked && !tower.breached);
  questTowerRow.classList.toggle("complete", tower.breached);
  questTowerStatus.textContent = tower.breached ? "DONE" : !tower.unlocked ? "LOCKED" : towerGuardsClear ? "CLEAR" : "HOSTILES";
  towerMarker.visible = !tower.breached;
  towerMarkerRing.material.color.set(tower.unlocked ? 0xf45cba : 0x7d718b);
  towerMarkerDiamond.material.color.set(tower.unlocked ? 0xf45cba : 0x7d718b);
}

function startGame() {
  started = true;
  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  lockPointer();
}

function togglePause() {
  if (!started) return;
  if (document.pointerLockElement) {
    document.exitPointerLock();
    return;
  }
  pauseScreen.classList.add("hidden");
  lockPointer();
}

startButton.addEventListener("click", startGame);
resumeButton.addEventListener("click", togglePause);
pauseButton.addEventListener("click", () => {
  if (document.pointerLockElement) document.exitPointerLock();
  else togglePause();
});
renderer.domElement.addEventListener("click", () => {
  if (started && !document.pointerLockElement) lockPointer();
});

document.addEventListener("pointerlockchange", () => {
  active = document.pointerLockElement === renderer.domElement;
  if (!started) return;
  if (active) {
    pauseScreen.classList.add("hidden");
  } else {
    pauseScreen.classList.remove("hidden");
    interactionPrompt.classList.remove("visible");
    keys.clear();
  }
});

document.addEventListener("mousemove", (event) => {
  if (!active) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2.1, Math.PI / 2.1);
  camera.rotation.set(pitch, yaw, 0);
});

document.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "KeyE" && active && nearbyRelay) activateRelay(nearbyRelay);
  else if (event.code === "KeyE" && active && nearbyTower) activateTower();
  if (event.code === "KeyR" && active && !event.repeat) reloadWeapon();
  if (event.code === "Digit1" && active && !event.repeat) selectWeapon("pistols");
  if (event.code === "Digit2" && active && !event.repeat) selectWeapon("knife");
  if (event.code === "KeyQ" && active && !event.repeat) toggleWeapon();
  if (event.code === "Escape" && active) document.exitPointerLock();
});
document.addEventListener("keyup", (event) => keys.delete(event.code));
document.addEventListener("mousedown", (event) => {
  if (!active || !weaponDrawn) return;
  if (event.button === 0 && activeWeapon === "pistols") fireWeapon(performance.now());
  if (event.button === 2 && activeWeapon === "knife") throwKnife(performance.now());
});
document.addEventListener("contextmenu", (event) => {
  if (active) event.preventDefault();
});
window.addEventListener("blur", () => keys.clear());

function collides(x, z) {
  for (const building of buildings) {
    if (building.towerDoor && tower.unlocked) continue;
    const nearestX = THREE.MathUtils.clamp(x, building.minX, building.maxX);
    const nearestZ = THREE.MathUtils.clamp(z, building.minZ, building.maxZ);
    const dx = x - nearestX;
    const dz = z - nearestZ;
    if (dx * dx + dz * dz < player.radius * player.radius) return true;
  }
  return false;
}

function dropCharacter(actor) {
  actor.group.updateMatrixWorld(true);
  const impulse = new THREE.Vector3(
    camera.position.x - actor.group.position.x,
    0,
    camera.position.z - actor.group.position.z,
  ).normalize();
  for (const part of actor.parts) {
    const position = part.getWorldPosition(new THREE.Vector3());
    const quaternion = part.getWorldQuaternion(new THREE.Quaternion());
    const scale = part.getWorldScale(new THREE.Vector3());
    const mesh = part.clone(false);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    mesh.scale.copy(scale);
    scene.add(mesh);
    const velocity = impulse.clone().multiplyScalar(1.1 + random() * 1.8);
    velocity.x += (random() - 0.5) * 1.7;
    velocity.z += (random() - 0.5) * 1.7;
    velocity.y = 1.7 + random() * 2.8;
    ragdolls.push({
      mesh,
      velocity,
      angularVelocity: new THREE.Vector3((random() - 0.5) * 8, (random() - 0.5) * 8, (random() - 0.5) * 8),
      expiresAt: performance.now() + 14000,
    });
  }
  actor.alive = false;
  actor.health = 0;
  actor.group.visible = false;
  if (actor.kind === "hostile") {
    showToast(`SECURITY DRONE ${String(actor.index + 1).padStart(2, "0")} DISABLED`);
    updateQuestProgress();
  } else {
    showToast("CIVILIAN DOWN");
  }
}

function updateRagdolls(delta, now) {
  for (let index = ragdolls.length - 1; index >= 0; index -= 1) {
    const ragdoll = ragdolls[index];
    if (now >= ragdoll.expiresAt) {
      scene.remove(ragdoll.mesh);
      ragdolls.splice(index, 1);
      continue;
    }
    ragdoll.velocity.y -= 9.8 * delta;
    ragdoll.mesh.position.addScaledVector(ragdoll.velocity, delta);
    ragdoll.mesh.rotation.x += ragdoll.angularVelocity.x * delta;
    ragdoll.mesh.rotation.y += ragdoll.angularVelocity.y * delta;
    ragdoll.mesh.rotation.z += ragdoll.angularVelocity.z * delta;
    if (ragdoll.mesh.position.y < 0.08) {
      ragdoll.mesh.position.y = 0.08;
      ragdoll.velocity.y = Math.abs(ragdoll.velocity.y) * 0.24;
      ragdoll.velocity.x *= 0.72;
      ragdoll.velocity.z *= 0.72;
      ragdoll.angularVelocity.multiplyScalar(0.82);
    }
  }
}

function findAimHit(maxDistance = 58) {
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(aimPoint, camera);
  raycaster.far = maxDistance;
  const actors = [
    ...enemies.filter((enemy) => enemy.alive),
    ...pedestrians.filter((pedestrian) => pedestrian.alive),
  ];
  const targets = [...buildingMeshes, ...actors.map((actor) => actor.group)];
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return null;
  let object = hit.object;
  while (object && !object.userData.actor) object = object.parent;
  return { actor: object ? object.userData.actor : null, point: hit.point.clone(), distance: hit.distance };
}

function addBeam(start, end, color, expiresIn = 100) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const beam = new THREE.Line(geometry, material);
  beam.renderOrder = 4;
  scene.add(beam);
  shotEffects.push({ beam, expiresAt: performance.now() + expiresIn });
}

function reloadWeapon() {
  if (!weaponDrawn || activeWeapon !== "pistols" || weaponState.reloadingUntil || weaponState.magazine === 12 || weaponState.reserve === 0) return;
  weaponState.reloadStartedAt = performance.now();
  weaponState.reloadingUntil = weaponState.reloadStartedAt + 1050;
  showToast("RELOADING AKIMBO CELLS");
}

function fireWeapon(now) {
  if (!weaponDrawn || activeWeapon !== "pistols" || weaponState.reloadingUntil > now || now - weaponState.lastShotAt < 290) return;
  if (weaponState.magazine === 0) {
    reloadWeapon();
    return;
  }
  weaponState.magazine -= 1;
  weaponState.lastShotAt = now;
  recoilAt = now;
  const hit = findAimHit();
  camera.getWorldPosition(weaponWorldPosition);
  camera.getWorldDirection(weaponWorldDirection);
  const endpoint = hit ? hit.point : weaponWorldPosition.clone().addScaledVector(weaponWorldDirection, 48);
  addBeam(weaponWorldPosition.clone(), endpoint, 0x7dfff0, 115);
  weaponState.shotCount = (weaponState.shotCount || 0) + 1;
  weaponState.lastHand = weaponState.shotCount % 2;
  if (hit && hit.actor) {
    dropCharacter(hit.actor);
  }
}

function throwKnife(now) {
  if (knifeState.inFlight || now < knifeState.availableAt) return;
  const hit = findAimHit(48);
  const start = camera.getWorldPosition(new THREE.Vector3());
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const end = hit ? hit.point.clone() : start.clone().addScaledVector(direction, 48);
  const duration = Math.max(180, (hit ? hit.distance : 48) / 55 * 1000);
  knifeProjectile.visible = true;
  knifeProjectile.position.copy(start).addScaledVector(direction, 0.7);
  knifeProjectile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  heldKnife.visible = false;
  knifeState.inFlight = true;
  knifeFlight = {
    start,
    end,
    target: hit?.actor?.kind === "hostile" ? hit.actor : null,
    startedAt: now,
    impactAt: now + duration,
    duration,
  };
}

function createExplosion(position, now) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb354, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  mesh.position.copy(position);
  scene.add(mesh);
  const light = new THREE.PointLight(0xff754b, 5, 12, 2);
  light.position.copy(position);
  scene.add(light);
  explosions.push({ mesh, light, startedAt: now, expiresAt: now + 520 });
}

function updateKnifeAndExplosions(now) {
  if (knifeFlight) {
    const progress = THREE.MathUtils.clamp((now - knifeFlight.startedAt) / knifeFlight.duration, 0, 1);
    knifeProjectile.position.lerpVectors(knifeFlight.start, knifeFlight.end, progress);
    if (now >= knifeFlight.impactAt) {
      const { target, end } = knifeFlight;
      knifeProjectile.visible = false;
      knifeState.inFlight = false;
      knifeFlight = null;
      if (target?.alive) {
        createExplosion(end, now);
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (enemy === target || enemy.group.position.distanceTo(end) <= 5.2) dropCharacter(enemy);
        }
        showToast("KNIFE DETONATION / SECURITY THREAT NEUTRALIZED");
      } else {
        knifeState.availableAt = now + 8000;
        showToast("KNIFE MISSED / RECOVERY IN 8 SECONDS");
      }
    }
  }
  for (let index = explosions.length - 1; index >= 0; index -= 1) {
    const explosion = explosions[index];
    if (now >= explosion.expiresAt) {
      scene.remove(explosion.mesh, explosion.light);
      explosion.mesh.geometry.dispose();
      explosion.mesh.material.dispose();
      explosions.splice(index, 1);
      continue;
    }
    const progress = (now - explosion.startedAt) / (explosion.expiresAt - explosion.startedAt);
    explosion.mesh.scale.setScalar(1 + progress * 13);
    explosion.mesh.material.opacity = 0.85 * (1 - progress);
    explosion.light.intensity = 5 * (1 - progress);
  }
}

function damagePlayer(amount, now) {
  player.health = Math.max(0, player.health - amount);
  damageFlashUntil = now + 240;
  if (now - (damagePlayer.lastToastAt || 0) > 1600) {
    showToast("HOSTILE FIRE / MOVE TO COVER");
    damagePlayer.lastToastAt = now;
  }
  if (player.health === 0) {
    player.health = 65;
    player.velocityY = 0;
    camera.position.set(-8, player.height, -8);
    showToast("SYSTEM REBOOT / BACK IN THE STREETS");
  }
}

function hasLineOfSight(enemy) {
  const origin = new THREE.Vector3(enemy.group.position.x, 1.8, enemy.group.position.z);
  const direction = camera.position.clone().sub(origin);
  const distance = direction.length();
  direction.normalize();
  raycaster.set(origin, direction);
  raycaster.far = distance;
  return raycaster.intersectObjects(buildingMeshes, false).length === 0;
}

function canSeePlayer(enemy, distance) {
  const viewDistance = weaponDrawn ? 50 : 34;
  if (distance > viewDistance) return false;
  const facing = new THREE.Vector3(-Math.sin(enemy.group.rotation.y), 0, -Math.cos(enemy.group.rotation.y));
  const toPlayer = new THREE.Vector3(
    camera.position.x - enemy.group.position.x,
    0,
    camera.position.z - enemy.group.position.z,
  ).normalize();
  return facing.dot(toPlayer) > Math.cos(Math.PI / 3) && hasLineOfSight(enemy);
}

function updateEnemies(delta, now) {
  if (!active) return;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    let distance = Math.hypot(camera.position.x - enemy.group.position.x, camera.position.z - enemy.group.position.z);
    const seesPlayer = canSeePlayer(enemy, distance);
    if (seesPlayer) {
      enemy.spotted = true;
      enemy.lastSeenX = camera.position.x;
      enemy.lastSeenZ = camera.position.z;
      enemy.alertUntil = now + 5000;
    }

    if (enemy.spotted && now < enemy.alertUntil) {
      const targetX = seesPlayer ? camera.position.x : enemy.lastSeenX;
      const targetZ = seesPlayer ? camera.position.z : enemy.lastSeenZ;
      const dx = targetX - enemy.group.position.x;
      const dz = targetZ - enemy.group.position.z;
      const targetDistance = Math.hypot(dx, dz);
      if (targetDistance > 2.8) {
        const step = Math.min(4.2 * delta, targetDistance - 2.2);
        let nextX = enemy.group.position.x + (dx / targetDistance) * step;
        let nextZ = enemy.group.position.z + (dz / targetDistance) * step;
        if (enemy.insideTower) {
          nextX = THREE.MathUtils.clamp(nextX, tower.x - 8.8, tower.x + 8.8);
          nextZ = THREE.MathUtils.clamp(nextZ, tower.z - 8.8, tower.z + 8.8);
        }
        if (!collides(nextX, enemy.group.position.z)) enemy.group.position.x = nextX;
        if (!collides(enemy.group.position.x, nextZ)) enemy.group.position.z = nextZ;
        enemy.group.rotation.y = Math.atan2(-dx, -dz);
      } else {
        enemy.group.rotation.y = Math.atan2(-dx, -dz) + Math.sin(now * 0.002 + enemy.phase) * 0.9;
      }
    } else {
      enemy.spotted = false;
      enemy.group.position.x = enemy.homeX + Math.sin(now * 0.0007 + enemy.phase) * 1.5;
      enemy.group.position.z = enemy.homeZ + Math.cos(now * 0.0007 + enemy.phase) * 1.5;
      enemy.group.rotation.y = Math.sin(now * 0.0012 + enemy.phase) * 1.1;
    }

    enemy.group.position.y = 0.15 + Math.sin(now * 0.003 + enemy.phase) * 0.09;
    distance = Math.hypot(camera.position.x - enemy.group.position.x, camera.position.z - enemy.group.position.z);
    if (seesPlayer && distance < 25 && now >= enemy.attackAt) {
      enemy.attackAt = now + 1450 + random() * 450;
      const origin = new THREE.Vector3(enemy.group.position.x, 1.8, enemy.group.position.z);
      addBeam(origin, camera.position.clone(), 0xff477b, 160);
      damagePlayer(8, now);
    }
  }
}

function updateCombat(now) {
  aimedTarget = active ? findAimHit()?.actor ?? null : null;
  crosshair.classList.toggle("targeting", Boolean(aimedTarget && weaponDrawn));
  combatPanel.classList.toggle("targeting", Boolean(aimedTarget && weaponDrawn));
  targetName.textContent = aimedTarget
    ? aimedTarget.kind === "hostile"
      ? `HOSTILE ${String(aimedTarget.index + 1).padStart(2, "0")} / ${aimedTarget.health}%`
      : "CIVILIAN / NON-COMBATANT"
    : "NO HOSTILE IN SIGHTS";

  if (weaponState.reloadingUntil && now >= weaponState.reloadingUntil) {
    const loaded = Math.min(12 - weaponState.magazine, weaponState.reserve);
    weaponState.magazine += loaded;
    weaponState.reserve -= loaded;
    weaponState.reloadingUntil = 0;
    weaponState.reloadStartedAt = 0;
  }
  const pistolsSelected = activeWeapon === "pistols";
  weaponCaption.firstChild.textContent = pistolsSelected ? "AKIMBO PISTOLS" : "THROWING KNIFE";
  weaponSubline.textContent = pistolsSelected ? "MK-II / CHARGED" : "EXPLOSIVE / RECOVERABLE";
  ammoCurrent.textContent = pistolsSelected
    ? weaponState.reloadingUntil ? "…" : String(weaponState.magazine).padStart(2, "0")
    : knifeState.inFlight || now < knifeState.availableAt ? "…" : "01";
  ammoReserve.textContent = pistolsSelected ? String(weaponState.reserve).padStart(2, "0") : "01";
  inventoryPistols.classList.toggle("selected", pistolsSelected);
  inventoryKnife.classList.toggle("selected", !pistolsSelected);
  inventoryPistols.querySelector("b").textContent = `${String(weaponState.magazine).padStart(2, "0")} / ${String(weaponState.reserve).padStart(2, "0")}`;
  knifeStatus.textContent = knifeState.inFlight
    ? "IN FLIGHT"
    : now < knifeState.availableAt
      ? `${Math.ceil((knifeState.availableAt - now) / 1000)}S`
      : "READY";
  concealmentState.textContent = weaponDrawn ? "EXPOSED" : "CONCEALED";
  concealmentState.classList.toggle("drawn", weaponDrawn);
  healthValue.textContent = `${player.health}%`;
  healthFill.style.width = `${player.health}%`;
  healthFill.style.background = player.health <= 30 ? "#f65ab8" : "#62f4e3";
  healthFill.style.boxShadow = `0 0 7px ${player.health <= 30 ? "#f65ab8" : "#62f4e3"}`;
  enemyCount.textContent = `${String(enemies.filter((enemy) => enemy.health > 0).length).padStart(2, "0")} HOSTILES`;
  vignette.classList.toggle("damage", now < damageFlashUntil);
  const pistolsVisible = weaponDrawn && pistolsSelected;
  const knifeVisible = weaponDrawn && !pistolsSelected && !knifeState.inFlight && now >= knifeState.availableAt;
  pistol.visible = pistolsVisible;
  leftPistol.visible = pistolsVisible;
  heldKnife.visible = knifeVisible;
  const flashing = weaponState.lastShotAt > 0 && now - weaponState.lastShotAt < 75 && pistolsVisible;
  muzzleFlash.visible = flashing && weaponState.lastHand === 0;
  leftMuzzleFlash.visible = flashing && weaponState.lastHand === 1;

  const recoil = Math.max(0, 1 - (now - recoilAt) / 180);
  const reloadProgress = weaponState.reloadingUntil
    ? THREE.MathUtils.clamp((now - weaponState.reloadStartedAt) / 1050, 0, 1)
    : 0;
  const reloadDip = Math.sin(reloadProgress * Math.PI);
  const walking = active && (keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD"));
  pistol.position.x = 0.34 + reloadDip * 0.08;
  pistol.position.z = -0.58 + recoil * 0.09;
  pistol.position.y = -0.21 + (walking ? Math.sin(now * 0.012) * 0.008 : 0) - reloadDip * 0.23;
  leftPistol.position.z = pistol.position.z;
  leftPistol.position.y = pistol.position.y;
  pistol.rotation.x = -reloadDip * 0.75;
  pistol.rotation.z = reloadDip * 0.28;
  leftPistol.rotation.x = pistol.rotation.x;
  leftPistol.rotation.z = -pistol.rotation.z;
  legsView.visible = pitch < -0.48;
  legsView.rotation.z = walking ? Math.sin(now * 0.012) * 0.035 : 0;

  for (let index = shotEffects.length - 1; index >= 0; index -= 1) {
    if (now < shotEffects[index].expiresAt) continue;
    scene.remove(shotEffects[index].beam);
    shotEffects[index].beam.geometry.dispose();
    shotEffects[index].beam.material.dispose();
    shotEffects.splice(index, 1);
  }
}

function activateRelay(relay) {
  if (relay.completed) return;
  relay.completed = true;
  relay.marker.visible = false;
  const completed = relays.filter((item) => item.completed).length;
  relayCount.innerHTML = `${String(completed).padStart(2, "0")} <span class="progress-total">/ 03</span>`;
  progressFill.style.width = `${(completed / relays.length) * 100}%`;
  document.querySelectorAll(".relay-item")[relays.indexOf(relay)].classList.add("complete");
  interactionPrompt.classList.remove("visible");
  updateQuestProgress();

  if (completed === relays.length) {
    missionTitle.innerHTML = "THE GRID<br /><span>IS ALIVE</span>";
    missionCopy.textContent = "The district lights return, one window at a time. For now, the city is listening.";
    commsText.innerHTML = "DISTRICT GRID <b>RESTORED</b>";
    showToast("ALL RELAYS RESTORED  /  DISTRICT 07 ONLINE");
  } else {
    showToast(`${relay.name} RELAY ONLINE  /  ${3 - completed} SIGNAL${3 - completed === 1 ? "" : "S"} REMAINING`);
  }
}

function activateTower() {
  if (!tower.unlocked || tower.breached || enemies.some((enemy) => enemy.insideTower && enemy.alive)) return;
  tower.breached = true;
  nearbyTower = false;
  missionTitle.innerHTML = "HELIX TOWER<br /><span>BREACHED</span>";
  missionCopy.textContent = "The tower guards are down. Helix Tower is breached, and the district is yours again.";
  commsText.innerHTML = "HELIX TOWER <b>BREACHED</b>";
  interactionPrompt.classList.remove("visible");
  updateQuestProgress();
  showToast("HELIX TOWER BREACHED / CONTRACT COMPLETE");
}

function updateMovement(delta) {
  if (!active) return;
  const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const strafe = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const moveLength = Math.hypot(forward, strafe) || 1;
  const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = player.speed * (sprinting ? 1.65 : 1);
  const normalizedForward = forward / moveLength;
  const normalizedStrafe = strafe / moveLength;
  const dx = (-Math.sin(yaw) * normalizedForward + Math.cos(yaw) * normalizedStrafe) * speed * delta;
  const dz = (-Math.cos(yaw) * normalizedForward - Math.sin(yaw) * normalizedStrafe) * speed * delta;

  const nextX = THREE.MathUtils.clamp(camera.position.x + dx, -halfWorld + 3, halfWorld - 3);
  const nextZ = THREE.MathUtils.clamp(camera.position.z + dz, -halfWorld + 3, halfWorld - 3);
  if (!collides(nextX, camera.position.z)) camera.position.x = nextX;
  if (!collides(camera.position.x, nextZ)) camera.position.z = nextZ;

  if (keys.has("Space") && player.grounded) {
    player.velocityY = 7.8;
    player.grounded = false;
  }
  player.velocityY -= 19 * delta;
  camera.position.y += player.velocityY * delta;
  if (camera.position.y <= player.height) {
    camera.position.y = player.height;
    player.velocityY = 0;
    player.grounded = true;
  }
}

function updateRelays(time) {
  let closestDistance = Infinity;
  nearbyRelay = null;
  nearbyTower = false;
  for (const relay of relays) {
    if (relay.completed) continue;
    relay.orb.rotation.y = time * 0.001;
    relay.ring.rotation.y = time * 0.0007;
    relay.marker.position.y = Math.sin(time * 0.002) * 0.12;
    const dx = relay.x - camera.position.x;
    const dz = relay.z - camera.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < closestDistance && distance < 4.8) {
      closestDistance = distance;
      nearbyRelay = relay;
    }
  }
  const towerDistance = Math.hypot(tower.consoleX - camera.position.x, tower.consoleZ - camera.position.z);
  nearbyTower = !nearbyRelay
    && tower.unlocked
    && !tower.breached
    && !enemies.some((enemy) => enemy.insideTower && enemy.alive)
    && towerDistance < 4.5;
  interactionLabel.textContent = nearbyRelay ? "RESTORE RELAY" : "BREACH HELIX TOWER";
  interactionPrompt.classList.toggle("visible", Boolean((nearbyRelay || nearbyTower) && active));
}

function updateRain(delta) {
  const positions = rainGeometry.attributes.position;
  const driftX = -Math.sin(yaw) * 7 * delta;
  const driftZ = -Math.cos(yaw) * 7 * delta;
  for (let index = 0; index < rainCount; index += 1) {
    const yIndex = index * 3 + 1;
    positions.array[yIndex] -= 29 * delta;
    positions.array[index * 3] += driftX;
    positions.array[index * 3 + 2] += driftZ;
    if (positions.array[yIndex] < 0) {
      positions.array[yIndex] = 85;
      positions.array[index * 3] = camera.position.x + (random() - 0.5) * worldSize;
      positions.array[index * 3 + 2] = camera.position.z + (random() - 0.5) * worldSize;
    }
  }
  positions.needsUpdate = true;
}

function updatePedestrians(delta, now) {
  for (const pedestrian of pedestrians) {
    if (!pedestrian.alive) continue;
    const dx = pedestrian.group.position.x - camera.position.x;
    const dz = pedestrian.group.position.z - camera.position.z;
    const distance = Math.hypot(dx, dz);
    if (weaponDrawn && distance < 24) pedestrian.fleeUntil = now + 2400;
    if (pedestrian.fleeUntil > now) {
      pedestrian.fleeing = true;
      const directionX = distance > 0.01 ? dx / distance : 1;
      const directionZ = distance > 0.01 ? dz / distance : 0;
      const step = 8.5 * delta;
      const nextX = THREE.MathUtils.clamp(pedestrian.group.position.x + directionX * step, -halfWorld + 3, halfWorld - 3);
      const nextZ = THREE.MathUtils.clamp(pedestrian.group.position.z + directionZ * step, -halfWorld + 3, halfWorld - 3);
      if (!collides(nextX, pedestrian.group.position.z)) pedestrian.group.position.x = nextX;
      if (!collides(pedestrian.group.position.x, nextZ)) pedestrian.group.position.z = nextZ;
      pedestrian.group.rotation.y = Math.atan2(-directionX, -directionZ);
      continue;
    }
    pedestrian.fleeing = false;
    const phase = now * 0.00055 + pedestrian.phase;
    pedestrian.group.position.x = pedestrian.x + Math.sin(phase) * 0.35;
    pedestrian.group.position.z = pedestrian.z + Math.cos(phase) * 0.35;
    pedestrian.group.rotation.y = Math.sin(phase * 0.7) * 0.6;
  }
}

function drawMap() {
  const w = minimap.width;
  const h = minimap.height;
  const centerX = camera.position.x;
  const centerZ = camera.position.z;
  const scale = Math.min(w, h) / (worldSize + 24);
  mapContext.clearRect(0, 0, w, h);
  mapContext.fillStyle = "rgba(8, 11, 20, .92)";
  mapContext.fillRect(0, 0, w, h);

  mapContext.save();
  mapContext.translate(w / 2, h / 2);
  mapContext.rotate(yaw);
  mapContext.translate(-centerX * scale, -centerZ * scale);

  mapContext.strokeStyle = "rgba(124, 132, 157, .28)";
  mapContext.lineWidth = 2.5;
  for (let road = -6; road <= 6; road += 1) {
    mapContext.beginPath();
    mapContext.moveTo(road * streetStep * scale, -h);
    mapContext.lineTo(road * streetStep * scale, h);
    mapContext.stroke();
    mapContext.beginPath();
    mapContext.moveTo(-w, road * streetStep * scale);
    mapContext.lineTo(w, road * streetStep * scale);
    mapContext.stroke();
  }

  mapContext.fillStyle = "rgba(97, 105, 129, .43)";
  for (const building of buildings) {
    mapContext.fillRect(
      building.minX * scale,
      building.minZ * scale,
      (building.maxX - building.minX) * scale,
      (building.maxZ - building.minZ) * scale,
    );
  }
  for (const relay of relays) {
    if (relay.completed) continue;
    mapContext.beginPath();
    mapContext.fillStyle = `#${relay.color.toString(16).padStart(6, "0")}`;
    mapContext.arc(relay.x * scale, relay.z * scale, 3.3, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.beginPath();
    mapContext.strokeStyle = `rgba(98, 244, 227, .48)`;
    mapContext.lineWidth = 1;
    mapContext.arc(relay.x * scale, relay.z * scale, 6, 0, Math.PI * 2);
    mapContext.stroke();
  }
  if (!tower.breached) {
    mapContext.beginPath();
    mapContext.fillStyle = tower.unlocked ? "#f45cba" : "#7d718b";
    mapContext.shadowBlur = tower.unlocked ? 7 : 0;
    mapContext.shadowColor = "#f45cba";
    mapContext.arc(tower.entryX * scale, tower.entryZ * scale, 4, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.shadowBlur = 0;
    mapContext.fillStyle = "#080a15";
    mapContext.font = "bold 6px monospace";
    mapContext.textAlign = "center";
    mapContext.fillText("H", tower.entryX * scale, tower.entryZ * scale + 2);
  }
  for (const pedestrian of pedestrians) {
    if (!pedestrian.alive) continue;
    mapContext.beginPath();
    mapContext.fillStyle = "#b8a8b7";
    mapContext.arc(pedestrian.group.position.x * scale, pedestrian.group.position.z * scale, 2.2, 0, Math.PI * 2);
    mapContext.fill();
  }
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    mapContext.beginPath();
    mapContext.fillStyle = "#ff477b";
    mapContext.shadowBlur = 7;
    mapContext.shadowColor = "#ff477b";
    mapContext.arc(enemy.group.position.x * scale, enemy.group.position.z * scale, 3.2, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.shadowBlur = 0;
  }
  mapContext.restore();

  mapContext.beginPath();
  mapContext.moveTo(w / 2, h / 2 - 6);
  mapContext.lineTo(w / 2 + 4, h / 2 + 5);
  mapContext.lineTo(w / 2, h / 2 + 3);
  mapContext.lineTo(w / 2 - 4, h / 2 + 5);
  mapContext.closePath();
  mapContext.fillStyle = "#f4f4f4";
  mapContext.shadowBlur = 8;
  mapContext.shadowColor = "#62f4e3";
  mapContext.fill();
  mapContext.shadowBlur = 0;

  const northX = Math.sin(yaw);
  const northY = -Math.cos(yaw);
  mapContext.fillStyle = "#62f4e3";
  mapContext.font = "8px monospace";
  mapContext.textAlign = "center";
  mapContext.fillText("N", w / 2 + northX * 15, h / 2 + northY * 15 + 3);
}

function updateInterface(delta, now) {
  cityTime += delta * 0.18;
  const hours = Math.floor(cityTime / 60) % 24;
  const minutes = Math.floor(cityTime) % 60;
  document.querySelector("#city-clock").textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  coordinates.innerHTML = `X ${String(Math.round(camera.position.x)).padStart(3, "0")} <span class="coord-separator">/</span> Z ${String(Math.round(camera.position.z)).padStart(3, "0")}`;
  if (now - mapFrame > 120) {
    drawMap();
    mapFrame = now;
  }
}

function animate(now = 0) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastFrame) / 1000 || 0, 0.05);
  lastFrame = now;
  updateMovement(delta);
  updateEnemies(delta, now);
  updateRagdolls(delta, now);
  updatePedestrians(delta, now);
  updateRelays(now);
  updateRain(delta);
  updateKnifeAndExplosions(now);
  scene.updateMatrixWorld(true);
  updateCombat(now);
  updateInterface(delta, now);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
});

updateQuestProgress();
animate();
