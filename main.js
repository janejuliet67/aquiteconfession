const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const musicToggle = document.getElementById("music-toggle");
const youtubeAudioHost = document.getElementById("youtube-audio-host");

const VIEW = { width: canvas.width, height: canvas.height };

const MENU_BUTTON = { x: 46, y: 188, width: 156, height: 40 };

const LETTER_TYPES = [
  {
    id: "red",
    color: "#d76874",
    text: "I understand you are mad, and its valid to be mad, i love you.",
  },
  {
    id: "blue",
    color: "#7399dd",
    text: "You can be sad around me. I am here for you. I love you.",
  },
  {
    id: "yellow",
    color: "#e3c65f",
    text: "You are allowed to rest before everything is solved. You arent alone",
  },
  {
    id: "dark-red",
    color: "#7b3d48",
    text: "When your body hurts, I want to be gentler with you, i love you my pretty love.",
  },
];

const FINAL_PAGES = [
  "Razane,\n\nI love you because being close to you feels honest. Nothing about you feels fake to me. You feel real, and that matters more to me than perfection ever could.",
  "I love you when you're angry, because its a valid emotion that you should feel from time to time. I love you when you're sad, because you never need to perform being okay for me but instead comforted enough to be sad around me . I love you when you're stressed, because I still see how hard you keep trying and never gave up.",
  "And when you're on your period and everything feels heavier, I do not think you're too much. I do not think you're difficult. instead i want to be there until the pain goes away.",
  "I love the version of you that exists on ordinary days and on hard days. Not a polished version. Not a quieter version. Just you and for that i always will love you, my dear razane .",
];

const SOUNDTRACK = {
  videoId: "8ya9EhvcNsA",
  embedOrigin: "https://www.youtube.com",
  embedSrc:
    "https://www.youtube.com/embed/8ya9EhvcNsA?autoplay=1&loop=1&playlist=8ya9EhvcNsA&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&enablejsapi=1",
};

const garden = createGarden();
const room = createRoom();

const state = {
  scene: "menu",
  collected: new Set(),
  roomUnlocked: false,
  overlay: {
    text: "",
    timer: 0,
  },
  interactQueued: false,
  messageOpen: false,
  messagePage: 0,
  fade: {
    active: false,
    alpha: 0,
    direction: 1,
    nextScene: "menu",
    onMidpoint: null,
  },
  menuHover: false,
};

const player = {
  x: garden.spawn.x,
  y: garden.spawn.y,
  facing: "up",
  moving: false,
  walkTime: 0,
  speed: 118,
};

const camera = {
  x: 0,
  y: 0,
};

const pointer = {
  x: 0,
  y: 0,
  active: false,
};

const RAZANE_POSE = {
  drawScale: 0.15,
  version: 3,
};

const razanePoseSources = {
  down: `./assets/razane-right-exact.png?v=${RAZANE_POSE.version}`,
  up: `./assets/razane-left-exact.png?v=${RAZANE_POSE.version}`,
  left: `./assets/razane-front-exact.png?v=${RAZANE_POSE.version}`,
  right: `./assets/razane-back-exact.png?v=${RAZANE_POSE.version}`,
};

const razanePoses = {};
const music = {
  iframe: null,
  ready: false,
  playing: false,
  shouldPlay: false,
};

for (const [direction, src] of Object.entries(razanePoseSources)) {
  const image = new Image();
  image.addEventListener("load", () => {
    razanePoses[direction] = image;
  });
  image.addEventListener("error", () => {
    console.error(`Razane ${direction} pose could not be loaded.`);
  });
  image.src = src;
  if (image.complete && image.naturalWidth > 0) {
    razanePoses[direction] = image;
  }
}

if (musicToggle) {
  musicToggle.addEventListener("click", (event) => {
    event.preventDefault();
    toggleSoundtrack();
  });
}

updateMusicToggle();

let lastTime = 0;
const keys = new Set();

requestAnimationFrame(tick);

function createGarden() {
  const width = 1240;
  const height = 920;
  const spawn = { x: width / 2, y: 676 };

  const trees = [
    { x: 152, y: 162, r: 34 },
    { x: 306, y: 126, r: 38 },
    { x: 470, y: 170, r: 34 },
    { x: 760, y: 126, r: 38 },
    { x: 960, y: 174, r: 34 },
    { x: 1092, y: 148, r: 34 },
    { x: 168, y: 448, r: 38 },
    { x: 1002, y: 440, r: 42 },
    { x: 238, y: 722, r: 34 },
    { x: 980, y: 756, r: 38 },
  ];

  const flowers = [];
  for (let i = 0; i < 220; i += 1) {
    flowers.push({
      x: randomRange(34, width - 34),
      y: randomRange(42, height - 28),
      color: pick(["#f2c9d5", "#d7cdf5", "#f5e2a2", "#cde7cd", "#c7dcf4"]),
      sway: Math.random() * Math.PI * 2,
    });
  }

  const grasses = [];
  for (let i = 0; i < 260; i += 1) {
    grasses.push({
      x: randomRange(22, width - 22),
      y: randomRange(30, height - 18),
      sway: Math.random() * Math.PI * 2,
    });
  }

  const stones = [];
  for (let i = 0; i < 34; i += 1) {
    stones.push({
      x: randomRange(40, width - 40),
      y: randomRange(70, height - 30),
      w: randomRange(6, 12),
      h: randomRange(3, 6),
    });
  }

  const bench = { x: 620, y: 312, width: 92, height: 20 };

  const obstacles = trees.map((tree) => ({
    x: tree.x - 16,
    y: tree.y + 12,
    width: 32,
    height: 22,
  }));

  obstacles.push({
    x: bench.x - bench.width / 2,
    y: bench.y - 4,
    width: bench.width,
    height: 14,
  });

  return {
    width,
    height,
    spawn,
    trees,
    flowers,
    grasses,
    stones,
    bench,
    obstacles,
    letters: [],
  };
}

function createRoom() {
  return {
    bounds: { x: 30, y: 22, width: VIEW.width - 60, height: VIEW.height - 44 },
    door: { x: 56, y: 170, width: 38, height: 64 },
    bed: { x: 68, y: 108, width: 104, height: 54 },
    desk: { x: 282, y: 100, width: 112, height: 44 },
    shelf: { x: 300, y: 56, width: 86, height: 18 },
    window: { x: 80, y: 48, width: 52, height: 38 },
    plant: { x: 384, y: 198, width: 20, height: 26 },
    rainbowLetter: { x: 344, y: 182 },
    playerSpawn: { x: 144, y: 198 },
  };
}

function startNewGame() {
  ensureSoundtrackStarted();
  state.collected = new Set();
  state.roomUnlocked = false;
  state.messageOpen = false;
  state.messagePage = 0;
  garden.letters = spawnLetters(garden.obstacles);
  placePlayerInGarden();
  showOverlay("Collect the four letters in the garden.", 3.6);
  beginTransition("garden", () => {
    placePlayerInGarden();
  });
}

function placePlayerInGarden() {
  player.x = garden.spawn.x;
  player.y = garden.spawn.y;
  player.facing = "up";
  player.moving = false;
  player.walkTime = 0;
  syncCameraToPlayer();
}

function placePlayerInRoom() {
  player.x = room.playerSpawn.x;
  player.y = room.playerSpawn.y;
  player.facing = "right";
  player.moving = false;
  player.walkTime = 0;
}

function spawnLetters(obstacles) {
  const letters = [];

  for (const type of LETTER_TYPES) {
    let letter = null;

    for (let attempt = 0; attempt < 600; attempt += 1) {
      const x = randomRange(64, garden.width - 64);
      const y = randomRange(76, garden.height - 90);
      const rect = rectFromCenter(x, y, 24, 20);
      const nearSpawn = distance(x, y, garden.spawn.x, garden.spawn.y) < 136;
      const blocked = obstacles.some((obstacle) => overlaps(rect, obstacle));
      const nearOther = letters.some((item) => distance(x, y, item.x, item.y) < 106);

      if (!nearSpawn && !blocked && !nearOther) {
        letter = {
          ...type,
          x,
          y,
          bob: Math.random() * Math.PI * 2,
          collected: false,
        };
        break;
      }
    }

    letters.push(
      letter || {
        ...type,
        x: 280 + letters.length * 90,
        y: 260 + letters.length * 44,
        bob: Math.random() * Math.PI * 2,
        collected: false,
      },
    );
  }

  return letters;
}

function tick(time) {
  const delta = Math.min(0.032, (time - lastTime) / 1000 || 0);
  lastTime = time;

  updateOverlay(delta);

  if (state.scene === "menu") {
    updateMenu();
  } else if (state.scene === "garden") {
    updateGarden(delta);
  } else {
    updateRoom(delta);
  }

  updateFade(delta);
  drawScene(time);
  state.interactQueued = false;
  requestAnimationFrame(tick);
}

function updateMenu() {
  state.menuHover = pointer.active && pointInRect(pointer.x, pointer.y, MENU_BUTTON);

  if (state.interactQueued) {
    startNewGame();
  }
}

function updateGarden(delta) {
  movePlayerGarden(delta);
  syncCameraToPlayer();

  const interactionRect = rectFromCenter(player.x, player.y - 10, 32, 30);
  for (const letter of garden.letters) {
    if (letter.collected) {
      continue;
    }

    const letterRect = rectFromCenter(letter.x, letter.y, 20, 16);
    if (overlaps(interactionRect, letterRect)) {
      letter.collected = true;
      state.collected.add(letter.id);
      showOverlay(letter.text, 4.2);
    }
  }

  if (state.collected.size === LETTER_TYPES.length && !state.roomUnlocked && !state.fade.active) {
    state.roomUnlocked = true;
    showOverlay("The garden softens. A white room opens somewhere ahead.", 2.8);
    beginTransition("room", placePlayerInRoom);
  }
}

function updateRoom(delta) {
  if (!state.messageOpen) {
    movePlayerRoom(delta);
  }

  if (!state.interactQueued) {
    return;
  }

  if (state.messageOpen) {
    advanceMessage();
    return;
  }

  if (isNearRainbowLetter()) {
    state.messageOpen = true;
    state.messagePage = 0;
    return;
  }

  if (isNearRoomDoor()) {
    showOverlay("The garden is still waiting outside.", 2.4);
    beginTransition("garden", placePlayerInGarden);
  }
}

function movePlayerGarden(delta) {
  const move = getMovementInput();
  player.moving = move.x !== 0 || move.y !== 0;

  if (!player.moving) {
    return;
  }

  const length = Math.hypot(move.x, move.y) || 1;
  const stepX = (move.x / length) * player.speed * delta;
  const stepY = (move.y / length) * player.speed * delta;

  let nextX = clamp(player.x + stepX, 28, garden.width - 28);
  let nextY = player.y;

  if (garden.obstacles.some((obstacle) => overlaps(playerFeetRect(nextX, nextY), obstacle))) {
    nextX = player.x;
  }

  nextY = clamp(player.y + stepY, 28, garden.height - 18);
  if (garden.obstacles.some((obstacle) => overlaps(playerFeetRect(nextX, nextY), obstacle))) {
    nextY = player.y;
  }

  player.x = nextX;
  player.y = nextY;
  player.walkTime += delta * 9;
}

function movePlayerRoom(delta) {
  const move = getMovementInput();
  player.moving = move.x !== 0 || move.y !== 0;

  if (!player.moving) {
    return;
  }

  const length = Math.hypot(move.x, move.y) || 1;
  const stepX = (move.x / length) * player.speed * delta;
  const stepY = (move.y / length) * player.speed * delta;

  const obstacles = getRoomObstacles();
  let nextX = clamp(player.x + stepX, room.bounds.x + 14, room.bounds.x + room.bounds.width - 14);
  let nextY = player.y;

  if (obstacles.some((obstacle) => overlaps(playerFeetRect(nextX, nextY), obstacle))) {
    nextX = player.x;
  }

  nextY = clamp(player.y + stepY, room.bounds.y + 20, room.bounds.y + room.bounds.height - 12);
  if (obstacles.some((obstacle) => overlaps(playerFeetRect(nextX, nextY), obstacle))) {
    nextY = player.y;
  }

  player.x = nextX;
  player.y = nextY;
  player.walkTime += delta * 9;
}

function getRoomObstacles() {
  return [
    {
      x: room.bed.x - 8,
      y: room.bed.y + 6,
      width: room.bed.width + 16,
      height: room.bed.height - 8,
    },
    {
      x: room.desk.x - 4,
      y: room.desk.y + 8,
      width: room.desk.width + 8,
      height: room.desk.height - 8,
    },
    {
      x: room.plant.x - 4,
      y: room.plant.y + 6,
      width: room.plant.width + 8,
      height: room.plant.height,
    },
  ];
}

function getMovementInput() {
  let x = 0;
  let y = 0;

  if (keys.has("arrowup") || keys.has("w")) {
    y -= 1;
    player.facing = "up";
  }
  if (keys.has("arrowdown") || keys.has("s")) {
    y += 1;
    player.facing = "down";
  }
  if (keys.has("arrowleft") || keys.has("a")) {
    x -= 1;
    player.facing = "left";
  }
  if (keys.has("arrowright") || keys.has("d")) {
    x += 1;
    player.facing = "right";
  }

  return { x, y };
}

function syncCameraToPlayer() {
  camera.x = clamp(player.x - VIEW.width / 2, 0, garden.width - VIEW.width);
  camera.y = clamp(player.y - VIEW.height / 2, 0, garden.height - VIEW.height);
}

function drawScene(time) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);

  if (state.scene === "menu") {
    drawMenu(time);
  } else if (state.scene === "garden") {
    drawGarden(time);
  } else {
    drawRoom(time);
  }

  if (state.scene !== "menu") {
    drawHud();
    drawOverlay();
  }

  drawFade();
}

function drawMenu(time) {
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  bg.addColorStop(0, "#f1eee5");
  bg.addColorStop(1, "#d9e3d2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  for (let i = 0; i < 7; i += 1) {
    const x = 34 + i * 66 + Math.sin(time * 0.001 + i) * 8;
    const y = 28 + (i % 3) * 26 + Math.cos(time * 0.0012 + i) * 6;
    drawFloatingEnvelope(x, y, LETTER_TYPES[i % LETTER_TYPES.length].color, 0.8);
  }

  ctx.fillStyle = "rgba(255,255,255,0.66)";
  roundRect(28, 26, 230, 190, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(115, 102, 94, 0.18)";
  ctx.lineWidth = 1.5;
  roundRect(28, 26, 230, 190, 22);
  ctx.stroke();

  ctx.fillStyle = "#463736";
  ctx.font = "bold 25px Georgia";
  ctx.fillText("Letters For", 50, 76);
  ctx.fillText("Razane", 50, 104);

  ctx.fillStyle = "#675453";
  ctx.font = "12px Trebuchet MS";
  wrapText(
    "A quiet little exploration game. Gather four letters in the garden, then step into the white room and read the rainbow one.",
    50,
    128,
    182,
    16,
  );

  ctx.fillStyle = state.menuHover ? "#7b3d48" : "#8a4b56";
  roundRect(MENU_BUTTON.x, MENU_BUTTON.y, MENU_BUTTON.width, MENU_BUTTON.height, 14);
  ctx.fill();
  ctx.fillStyle = "#fff7f1";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("Start", MENU_BUTTON.x + 58, MENU_BUTTON.y + 24);

  ctx.fillStyle = "#7a6a67";
  ctx.font = "11px Trebuchet MS";
  ctx.fillText("Press Enter, E, or Space", 54, 244);

  ctx.save();
  ctx.translate(342, 174 + Math.sin(time * 0.0023) * 3);
  ctx.fillStyle = "rgba(126, 93, 98, 0.12)";
  ctx.beginPath();
  ctx.ellipse(0, 42, 48, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  drawRazane(0, 0, 2.25, "right", time * 0.01, false);
  ctx.restore();
}

function drawGarden(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, "#eef3ea");
  sky.addColorStop(1, "#d7e0cf");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  const ground = ctx.createLinearGradient(0, 0, 0, garden.height);
  ground.addColorStop(0, "#c7d7b8");
  ground.addColorStop(1, "#b4c7a3");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, garden.width, garden.height);

  ctx.fillStyle = "#dfe9d2";
  ctx.fillRect(0, 0, garden.width, 82);

  drawGardenPath();
  drawGardenGrass(time);
  drawGardenFlowers(time);
  drawGardenStones();
  drawGardenTrees();
  drawGardenBench();
  drawGardenEntrance();
  drawGardenLetters(time);
  drawRazane(player.x, player.y, 1, player.facing, player.walkTime, player.moving);
  ctx.restore();
}

function drawGardenPath() {
  ctx.fillStyle = "#e6e1d4";
  ctx.beginPath();
  ctx.moveTo(garden.spawn.x - 48, garden.height);
  ctx.bezierCurveTo(garden.spawn.x - 42, 786, 520, 724, 560, 642);
  ctx.bezierCurveTo(604, 550, 642, 480, 648, 388);
  ctx.bezierCurveTo(654, 292, 626, 224, 604, 132);
  ctx.lineTo(674, 132);
  ctx.bezierCurveTo(692, 220, 722, 298, 716, 390);
  ctx.bezierCurveTo(710, 484, 672, 562, 628, 650);
  ctx.bezierCurveTo(592, 726, 586, 794, 602, garden.height);
  ctx.closePath();
  ctx.fill();
}

function drawGardenGrass(time) {
  ctx.strokeStyle = "#6f9467";
  ctx.lineWidth = 1;
  for (const blade of garden.grasses) {
    const sway = Math.sin(time * 0.0018 + blade.sway) * 1.9;
    ctx.beginPath();
    ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(blade.x + sway, blade.y - 5, blade.x + sway, blade.y - 10);
    ctx.stroke();
  }
}

function drawGardenFlowers(time) {
  for (const flower of garden.flowers) {
    const sway = Math.sin(time * 0.0025 + flower.sway) * 1.2;
    ctx.strokeStyle = "#719567";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(flower.x, flower.y);
    ctx.lineTo(flower.x + sway, flower.y - 7);
    ctx.stroke();
    ctx.fillStyle = flower.color;
    ctx.beginPath();
    ctx.arc(flower.x + sway, flower.y - 8, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGardenStones() {
  ctx.fillStyle = "#bcc5ba";
  for (const stone of garden.stones) {
    roundRect(stone.x, stone.y, stone.w, stone.h, 3);
    ctx.fill();
  }
}

function drawGardenTrees() {
  for (const tree of garden.trees) {
    ctx.fillStyle = "#7a5c49";
    ctx.fillRect(tree.x - 7, tree.y + 10, 14, 28);

    ctx.fillStyle = "#dce9ce";
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.72, tree.y + 6, tree.r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tree.x + tree.r * 0.72, tree.y + 6, tree.r * 0.66, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGardenBench() {
  const bench = garden.bench;
  ctx.fillStyle = "#916f5c";
  ctx.fillRect(bench.x - bench.width / 2, bench.y - 10, bench.width, 7);
  ctx.fillRect(bench.x - bench.width / 2 + 5, bench.y - 1, bench.width - 10, 6);
  ctx.fillRect(bench.x - bench.width / 2 + 8, bench.y + 4, 5, 15);
  ctx.fillRect(bench.x + bench.width / 2 - 13, bench.y + 4, 5, 15);
}

function drawGardenEntrance() {
  ctx.fillStyle = "#f2ede4";
  roundRect(garden.spawn.x - 30, garden.spawn.y + 18, 60, 24, 6);
  ctx.fill();
  ctx.fillStyle = "#a68f7f";
  roundRect(garden.spawn.x - 18, garden.spawn.y + 24, 36, 14, 5);
  ctx.fill();
}

function drawGardenLetters(time) {
  for (const letter of garden.letters) {
    if (letter.collected) {
      continue;
    }

    const bob = Math.sin(time * 0.004 + letter.bob) * 3;
    drawFloatingEnvelope(letter.x, letter.y + bob, letter.color, 1);
  }
}

function drawFloatingEnvelope(x, y, sealColor, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = `${sealColor}55`;
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#fffef8";
  roundRect(-12, -10, 24, 18, 5);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "#d8cfc3";
  ctx.lineWidth = 1;
  roundRect(-12, -10, 24, 18, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(0, 0.5);
  ctx.lineTo(12, -10);
  ctx.stroke();

  ctx.fillStyle = sealColor;
  ctx.beginPath();
  ctx.arc(0, 2.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoom(time) {
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#f2f2f2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.fillStyle = "#fbfbfb";
  roundRect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height, 22);
  ctx.fill();
  ctx.strokeStyle = "#d7d7d7";
  ctx.lineWidth = 2;
  roundRect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height, 22);
  ctx.stroke();

  ctx.fillStyle = "#efefef";
  ctx.fillRect(room.bounds.x, room.bounds.y + room.bounds.height - 46, room.bounds.width, 36);

  drawRoomWindow();
  drawRoomBed();
  drawRoomDesk();
  drawRoomShelf();
  drawRoomPlant();
  drawRoomDoor();
  drawRainbowLetter(time);
  drawRazane(player.x, player.y, 1, player.facing, player.walkTime, player.moving);

  if (!state.messageOpen) {
    if (isNearRainbowLetter()) {
      drawPromptCard("Press E or Space to read", 268, 28, 178);
    } else if (isNearRoomDoor()) {
      drawPromptCard("Press E or Space to return", 252, 28, 194);
    }
  }

  if (state.messageOpen) {
    drawMessageCard();
  }
}

function drawRoomWindow() {
  ctx.fillStyle = "#ffffff";
  roundRect(room.window.x, room.window.y, room.window.width, room.window.height, 10);
  ctx.fill();
  ctx.strokeStyle = "#d2d2d2";
  ctx.lineWidth = 2;
  roundRect(room.window.x, room.window.y, room.window.width, room.window.height, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(room.window.x + room.window.width / 2, room.window.y);
  ctx.lineTo(room.window.x + room.window.width / 2, room.window.y + room.window.height);
  ctx.moveTo(room.window.x, room.window.y + room.window.height / 2);
  ctx.lineTo(room.window.x + room.window.width, room.window.y + room.window.height / 2);
  ctx.stroke();
}

function drawRoomBed() {
  ctx.fillStyle = "#ffffff";
  roundRect(room.bed.x, room.bed.y, room.bed.width, room.bed.height, 14);
  ctx.fill();
  ctx.strokeStyle = "#d2d2d2";
  ctx.lineWidth = 2;
  roundRect(room.bed.x, room.bed.y, room.bed.width, room.bed.height, 14);
  ctx.stroke();
  ctx.fillStyle = "#f4f4f4";
  roundRect(room.bed.x + 10, room.bed.y + 10, room.bed.width - 20, room.bed.height - 18, 12);
  ctx.fill();
}

function drawRoomDesk() {
  ctx.fillStyle = "#ffffff";
  roundRect(room.desk.x, room.desk.y, room.desk.width, room.desk.height, 12);
  ctx.fill();
  ctx.strokeStyle = "#d2d2d2";
  ctx.lineWidth = 2;
  roundRect(room.desk.x, room.desk.y, room.desk.width, room.desk.height, 12);
  ctx.stroke();

  ctx.fillStyle = "#efefef";
  roundRect(room.desk.x + 14, room.desk.y + 10, 34, 22, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(room.desk.x + 78, room.desk.y + 22, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawRoomShelf() {
  ctx.fillStyle = "#ffffff";
  roundRect(room.shelf.x, room.shelf.y, room.shelf.width, room.shelf.height, 8);
  ctx.fill();
  ctx.strokeStyle = "#d2d2d2";
  ctx.lineWidth = 2;
  roundRect(room.shelf.x, room.shelf.y, room.shelf.width, room.shelf.height, 8);
  ctx.stroke();

  ctx.fillStyle = "#cbc7c6";
  ctx.fillRect(room.shelf.x + 12, room.shelf.y - 10, 8, 10);
  ctx.fillRect(room.shelf.x + 24, room.shelf.y - 14, 10, 14);
  ctx.fillRect(room.shelf.x + 38, room.shelf.y - 8, 7, 8);
}

function drawRoomPlant() {
  ctx.fillStyle = "#ffffff";
  roundRect(room.plant.x + 2, room.plant.y + 12, 16, 12, 5);
  ctx.fill();
  ctx.strokeStyle = "#d2d2d2";
  ctx.lineWidth = 2;
  roundRect(room.plant.x + 2, room.plant.y + 12, 16, 12, 5);
  ctx.stroke();
  ctx.fillStyle = "#b7d8b4";
  ctx.beginPath();
  ctx.ellipse(room.plant.x + 7, room.plant.y + 10, 6, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(room.plant.x + 14, room.plant.y + 8, 6, 13, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoomDoor() {
  ctx.fillStyle = "#ffffff";
  roundRect(room.door.x, room.door.y, room.door.width, room.door.height, 10);
  ctx.fill();
  ctx.strokeStyle = "#d2d2d2";
  ctx.lineWidth = 2;
  roundRect(room.door.x, room.door.y, room.door.width, room.door.height, 10);
  ctx.stroke();
  ctx.strokeRect(room.door.x + 8, room.door.y + 12, room.door.width - 16, room.door.height - 24);
  ctx.beginPath();
  ctx.arc(room.door.x + room.door.width - 9, room.door.y + room.door.height / 2, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#b9b1ad";
  ctx.fill();
}

function drawRainbowLetter(time) {
  const bob = Math.sin(time * 0.0042) * 2.5;
  ctx.save();
  ctx.translate(room.rainbowLetter.x, room.rainbowLetter.y + bob);

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  roundRect(-12, -10, 24, 18, 5);
  ctx.fill();
  ctx.strokeStyle = "#d3d3d3";
  ctx.lineWidth = 1;
  roundRect(-12, -10, 24, 18, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(0, 1);
  ctx.lineTo(12, -10);
  ctx.stroke();

  const rainbow = ctx.createLinearGradient(-9, -9, 9, -9);
  rainbow.addColorStop(0, "#f27c7c");
  rainbow.addColorStop(0.33, "#f1d06c");
  rainbow.addColorStop(0.66, "#8cc2f0");
  rainbow.addColorStop(1, "#bb8de8");
  ctx.fillStyle = rainbow;
  ctx.fillRect(-9, -10, 18, 4);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRazane(x, y, scale, facing, walkTime, moving) {
  const bounce = moving ? Math.sin(walkTime) * 1.2 : 0;
  const pose = getRazanePoseCanvas(facing);

  if (!pose) {
    return;
  }

  const drawWidth = Math.round(pose.width * RAZANE_POSE.drawScale * scale);
  const drawHeight = Math.round(pose.height * RAZANE_POSE.drawScale * scale);

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bounce));
  ctx.fillStyle = "rgba(0,0,0,0.11)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 12 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pose, Math.round(-drawWidth / 2), Math.round(-drawHeight + 10), drawWidth, drawHeight);
  ctx.imageSmoothingEnabled = true;

  ctx.restore();
}

function getRazanePoseCanvas(facing) {
  if (facing === "up") {
    return razanePoses.up || razanePoses.down || null;
  }

  if (facing === "left") {
    return razanePoses.left || razanePoses.down || null;
  }

  if (facing === "right") {
    return razanePoses.right || razanePoses.down || null;
  }

  return razanePoses.down || null;
}

function ensureSoundtrackStarted() {
  if (music.iframe) {
    return;
  }

  if (!youtubeAudioHost) {
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.width = "1";
  iframe.height = "1";
  iframe.title = "Letters for Razane soundtrack";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src = SOUNDTRACK.embedSrc;

  iframe.addEventListener("load", () => {
    music.ready = true;
    window.setTimeout(() => {
      if (music.shouldPlay) {
        sendSoundtrackCommand("playVideo");
        music.playing = true;
      }
      updateMusicToggle();
    }, 250);
  });

  youtubeAudioHost.replaceChildren(iframe);
  music.iframe = iframe;
  music.shouldPlay = true;
  music.playing = true;
  updateMusicToggle();
}

function toggleSoundtrack() {
  if (!music.iframe) {
    ensureSoundtrackStarted();
    return;
  }

  if (music.playing) {
    pauseSoundtrack();
    return;
  }

  playSoundtrack();
}

function playSoundtrack() {
  ensureSoundtrackStarted();
  music.shouldPlay = true;

  if (music.ready) {
    sendSoundtrackCommand("playVideo");
  }

  music.playing = true;
  updateMusicToggle();
}

function pauseSoundtrack() {
  if (!music.iframe) {
    return;
  }

  music.shouldPlay = false;

  if (music.ready) {
    sendSoundtrackCommand("pauseVideo");
  }

  music.playing = false;
  updateMusicToggle();
}

function sendSoundtrackCommand(func) {
  if (!music.iframe?.contentWindow) {
    return;
  }

  music.iframe.contentWindow.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args: [],
    }),
    SOUNDTRACK.embedOrigin,
  );
}

function updateMusicToggle() {
  if (!musicToggle) {
    return;
  }

  if (!music.iframe) {
    musicToggle.textContent = "Music: Start";
    return;
  }

  musicToggle.textContent = music.playing ? "Music: On" : "Music: Off";
}

function drawHud() {
  ctx.fillStyle = "rgba(18, 21, 29, 0.76)";
  roundRect(12, 10, 186, 48, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 245, 232, 0.12)";
  ctx.lineWidth = 1;
  roundRect(12, 10, 186, 48, 14);
  ctx.stroke();

  ctx.fillStyle = "#fff5e8";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText("Letters", 24, 29);
  ctx.fillText(`${state.collected.size}/4`, 152, 29);

  LETTER_TYPES.forEach((letter, index) => {
    const x = 22 + index * 40;
    const y = 38;
    ctx.fillStyle = state.collected.has(letter.id) ? letter.color : "#8a7c78";
    roundRect(x, y, 16, 10, 4);
    ctx.fill();
  });
}

function drawOverlay() {
  if (state.overlay.timer <= 0 || !state.overlay.text) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = Math.min(1, state.overlay.timer);
  ctx.fillStyle = "rgba(18, 21, 29, 0.84)";
  roundRect(20, VIEW.height - 56, VIEW.width - 40, 36, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 245, 232, 0.14)";
  ctx.lineWidth = 1;
  roundRect(20, VIEW.height - 56, VIEW.width - 40, 36, 14);
  ctx.stroke();
  ctx.fillStyle = "#fff5e8";
  ctx.font = "11px Trebuchet MS";
  wrapText(state.overlay.text, 32, VIEW.height - 34, VIEW.width - 64, 14);
  ctx.restore();
}

function drawPromptCard(text, x, y, width) {
  ctx.fillStyle = "rgba(18, 21, 29, 0.8)";
  roundRect(x, y, width, 24, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 245, 232, 0.12)";
  ctx.lineWidth = 1;
  roundRect(x, y, width, 24, 10);
  ctx.stroke();
  ctx.fillStyle = "#fff5e8";
  ctx.font = "11px Trebuchet MS";
  ctx.fillText(text, x + 12, y + 16);
}

function drawMessageCard() {
  ctx.fillStyle = "rgba(10, 10, 11, 0.54)";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.fillStyle = "#ffffff";
  roundRect(34, 22, VIEW.width - 68, VIEW.height - 44, 18);
  ctx.fill();
  ctx.strokeStyle = "#d5d5d5";
  ctx.lineWidth = 2;
  roundRect(34, 22, VIEW.width - 68, VIEW.height - 44, 18);
  ctx.stroke();

  ctx.fillStyle = "#3a302f";
  ctx.font = "bold 13px Georgia";
  ctx.fillText("Rainbow Letter", 52, 46);

  ctx.fillStyle = "#564a48";
  ctx.font = "10px Trebuchet MS";
  ctx.fillText(`Page ${state.messagePage + 1} / ${FINAL_PAGES.length}`, VIEW.width - 132, 46);

  ctx.fillStyle = "#332b29";
  ctx.font = "11px Trebuchet MS";
  wrapText(FINAL_PAGES[state.messagePage], 52, 72, VIEW.width - 104, 15);

  ctx.fillStyle = "#7d6f6a";
  ctx.font = "10px Trebuchet MS";
  const footer =
    state.messagePage < FINAL_PAGES.length - 1
      ? "Press E or Space for the next page"
      : "Press E or Space to close";
  ctx.fillText(footer, 52, VIEW.height - 28);
}

function updateOverlay(delta) {
  if (state.overlay.timer > 0) {
    state.overlay.timer = Math.max(0, state.overlay.timer - delta);
  }
}

function showOverlay(text, duration) {
  state.overlay.text = text;
  state.overlay.timer = duration;
}

function beginTransition(nextScene, onMidpoint) {
  state.fade.active = true;
  state.fade.alpha = 0;
  state.fade.direction = 1;
  state.fade.nextScene = nextScene;
  state.fade.onMidpoint = onMidpoint;
}

function updateFade(delta) {
  if (!state.fade.active) {
    return;
  }

  state.fade.alpha += delta * 1.2 * state.fade.direction;

  if (state.fade.direction === 1 && state.fade.alpha >= 1) {
    state.fade.alpha = 1;
    if (typeof state.fade.onMidpoint === "function") {
      state.fade.onMidpoint();
    }
    state.scene = state.fade.nextScene;
    state.fade.direction = -1;
  } else if (state.fade.direction === -1 && state.fade.alpha <= 0) {
    state.fade.alpha = 0;
    state.fade.active = false;
    state.fade.onMidpoint = null;
  }
}

function drawFade() {
  if (!state.fade.active && state.fade.alpha <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = state.fade.alpha;
  ctx.fillStyle = "#fffdfa";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.restore();
}

function advanceMessage() {
  if (state.messagePage < FINAL_PAGES.length - 1) {
    state.messagePage += 1;
  } else {
    state.messageOpen = false;
    state.messagePage = 0;
  }
}

function isNearRainbowLetter() {
  return distance(player.x, player.y - 8, room.rainbowLetter.x, room.rainbowLetter.y) < 28;
}

function isNearRoomDoor() {
  return distance(
    player.x,
    player.y + 4,
    room.door.x + room.door.width / 2,
    room.door.y + room.door.height - 6,
  ) < 28;
}

function playerFeetRect(x, y) {
  return {
    x: x - 9,
    y: y + 8,
    width: 18,
    height: 10,
  };
}

function rectFromCenter(x, y, width, height) {
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
  };
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const paragraphs = text.split("\n");
  let cursorY = y;

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      cursorY += lineHeight;
      continue;
    }

    const words = paragraph.split(" ");
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }

    if (line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
    y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
  };
}

window.addEventListener("keydown", (event) => {
  ensureSoundtrackStarted();
  const key = event.key.toLowerCase();
  keys.add(key);

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e", " ", "enter"].includes(key)) {
    event.preventDefault();
  }

  if (key === "e" || key === " " || key === "enter") {
    state.interactQueued = true;
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  state.interactQueued = false;
  pointer.active = false;
});

canvas.addEventListener("mousemove", (event) => {
  const point = canvasPoint(event);
  pointer.x = point.x;
  pointer.y = point.y;
  pointer.active = true;
});

canvas.addEventListener("mouseleave", () => {
  pointer.active = false;
});

canvas.addEventListener("click", (event) => {
  ensureSoundtrackStarted();
  const point = canvasPoint(event);

  if (state.scene === "menu" && pointInRect(point.x, point.y, MENU_BUTTON)) {
    startNewGame();
    return;
  }

  if (state.scene === "room" && state.messageOpen) {
    advanceMessage();
  }
});
