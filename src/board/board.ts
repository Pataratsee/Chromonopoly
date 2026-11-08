import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Text } from 'troika-three-text';
import { PALETTE, BOARD, money } from '../config';
import { SPACES } from '../game/board';
import type { PublicState, Space } from '../game/types';
import { HAS_BAND, boardName, contentBox, tilePose } from './layout';
import { fitText, loadFont } from './textFit';
import type { Font } from 'opentype.js';
import { assetUrl } from '../assetUrl';
import { loadModel } from '../render/models';

const BOARD_FONT = assetUrl('fonts/LilitaOne-Regular.ttf');
const DISPLAY_FONT = assetUrl('fonts/LilitaOne-Regular.ttf');
const SURFACE = 0.055;

export interface TileHandle {
  index: number;
  group: THREE.Group;
  face: THREE.Mesh;
  band: THREE.Mesh | null;
  name: Text;
  price: Text | null;
  icon: THREE.Group | null;
  baseColor: THREE.Color;
}

export interface BoardView {
  group: THREE.Group;
  tiles: TileHandle[];
  tilePoint(index: number): THREE.Vector3;
  update(state: PublicState, showPrices: boolean): void;
  tick(time: number, camera?: THREE.Camera): void;
  setHover(index: number | null): void;
  playCard(deck: 'chance' | 'chest', text: string): void;
  dispose(): void;
}

interface OwnerSign {
  group: THREE.Group;
  plate: THREE.Mesh;
  label: THREE.Mesh;
  strip: THREE.Mesh;
  piece: THREE.Group;
  texture: THREE.CanvasTexture | null;
}

interface CardAnimation {
  card: THREE.Mesh;
  started: number;
}

interface DeckView {
  x: number;
  z: number;
  group: THREE.Group;
}

function makeText(text: string, size: number, color: string, font: string, weight: number): Text {
  const t = new Text();
  t.text = text;
  t.fontSize = size;
  t.color = color;
  t.font = font;
  t.fontWeight = weight;
  t.anchorX = 'center';
  t.anchorY = 'middle';
  t.maxWidth = 10;
  t.material.depthWrite = false;
  t.material.fog = false;
  t.renderOrder = 2;
  return t;
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function deckLogoTexture(deck: 'chance' | 'chest'): THREE.CanvasTexture {
  return canvasTexture(512, 640, (ctx) => {
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(0, 0, 512, 640);
    ctx.strokeStyle = deck === 'chance' ? '#d67d1f' : '#2f6fd0';
    ctx.lineWidth = 16;
    roundedPath(ctx, 18, 18, 476, 604, 38);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (deck === 'chance') {
      ctx.fillStyle = '#f08a24';
      ctx.beginPath();
      ctx.arc(256, 285, 124, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.font = '700 190px "Lilita One", Outfit, sans-serif';
      ctx.fillText('?', 256, 300);
    } else {
      ctx.fillStyle = '#2f6fd0';
      roundedPath(ctx, 118, 230, 276, 170, 22);
      ctx.fill();
      ctx.fillStyle = '#1e4c9a';
      roundedPath(ctx, 104, 192, 304, 82, 22);
      ctx.fill();
      ctx.fillStyle = '#f3c14b';
      ctx.fillRect(236, 270, 40, 48);
      ctx.fillStyle = '#7b4b18';
      ctx.fillRect(246, 286, 20, 16);
    }
    ctx.fillStyle = deck === 'chance' ? '#9b4d08' : '#183b78';
    ctx.font = '700 28px Outfit, sans-serif';
    ctx.fillText(deck === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST', 256, 535);
  });
}

function cardTexture(deck: 'chance' | 'chest', text: string): THREE.CanvasTexture {
  return canvasTexture(512, 704, (ctx) => {
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(0, 0, 512, 704);
    ctx.strokeStyle = deck === 'chance' ? '#e08a27' : '#3f77c7';
    ctx.lineWidth = 16;
    roundedPath(ctx, 18, 18, 476, 668, 36);
    ctx.stroke();
    ctx.fillStyle = deck === 'chance' ? '#e08a27' : '#3f77c7';
    ctx.font = '700 25px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(deck === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST', 256, 92);
    ctx.fillStyle = '#2a2320';
    ctx.textAlign = 'left';
    ctx.font = '700 42px Outfit, sans-serif';
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 412 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, 9).forEach((content, i) => ctx.fillText(content, 52, 205 + i * 53));
    ctx.fillStyle = deck === 'chance' ? '#e08a27' : '#3f77c7';
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHROMONOPOLY', 256, 626);
  });
}

function ownerTexture(name: string, color: string): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#2c2119';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 18, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(18, 0, 494, 4);
    ctx.fillStyle = '#d9c7a0';
    ctx.font = '700 20px Outfit, sans-serif';
    ctx.fillText('OWNER', 48, 62);
    let fontSize = 48;
    const label = name.length > 15 ? `${name.slice(0, 14)}…` : name;
    do {
      ctx.font = `700 ${fontSize}px Outfit, sans-serif`;
      fontSize -= 2;
    } while (ctx.measureText(label).width > 425 && fontSize > 26);
    ctx.fillStyle = '#fff6e4';
    ctx.fillText(label, 48, 154);
    ctx.fillStyle = 'rgba(255,246,228,0.34)';
    ctx.fillRect(48, 190, 390, 2);
  });
}

function specialName(space: Space): string {
  return space.type === 'chance' ? 'CHANCE' : space.type === 'chest' ? 'COMMUNITY CHEST' : boardName(space);
}

export async function createBoard(): Promise<BoardView> {
  const font: Font = await loadFont(BOARD_FONT);
  const group = new THREE.Group();
  group.name = 'board';

  const span = BOARD.size * BOARD.tile;
  const frame = BOARD.frame;
  const outer = span + frame * 2;

  const frameMat = new THREE.MeshStandardMaterial({ color: PALETTE.boardFrame, roughness: 0.64, metalness: 0.1 });
  const slab = new THREE.Mesh(new RoundedBoxGeometry(outer, BOARD.thickness, outer, 3, 0.1), frameMat);
  slab.receiveShadow = true;
  slab.castShadow = true;
  slab.position.y = -BOARD.thickness / 2;
  group.add(slab);

  const inlayMat = new THREE.MeshStandardMaterial({ color: PALETTE.board, roughness: 0.7, metalness: 0.02 });
  const inlay = new THREE.Mesh(new RoundedBoxGeometry(span + 0.12, 0.022, span + 0.12, 2, 0.04), inlayMat);
  inlay.position.y = -0.003;
  inlay.receiveShadow = true;
  group.add(inlay);

  const tiles: TileHandle[] = [];
  const mortgageSigns = new Map<number, THREE.Group>();
  const ownerSigns = new Map<number, OwnerSign>();
  const specialIcons: THREE.Group[] = [];
  const tileGeo = new RoundedBoxGeometry(BOARD.tile * 0.96, 0.08, BOARD.tile * 0.96, 2, 0.025);
  const seamGeo = new THREE.PlaneGeometry(BOARD.tile * 0.995, BOARD.tile * 0.995);
  const seamMat = new THREE.MeshStandardMaterial({ color: '#B99A6A', roughness: 0.9, metalness: 0 });

  const signWood = new THREE.MeshStandardMaterial({ color: '#5C3424', roughness: 0.7, metalness: 0.04 });
  const signPlate = new THREE.MeshStandardMaterial({ color: '#7A2F22', roughness: 0.6, metalness: 0.03 });
  const signGold = new THREE.MeshStandardMaterial({ color: '#E0B04A', roughness: 0.38, metalness: 0.5 });
  const signPost = new RoundedBoxGeometry(0.045, 0.3, 0.045, 2, 0.012);
  const signFrame = new RoundedBoxGeometry(0.6, 0.24, 0.04, 3, 0.045);
  const signBoard = new RoundedBoxGeometry(0.54, 0.18, 0.018, 3, 0.035);
  const signStrip = new RoundedBoxGeometry(0.055, 0.15, 0.025, 2, 0.012);
  const writeSign = (handle: TileHandle, index: number): void => {
    const sign = new THREE.Group();
    sign.position.set(0, 0.02, 0.68);
    sign.visible = false;
    sign.scale.setScalar(0.01);
    sign.userData.baseY = 0.02;
    sign.userData.phase = index * 0.41;
    sign.userData.ownerId = null;
    sign.userData.born = 0;
    sign.userData.pieceToken = '';

    const post = new THREE.Mesh(signPost, signWood);
    post.position.y = 0.15;
    sign.add(post);
    const frameMesh = new THREE.Mesh(signFrame, signWood);
    frameMesh.position.y = 0.37;
    sign.add(frameMesh);
    const plate = new THREE.Mesh(signBoard, signPlate);
    plate.position.set(0, 0.37, 0.024);
    sign.add(plate);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.135),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    );
    label.position.set(-0.025, 0.37, 0.035);
    sign.add(label);
    const strip = new THREE.Mesh(signStrip, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
    strip.position.set(0.245, 0.37, 0.041);
    sign.add(strip);
    const piece = new THREE.Group();
    piece.position.set(-0.205, 0.37, 0.038);
    sign.add(piece);
    handle.group.add(sign);
    ownerSigns.set(index, { group: sign, plate, label, strip, piece, texture: null });
  };

  for (const space of SPACES) {
    const lay = tilePose(space.index);
    const tileGroup = new THREE.Group();
    tileGroup.position.set(lay.x, 0.012, lay.z);
    tileGroup.rotation.y = lay.rotY;
    tileGroup.scale.setScalar(BOARD.tile);
    tileGroup.name = `tile-${space.index}`;

    const baseColor = new THREE.Color(PALETTE.board).offsetHSL(0, 0, space.index % 2 ? -0.012 : 0.008);
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.rotation.x = -Math.PI / 2;
    seam.position.y = -0.002;
    seam.receiveShadow = true;
    tileGroup.add(seam);

    const faceMat = new THREE.MeshStandardMaterial({ color: baseColor.clone(), roughness: 0.68, metalness: 0.02 });
    const face = new THREE.Mesh(tileGeo, faceMat);
    face.position.y = 0;
    face.receiveShadow = true;
    face.userData.tile = space.index;
    tileGroup.add(face);

    let band: THREE.Mesh | null = null;
    if (HAS_BAND(space)) {
      const color = space.group ? PALETTE.groups[space.group] : PALETTE.ink;
      const bandMat = new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.08 });
      band = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.032, 0.15, 2, 0.012), bandMat);
      band.position.set(0, 0.055, -0.38);
      band.receiveShadow = true;
      tileGroup.add(band);
    }

    const box = contentBox(space);
    const isCorner = space.index % 10 === 0;
    const isDeck = space.type === 'chance' || space.type === 'chest';
    const label = specialName(space);
    const nameSize = isCorner ? 0.27 : isDeck ? 0.19 : 0.23;
    const nameText = makeText(label, nameSize, '#1B1511', BOARD_FONT, 700);
    const nameFit = fitText(font, label, { w: box.w, h: isDeck ? 0.24 : box.h }, nameSize);
    nameText.fontSize = nameFit.size;
    nameText.maxWidth = box.w;
    nameText.text = isCorner ? label : nameFit.lines.join('\n');
    nameText.textAlign = 'center';
    nameText.position.set(0, SURFACE, isDeck ? -0.28 : isCorner ? -0.02 : space.group ? 0.0 : 0.04);
    nameText.rotation.x = -Math.PI / 2;
    tileGroup.add(nameText);

    let price: Text | null = null;
    if (space.price > 0) {
      price = makeText(money(space.price), 0.12, '#241D17', BOARD_FONT, 700);
      price.position.set(0, SURFACE, space.group ? 0.44 : 0.32);
      price.rotation.x = -Math.PI / 2;
      tileGroup.add(price);
    }

    if (space.label) {
      const sub = makeText(space.label, 0.082, '#5b514b', BOARD_FONT, 600);
      sub.position.set(0, SURFACE, 0.34);
      sub.rotation.x = -Math.PI / 2;
      tileGroup.add(sub);
    }

    const icon = new THREE.Group();
    icon.position.set(0, SURFACE, 0.06);
    tileGroup.add(icon);
    specialIcons.push(icon);

    decorateSpecial(space, icon, isDeck);

    group.add(tileGroup);
    tiles.push({
      index: space.index,
      group: tileGroup,
      face,
      band,
      name: nameText,
      price,
      icon,
      baseColor,
    });
    writeSign(tiles[tiles.length - 1]!, space.index);
  }

  // Mortgage plaques stay at the inner edge of each tile, clear of the owner sign.
  const plateGeometry = new RoundedBoxGeometry(0.82, 0.225, 0.018, 3, 0.042);
  const frameGeometry = new RoundedBoxGeometry(0.9, 0.3, 0.04, 3, 0.052);
  const postGeometry = new RoundedBoxGeometry(0.055, 0.66, 0.055, 2, 0.018);
  const coinGeometry = new THREE.CircleGeometry(0.068, 24);
  for (const handle of tiles) {
    const sign = new THREE.Group();
    sign.position.set(0, 0.018, 0);
    sign.visible = false;
    const post = new THREE.Mesh(postGeometry, signWood);
    post.position.y = 0.33;
    post.castShadow = true;
    sign.add(post);
    const frameMesh = new THREE.Mesh(frameGeometry, signWood);
    frameMesh.position.y = 0.74;
    frameMesh.castShadow = true;
    sign.add(frameMesh);
    const plaque = new THREE.Mesh(plateGeometry, signPlate);
    plaque.position.set(0.028, 0.74, 0.026);
    sign.add(plaque);
    for (const side of [1, -1] as const) {
      const label = makeText('MORTGAGED', 0.112, '#FFF0C9', BOARD_FONT, 700);
      label.position.set(0.07, 0.742, side * 0.038);
      if (side < 0) label.rotation.y = Math.PI;
      label.material.depthWrite = false;
      label.renderOrder = 4;
      sign.add(label);
      const coin = new THREE.Mesh(coinGeometry, signGold);
      coin.position.set(-0.335, 0.74, side * 0.048);
      if (side < 0) coin.rotation.y = Math.PI;
      sign.add(coin);
      const dollar = makeText('$', 0.105, '#5A3418', BOARD_FONT, 700);
      dollar.position.set(-0.335, 0.733, side * 0.051);
      if (side < 0) dollar.rotation.y = Math.PI;
      dollar.material.depthWrite = false;
      dollar.renderOrder = 5;
      sign.add(dollar);
    }
    sign.userData.baseY = 0.018;
    sign.userData.phase = handle.index * 0.43;
    handle.group.add(sign);
    mortgageSigns.set(handle.index, sign);
  }

  // Center field.
  const centerY = 0.012;
  const plaqueMat = new THREE.MeshStandardMaterial({ color: '#28543E', roughness: 0.82, metalness: 0.04 });
  const plaque = new THREE.Mesh(new RoundedBoxGeometry(span * 0.52, 0.035, span * 0.52, 2, 0.06), plaqueMat);
  plaque.position.set(0, centerY, 0.1);
  plaque.receiveShadow = true;
  group.add(plaque);

  const trimMat = new THREE.MeshStandardMaterial({ color: '#D6A94D', roughness: 0.36, metalness: 0.55 });
  const trim = span * 0.52;
  for (const [w, d, x, z] of [
    [trim, 0.045, 0, 0.1 - trim / 2],
    [trim, 0.045, 0, 0.1 + trim / 2],
    [0.045, trim, -trim / 2, 0.1],
    [0.045, trim, trim / 2, 0.1],
  ] as const) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(w, d), trimMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, centerY + 0.026, z);
    group.add(edge);
  }

  const logo = makeText('CHROMONOPOLY', 0.64, '#FFF0CC', DISPLAY_FONT, 700);
  logo.position.set(0, centerY + 0.035, -1.2);
  logo.rotation.x = -Math.PI / 2;
  logo.letterSpacing = 0.02;
  group.add(logo);
  const tagline = makeText('ONE BOARD · EVERYONE PLAYS', 0.13, '#D9C7A0', BOARD_FONT, 600);
  tagline.position.set(0, centerY + 0.035, -0.82);
  tagline.rotation.x = -Math.PI / 2;
  tagline.letterSpacing = 0.08;
  group.add(tagline);

  const decks = new Map<'chance' | 'chest', DeckView>();
  for (const [deck, x] of [
    ['chance', -1.45],
    ['chest', 1.45],
  ] as const) {
    decks.set(deck, createDeckStack(group, deck, x, centerY));
  }

  const pad = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 40),
    new THREE.MeshStandardMaterial({ color: '#C9AE80', roughness: 0.8 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, centerY + 0.03, 0.6);
  group.add(pad);
  const padLabel = makeText('DICE', 0.12, '#D9C7A0', BOARD_FONT, 700);
  padLabel.position.set(0, centerY + 0.045, 0.6);
  padLabel.rotation.x = -Math.PI / 2;
  padLabel.letterSpacing = 0.14;
  group.add(padLabel);

  addCenterFountain(group, centerY);
  addCenterProp(group, 'tree-large', 0.68, -2.7, 0.55, centerY);
  addCenterProp(group, 'tree-large', 0.68, 2.7, 0.55, centerY);
  addCenterProp(group, 'tree-small', 0.55, -2.95, 2.45, centerY);
  addCenterProp(group, 'tree-small', 0.55, 2.95, 2.45, centerY);
  addCenterProp(group, 'bench-city', 0.5, -1.8, 2.35, centerY);
  addCenterProp(group, 'bench-city', 0.5, 1.8, 2.35, centerY);

  const felt = new THREE.Mesh(
    new THREE.CircleGeometry(46, 64),
    new THREE.MeshStandardMaterial({ color: PALETTE.felt, roughness: 0.98, metalness: 0 }),
  );
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = -0.26;
  felt.receiveShadow = true;
  group.add(felt);

  await syncTexts(group);
  const cardAnimations: CardAnimation[] = [];

  const updateOwner = (handle: TileHandle, state: PublicState): void => {
    const tile = state.tiles[handle.index];
    const owner = tile?.ownerId ? state.players[tile.ownerId] : null;
    const sign = ownerSigns.get(handle.index);
    if (!sign) return;
    if (!owner) {
      sign.group.visible = false;
      sign.group.userData.ownerId = null;
      return;
    }
    if (sign.group.userData.ownerId !== owner.id) {
      sign.group.userData.ownerId = owner.id;
      sign.group.userData.born = performance.now();
      sign.group.visible = true;
      sign.group.scale.setScalar(0.01);
      const texture = ownerTexture(owner.name, owner.color);
      if (sign.texture) sign.texture.dispose();
      sign.texture = texture;
      const material = sign.label.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.needsUpdate = true;
      (sign.strip.material as THREE.MeshStandardMaterial).color.set(owner.color);
      sign.piece.clear();
      void loadModel(owner.tokenId, 0.135)
        .then((model) => {
          if (sign.group.userData.ownerId !== owner.id) return;
          sign.piece.add(model);
        })
        .catch((error: unknown) => console.error('[board] owner piece failed', owner.tokenId, error));
    }
  };

  const update = (state: PublicState, showPrices: boolean): void => {
    for (const handle of tiles) {
      const tile = state.tiles[handle.index];
      const faceMat = handle.face.material as THREE.MeshStandardMaterial;
      const sign = mortgageSigns.get(handle.index);
      if (sign) sign.visible = Boolean(tile?.mortgaged);
      if (tile?.mortgaged) faceMat.color.copy(handle.baseColor).lerp(new THREE.Color('#8d8d8d'), 0.62);
      else faceMat.color.copy(handle.baseColor);
      if (handle.price) handle.price.visible = showPrices;
      updateOwner(handle, state);
    }
  };

  const setHover = (index: number | null): void => {
    for (const handle of tiles) {
      const mat = handle.face.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(handle.index === index ? 0x221a10 : 0x000000);
    }
  };

  const tick = (time: number, camera?: THREE.Camera): void => {
    const now = performance.now();
    for (const [index, sign] of mortgageSigns) {
      if (!sign.visible) continue;
      const handle = tiles[index]!;
      if (camera) {
        const world = new THREE.Vector3();
        sign.getWorldPosition(world);
        sign.rotation.y = Math.atan2(camera.position.x - world.x, camera.position.z - world.z) - handle.group.rotation.y;
      }
      sign.rotation.z = Math.sin(time * 1.35 + Number(sign.userData.phase ?? 0)) * 0.025;
      sign.position.y = Number(sign.userData.baseY ?? 0.018) + Math.sin(time * 1.8 + Number(sign.userData.phase ?? 0)) * 0.006;
    }
    for (const sign of ownerSigns.values()) {
      if (!sign.group.visible) continue;
      const age = now - Number(sign.group.userData.born ?? 0);
      const t = Math.min(1, age / 220);
      const eased = 1 - Math.pow(1 - t, 3);
      sign.group.scale.setScalar(0.01 + eased * 0.99);
      if (camera) {
        const world = new THREE.Vector3();
        sign.group.getWorldPosition(world);
        const parent = sign.group.parent as THREE.Object3D;
        sign.group.rotation.y = Math.atan2(camera.position.x - world.x, camera.position.z - world.z) - parent.rotation.y;
      }
      sign.group.position.y = Number(sign.group.userData.baseY ?? 0.02) + Math.sin(time * 1.7 + Number(sign.group.userData.phase ?? 0)) * 0.004;
    }
    for (const [i, icon] of specialIcons.entries()) {
      icon.position.y = SURFACE + Math.sin(time * 1.5 + i * 0.8) * 0.006;
      icon.rotation.y = Math.sin(time * 0.7 + i) * 0.06;
    }
    for (const animation of [...cardAnimations]) {
      const t = Math.min(1, (now - animation.started) / 1500);
      animation.card.position.y = centerY + 0.22 + Math.sin(t * Math.PI) * 1.1;
      animation.card.rotation.x = -Math.PI / 2 - t * Math.PI;
      animation.card.rotation.z = Math.sin(t * Math.PI) * 0.22;
      if (t >= 1) {
        animation.card.removeFromParent();
        animation.card.geometry.dispose();
        (animation.card.material as THREE.Material).dispose();
        cardAnimations.splice(cardAnimations.indexOf(animation), 1);
      }
    }
  };

  const playCard = (deck: 'chance' | 'chest', text: string): void => {
    const target = decks.get(deck);
    if (!target) return;
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.86),
      new THREE.MeshBasicMaterial({ map: cardTexture(deck, text), side: THREE.DoubleSide, transparent: true }),
    );
    card.position.set(target.x, centerY + 0.22, target.z);
    card.rotation.x = -Math.PI / 2;
    group.add(card);
    cardAnimations.push({ card, started: performance.now() });
  };

  return {
    group,
    tiles,
    tilePoint: (index: number) => {
      const lay = tilePose(index);
      return new THREE.Vector3(lay.x, BOARD.tileTop, lay.z);
    },
    update,
    tick,
    setHover,
    playCard,
    dispose: () => {
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        const mat = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      });
    },
  };
}

function decorateSpecial(space: Space, icon: THREE.Group, isDeck: boolean): void {
  const orange = new THREE.MeshStandardMaterial({ color: '#F08A24', roughness: 0.42, metalness: 0.1 });
  const blue = new THREE.MeshStandardMaterial({ color: '#2F6FD0', roughness: 0.4, metalness: 0.12 });
  const gold = new THREE.MeshStandardMaterial({ color: '#E0B04A', roughness: 0.35, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 0.8 });
  const addModel = (id: string, size: number, x = 0, z = 0.07, rot = 0): void => {
    void loadModel(id, size)
      .then((model) => {
        model.position.set(x, 0, z);
        model.rotation.y = rot;
        icon.add(model);
      })
      .catch((error: unknown) => console.error('[board] special model failed', id, error));
  };
  if (isDeck) {
    const plaque = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.034, 0.46, 2, 0.12), space.type === 'chance' ? orange : blue);
    plaque.position.y = 0.012;
    icon.add(plaque);
    if (space.type === 'chance') {
      const mark = makeText('?', 0.4, '#fff4df', BOARD_FONT, 700);
      mark.position.set(0, 0.045, 0);
      mark.rotation.x = -Math.PI / 2;
      mark.renderOrder = 5;
      icon.add(mark);
    } else {
      addModel('chest', 0.36, 0, 0.07);
    }
    return;
  }
  switch (space.type) {
    case 'railroad':
      addModel('locomotive', 0.34, 0, 0.12);
      break;
    case 'utility':
      addModel('lantern-city', 0.3, 0, 0.12);
      break;
    case 'tax':
      addModel(space.index === 4 ? 'cashregister' : 'chest', 0.3, 0, 0.12);
      break;
    case 'free':
      addModel('sedan', 0.34, 0, 0.12);
      break;
    case 'jail':
      addModel('jailbars', 0.32, 0, 0.12);
      break;
    case 'gotojail':
      addModel('police', 0.32, 0, 0.12);
      break;
    case 'go': {
      const arrow = new THREE.Group();
      const shaft = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.045, 0.1, 2, 0.02), gold);
      shaft.position.set(-0.08, 0.04, 0);
      arrow.add(shaft);
      const headA = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.045, 0.1, 2, 0.02), gold);
      headA.position.set(0.13, 0.04, -0.06);
      headA.rotation.y = Math.PI / 4;
      arrow.add(headA);
      const headB = headA.clone();
      headB.position.z = 0.06;
      headB.rotation.y = -Math.PI / 4;
      arrow.add(headB);
      icon.add(arrow);
      break;
    }
    default:
      break;
  }
  void orange;
  void blue;
  void dark;
}

function createDeckStack(parent: THREE.Group, deck: 'chance' | 'chest', x: number, centerY: number): DeckView {
  const deckGroup = new THREE.Group();
  deckGroup.position.set(x, centerY, 0.55);
  parent.add(deckGroup);
  const cardGeo = new RoundedBoxGeometry(0.62, 0.018, 0.86, 2, 0.03);
  const cardMat = new THREE.MeshStandardMaterial({ color: '#efe1c2', roughness: 0.62, metalness: 0.02 });
  for (let i = 0; i < 14; i += 1) {
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.position.set(((i * 13) % 7 - 3) * 0.007, i * 0.018, ((i * 17) % 5 - 2) * 0.009);
    card.rotation.y = ((i * 7) % 5 - 2) * 0.014;
    card.castShadow = true;
    deckGroup.add(card);
  }
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.78),
    new THREE.MeshBasicMaterial({ map: deckLogoTexture(deck), side: THREE.DoubleSide }),
  );
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, 14 * 0.018 + 0.012, 0);
  deckGroup.add(logo);
  return { x, z: 0.55, group: deckGroup };
}

function addCenterProp(parent: THREE.Group, id: string, size: number, x: number, z: number, centerY: number): void {
  const holder = new THREE.Group();
  holder.position.set(x, centerY + 0.028, z);
  parent.add(holder);
  void loadModel(id, size)
    .then((model) => holder.add(model))
    .catch((error: unknown) => {
      holder.removeFromParent();
      console.error('[board] center prop failed', id, error);
    });
}

function addCenterFountain(parent: THREE.Group, centerY: number): void {
  const stone = new THREE.MeshStandardMaterial({ color: '#d7cdb9', roughness: 0.8, metalness: 0.04 });
  const water = new THREE.MeshStandardMaterial({ color: '#4c9eb5', roughness: 0.18, metalness: 0.12 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.09, 1.0, 2, 0.2), stone);
  base.position.set(0, centerY + 0.055, 2.35);
  base.castShadow = true;
  base.receiveShadow = true;
  parent.add(base);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32), water);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, centerY + 0.106, 2.35);
  parent.add(pool);
  const column = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.32, 0.16, 2, 0.05), stone);
  column.position.set(0, centerY + 0.25, 2.35);
  parent.add(column);
  const bowl = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), water);
  bowl.rotation.x = -Math.PI / 2;
  bowl.position.set(0, centerY + 0.42, 2.35);
  parent.add(bowl);
}

async function syncTexts(root: THREE.Object3D): Promise<void> {
  const texts: Text[] = [];
  root.traverse((o) => {
    if (o instanceof Text) texts.push(o);
  });
  await Promise.all(texts.map((t) => t.sync()));
}

/** Finds the tile under a normalised device coordinate. */
export function pickTile(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  tiles: TileHandle[],
  ndc: THREE.Vector2,
): number | null {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(tiles.map((t) => t.face), false);
  const hit = hits[0];
  if (!hit) return null;
  return (hit.object.userData.tile as number) ?? null;
}
