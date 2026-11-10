"use strict";

// ==========================================
// DINO RUN - METEOR ESCAPE
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const statusElement = document.getElementById("status");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayLabel = document.getElementById("overlayLabel");
const overlayDescription = document.getElementById("overlayDescription");
const startButton = document.getElementById("startButton");

// ==========================================
// CONFIGURATION
// ==========================================

const W = 900;
const H = 360;
const GROUND = 292;

const GRAVITY = 1700;
const JUMP_FORCE = -650;

const INITIAL_SPEED = 350;
const MAX_SPEED = 650;

let gameState = "menu";

let score = 0;
let best = loadBest();

let speed = INITIAL_SPEED;
let elapsed = 0;
let spawnTimer = 1.5;

let groundOffset = 0;
let sceneryOffset = 0;

let lastTime = 0;

let meteors = [];
let particles = [];

// ==========================================
// UTILITIES
// ==========================================

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatScore(value) {
  return String(Math.floor(value)).padStart(5, "0");
}

function loadBest() {
  try {
    return Number(localStorage.getItem("dinoMeteorBest")) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem("dinoMeteorBest", String(best));
  } catch {
    // Storage tidak wajib untuk permainan.
  }
}

// ==========================================
// PIXEL SPRITE
// ==========================================

function drawSprite(pattern, x, y, pixelSize, palette) {
  for (let row = 0; row < pattern.length; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      const index = Number(pattern[row][col]);

      if (index === 0) continue;

      ctx.fillStyle = palette[index];

      ctx.fillRect(
        Math.round(x + col * pixelSize),
        Math.round(y + row * pixelSize),
        pixelSize,
        pixelSize,
      );
    }
  }
}

// ==========================================
// DINOSAUR
// ==========================================

const DINO_PALETTE = {
  1: "#416b3d",
  2: "#79b957",
  3: "#a5df70",
  4: "#c6ed91",
  5: "#25332b",
  6: "#f2f0d5",
  7: "#b2d77c",
};

// 18 columns x 16 rows
const DINO_RUN_1 = [
  "000000000000011111",
  "000000000001222222",
  "000000000012333333",
  "000000000012333333",
  "000000000012335533",
  "000000000012333333",
  "000000000001222222",
  "000001111111111000",
  "000112222333221100",
  "001223333333221100",
  "012333333333221100",
  "122333333333221100",
  "122233333333221100",
  "011122222222111100",
  "000011100011100000",
  "000011100011100000",
];

const DINO_RUN_2 = [
  "000000000000011111",
  "000000000001222222",
  "000000000012333333",
  "000000000012333333",
  "000000000012335533",
  "000000000012333333",
  "000000000001222222",
  "000001111111111000",
  "000112222333221100",
  "001223333333221100",
  "012333333333221100",
  "122333333333221100",
  "122233333333221100",
  "011122222222111100",
  "000000110000011100",
  "000000110000011100",
];

const DINO_JUMP = [
  "000000000000011111",
  "000000000001222222",
  "000000000012333333",
  "000000000012333333",
  "000000000012335533",
  "000000000012333333",
  "000000000001222222",
  "000001111111111000",
  "000112222333221100",
  "001223333333221100",
  "012333333333221100",
  "122333333333221100",
  "122233333333221100",
  "011122222222111100",
  "001110001110000000",
  "001110001110000000",
];

const player = {
  x: 100,
  y: GROUND - 64,

  width: 72,
  height: 64,

  velocityY: 0,
  grounded: true,
  animation: 0,

  jump() {
    if (!this.grounded) return;

    this.velocityY = JUMP_FORCE;
    this.grounded = false;
  },

  update(dt) {
    this.animation += dt * 12;

    if (!this.grounded) {
      this.velocityY += GRAVITY * dt;
      this.y += this.velocityY * dt;

      if (this.y >= GROUND - this.height) {
        this.y = GROUND - this.height;
        this.velocityY = 0;
        this.grounded = true;
      }
    }
  },

  draw() {
    let sprite;

    if (!this.grounded) {
      sprite = DINO_JUMP;
    } else {
      sprite = Math.floor(this.animation) % 2 === 0 ? DINO_RUN_1 : DINO_RUN_2;
    }

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.23)";
    ctx.beginPath();
    ctx.ellipse(this.x + 36, GROUND + 2, 31, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    drawSprite(sprite, this.x, this.y, 4, DINO_PALETTE);

    // Eye highlight
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(this.x + 62, this.y + 13, 3, 3);

    // Nostril
    ctx.fillStyle = "#25332b";
    ctx.fillRect(this.x + 68, this.y + 23, 3, 2);

    // Belly detail
    ctx.fillStyle = "#c6ed91";
    ctx.fillRect(this.x + 25, this.y + 44, 20, 4);
  },

  reset() {
    this.y = GROUND - this.height;
    this.velocityY = 0;
    this.grounded = true;
    this.animation = 0;
  },

  getHitbox() {
    return {
      x: this.x + 10,
      y: this.y + 9,
      width: 53,
      height: 50,
    };
  },
};

// ==========================================
// BACKGROUND STARS
// ==========================================

const stars = Array.from({ length: 75 }, () => ({
  x: random(0, W),
  y: random(10, 185),
  size: random(1, 3),
  alpha: random(0.4, 1),
}));

// Distant falling meteors
const skyMeteors = Array.from({ length: 5 }, () => ({
  x: random(0, W),
  y: random(15, 160),
  length: random(20, 42),
  speed: random(25, 65),
}));

// ==========================================
// SKY
// ==========================================

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);

  gradient.addColorStop(0, "#10182b");
  gradient.addColorStop(0.45, "#242c46");
  gradient.addColorStop(0.8, "#493c50");
  gradient.addColorStop(1, "#765044");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#f1e8d5";

    ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
  }

  ctx.globalAlpha = 1;

  // Moon glow
  const glow = ctx.createRadialGradient(735, 85, 5, 735, 85, 95);

  glow.addColorStop(0, "rgba(255,194,125,0.16)");
  glow.addColorStop(1, "rgba(255,194,125,0)");

  ctx.fillStyle = glow;
  ctx.fillRect(635, 0, 200, 190);

  // Moon
  ctx.fillStyle = "#e7b77e";
  ctx.beginPath();
  ctx.arc(735, 85, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d253b";
  ctx.beginPath();
  ctx.arc(748, 74, 26, 0, Math.PI * 2);
  ctx.fill();

  // Distant meteor trails
  for (const meteor of skyMeteors) {
    ctx.strokeStyle = "rgba(255,135,83,0.65)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(meteor.x, meteor.y);
    ctx.lineTo(meteor.x - meteor.length, meteor.y + meteor.length * 0.65);
    ctx.stroke();

    ctx.fillStyle = "#ffd28b";
    ctx.fillRect(meteor.x - 2, meteor.y - 2, 4, 4);
  }
}

// ==========================================
// MOUNTAINS
// ==========================================

function drawMountainLayer(offset, spacing, color, peakMin, peakMax) {
  ctx.fillStyle = color;

  for (let i = -2; i < 6; i++) {
    const x = i * spacing - offset;

    const peak1 = randomPeak(i, peakMin, peakMax);
    const peak2 = randomPeak(i + 15, peakMin, peakMax);

    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x + spacing * 0.28, peak1);
    ctx.lineTo(x + spacing * 0.55, GROUND - 15);
    ctx.lineTo(x + spacing * 0.78, peak2);
    ctx.lineTo(x + spacing, GROUND);

    ctx.closePath();
    ctx.fill();
  }
}

function randomPeak(seed, min, max) {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  const fraction = value - Math.floor(value);

  return min + fraction * (max - min);
}

function drawMountains() {
  const farOffset = (sceneryOffset * 0.2) % 380;
  const nearOffset = (sceneryOffset * 0.5) % 300;

  drawMountainLayer(farOffset, 380, "#34354b", 165, 215);

  drawMountainLayer(nearOffset, 300, "#292c40", 205, 250);

  // Volcanic silhouettes
  ctx.fillStyle = "#202638";

  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(0, 267);
  ctx.lineTo(90, 245);
  ctx.lineTo(150, 266);
  ctx.lineTo(225, 251);
  ctx.lineTo(300, 267);
  ctx.lineTo(390, 247);
  ctx.lineTo(470, 266);
  ctx.lineTo(550, 252);
  ctx.lineTo(640, 267);
  ctx.lineTo(730, 249);
  ctx.lineTo(820, 266);
  ctx.lineTo(900, 248);
  ctx.lineTo(900, GROUND);
  ctx.closePath();
  ctx.fill();
}

// ==========================================
// GROUND
// ==========================================

function drawGround() {
  ctx.fillStyle = "#242a3a";
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // Ground top
  ctx.fillStyle = "#d38b58";
  ctx.fillRect(0, GROUND, W, 4);

  // Upper ground shadow
  ctx.fillStyle = "#694b49";
  ctx.fillRect(0, GROUND + 4, W, 3);

  // Ground details
  for (let i = 0; i < 35; i++) {
    const x = (i * 38 - groundOffset + W * 3) % W;

    ctx.fillStyle = i % 2 === 0 ? "#414455" : "#343a4c";

    ctx.fillRect(x, GROUND + 28, 18, 3);
    ctx.fillRect(x + 20, GROUND + 54, 9, 2);
  }

  // Rocks
  for (let i = 0; i < 12; i++) {
    const x = (i * 87 - groundOffset * 0.65 + W * 2) % W;

    ctx.fillStyle = "#77707a";
    ctx.fillRect(x, GROUND - 5, 7, 5);
    ctx.fillRect(x + 3, GROUND - 8, 5, 3);
  }
}

function drawBackground() {
  drawSky();
  drawMountains();
  drawGround();
}

// ==========================================
// METEOR
// ==========================================

class Meteor {
  constructor() {
    this.radius = random(20, 25);

    this.x = W + 30;
    this.y = GROUND - this.radius * 2 + 2;

    this.rotation = random(-0.2, 0.2);
    this.phase = random(0, Math.PI * 2);

    this.size = this.radius * 2;
  }

  update(dt) {
    this.x -= speed * dt;

    this.phase += dt * 9;
    this.rotation += dt * 0.15;

    // Small fire particles
    if (Math.random() < 0.35) {
      particles.push({
        x: this.x + this.size * 0.75,
        y: this.y + this.radius + random(-8, 8),
        vx: random(20, 70),
        vy: random(-30, 30),
        size: random(2, 5),
        life: random(0.2, 0.45),
        color: "#ff9958",
      });
    }
  }

  draw() {
    ctx.save();

    const cx = this.x + this.radius;
    const cy = this.y + this.radius;

    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    const flicker = Math.sin(this.phase) * 5;

    // Fire glow
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 65);

    glow.addColorStop(0, "rgba(255,105,55,0.35)");
    glow.addColorStop(0.5, "rgba(255,105,55,0.12)");
    glow.addColorStop(1, "rgba(255,105,55,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 65, 0, Math.PI * 2);
    ctx.fill();

    // Fire trail (behind the meteor)
    ctx.fillStyle = "#a94336";

    ctx.beginPath();
    ctx.moveTo(13, -10);
    ctx.lineTo(49 + flicker, -17);
    ctx.lineTo(36, 0);
    ctx.lineTo(53 + flicker, 15);
    ctx.lineTo(12, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ed743e";

    ctx.beginPath();
    ctx.moveTo(12, -5);
    ctx.lineTo(39 + flicker, -10);
    ctx.lineTo(29, 0);
    ctx.lineTo(42 + flicker, 8);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffd17b";
    ctx.beginPath();
    ctx.moveTo(13, -2);
    ctx.lineTo(27 + flicker, -5);
    ctx.lineTo(20, 0);
    ctx.lineTo(29 + flicker, 4);
    ctx.lineTo(13, 4);
    ctx.closePath();
    ctx.fill();

    // Outer rock
    ctx.fillStyle = "#713e39";

    ctx.beginPath();
    ctx.moveTo(-22, -13);
    ctx.lineTo(-12, -23);
    ctx.lineTo(8, -24);
    ctx.lineTo(23, -12);
    ctx.lineTo(24, 9);
    ctx.lineTo(11, 23);
    ctx.lineTo(-12, 22);
    ctx.lineTo(-24, 8);
    ctx.closePath();
    ctx.fill();

    // Main surface
    ctx.fillStyle = "#b85e48";

    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.lineTo(-9, -19);
    ctx.lineTo(8, -20);
    ctx.lineTo(19, -10);
    ctx.lineTo(20, 8);
    ctx.lineTo(9, 18);
    ctx.lineTo(-11, 18);
    ctx.lineTo(-20, 6);
    ctx.closePath();
    ctx.fill();

    // Bright surface
    ctx.fillStyle = "#db8056";

    ctx.beginPath();
    ctx.moveTo(-12, -15);
    ctx.lineTo(2, -19);
    ctx.lineTo(12, -13);
    ctx.lineTo(2, -8);
    ctx.lineTo(-12, -8);
    ctx.closePath();
    ctx.fill();

    // Craters
    ctx.fillStyle = "#75433e";
    ctx.beginPath();
    ctx.ellipse(-8, 3, 7, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(9, -5, 5, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e49a68";
    ctx.fillRect(-10, -1, 5, 2);
    ctx.fillRect(7, -7, 3, 2);

    // Dark lower surface
    ctx.fillStyle = "#8d4940";
    ctx.fillRect(-10, 12, 15, 4);

    ctx.restore();
  }

  getHitbox() {
    return {
      x: this.x + 9,
      y: this.y + 8,
      width: this.size - 16,
      height: this.size - 13,
    };
  }
}

// ==========================================
// PARTICLES
// ==========================================

function createParticles(x, y, amount = 12) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      vx: random(-100, 100),
      vy: random(-130, 30),
      size: random(2, 5),
      life: random(0.3, 0.7),
      color: Math.random() > 0.5 ? "#ff9958" : "#ffd17b",
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    p.life -= dt;
  }

  particles = particles.filter((p) => p.life > 0);
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;

    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  ctx.globalAlpha = 1;
}

// ==========================================
// COLLISION
// ==========================================

function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ==========================================
// SCORE
// ==========================================

function updateScore(dt) {
  score += dt * 10;

  const current = Math.floor(score);

  scoreElement.textContent = formatScore(current);

  if (current > best) {
    best = current;
    bestElement.textContent = formatScore(best);
    saveBest();
  }
}

// ==========================================
// GAME START
// ==========================================

function startGame() {
  score = 0;
  elapsed = 0;

  speed = INITIAL_SPEED;
  spawnTimer = 1.5;

  groundOffset = 0;
  sceneryOffset = 0;

  meteors = [];
  particles = [];

  player.reset();

  scoreElement.textContent = "00000";

  gameState = "playing";
  statusElement.textContent = "RUNNING";

  overlay.classList.add("hidden");
}

// ==========================================
// GAME OVER
// ==========================================

function gameOver() {
  if (gameState !== "playing") return;

  gameState = "gameover";

  statusElement.textContent = "GAME OVER";

  createParticles(player.x + 35, player.y + 30, 20);

  overlay.classList.remove("hidden");

  overlayLabel.textContent = "EXTINCTION EVENT";
  overlayTitle.textContent = "GAME OVER";

  overlayDescription.textContent =
    "Dinosaurus terkena meteor. Skor akhir: " + Math.floor(score) + ".";

  startButton.textContent = "TRY AGAIN";
}

// ==========================================
// UPDATE
// ==========================================

function update(dt) {
  updateParticles(dt);

  if (gameState !== "playing") return;

  elapsed += dt;

  speed = Math.min(INITIAL_SPEED + elapsed * 8, MAX_SPEED);

  player.update(dt);

  groundOffset = (groundOffset + speed * dt) % W;

  sceneryOffset += speed * dt;

  // Background meteors
  for (const meteor of skyMeteors) {
    meteor.x -= meteor.speed * dt;

    if (meteor.x < -50) {
      meteor.x = W + random(20, 200);
      meteor.y = random(20, 150);
    }
  }

  updateScore(dt);

  // Spawn obstacles
  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    meteors.push(new Meteor());

    const difficulty = clamp(elapsed / 60, 0, 0.3);

    spawnTimer = random(1.3 - difficulty, 1.85 - difficulty);
  }

  // Update obstacles
  for (const meteor of meteors) {
    meteor.update(dt);

    if (checkCollision(player.getHitbox(), meteor.getHitbox())) {
      gameOver();
      break;
    }
  }

  meteors = meteors.filter((meteor) => meteor.x + meteor.size > -60);
}

// ==========================================
// DRAW
// ==========================================

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawBackground();

  drawParticles();

  for (const meteor of meteors) {
    meteor.draw();
  }

  player.draw();
}

// ==========================================
// GAME LOOP
// ==========================================

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.04);

  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// ==========================================
// INPUT
// ==========================================

function jump() {
  if (gameState !== "playing") return;

  player.jump();
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();

    if (event.repeat) return;

    if (gameState === "menu" || gameState === "gameover") {
      startGame();
    } else {
      jump();
    }
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (gameState !== "playing") return;

  event.preventDefault();
  jump();
});

startButton.addEventListener("click", startGame);

// ==========================================
// INITIALIZATION
// ==========================================

bestElement.textContent = formatScore(best);

draw();

requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  gameLoop(timestamp);
});
