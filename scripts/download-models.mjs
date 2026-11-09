#!/usr/bin/env node
/**
 * Downloads the licensed Kenney CC0 GLB models used by the game and writes
 * assets/models/manifest.json. Every file carries its own provenance record;
 * the build fails if a manifest entry has no file or a file has no entry.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/assets/models');
const REPO = 'https://raw.githubusercontent.com/shorepine/kenney/main/3d';
const PAGE = 'https://github.com/shorepine/kenney/tree/main/3d';
const AUTHOR = 'Kenney';
const LICENSE = 'CC0-1.0';
const LICENSE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';

/** @type {Array<[string,string,string,string,string]>} id, name, category, kit, file */
const TOKENS = [
  // vehicles (car kit)
  ['sedan', 'Sedan', 'vehicle', 'car', 'sedan.glb'],
  ['hatchback', 'Sports Hatch', 'vehicle', 'car', 'hatchback-sports.glb'],
  ['racecar', 'Race Car', 'vehicle', 'car', 'race.glb'],
  ['futureracer', 'Future Racer', 'vehicle', 'car', 'race-future.glb'],
  ['taxi', 'Taxi', 'vehicle', 'car', 'taxi.glb'],
  ['police', 'Police Car', 'vehicle', 'car', 'police.glb'],
  ['ambulance', 'Ambulance', 'vehicle', 'car', 'ambulance.glb'],
  ['firetruck', 'Fire Truck', 'vehicle', 'car', 'firetruck.glb'],
  ['delivery', 'Delivery Van', 'vehicle', 'car', 'delivery.glb'],
  ['garbage', 'Garbage Truck', 'vehicle', 'car', 'garbage-truck.glb'],
  ['tractor', 'Tractor', 'vehicle', 'car', 'tractor.glb'],
  ['boxtruck', 'Box Truck', 'vehicle', 'car', 'truck.glb'],
  ['van', 'Van', 'vehicle', 'car', 'van.glb'],
  ['luxurysuv', 'Luxury SUV', 'vehicle', 'car', 'suv-luxury.glb'],
  ['kart', 'Go-Kart', 'vehicle', 'car', 'kart-oozi.glb'],
  ['speedster', 'Speedster', 'vehicle', 'toy-car', 'vehicle-racer.glb'],
  // animals (cube-pets)
  ['cat', 'Cat', 'animal', 'cube-pets', 'animal-cat.glb'],
  ['dog', 'Dog', 'animal', 'cube-pets', 'animal-dog.glb'],
  ['fox', 'Fox', 'animal', 'cube-pets', 'animal-fox.glb'],
  ['panda', 'Panda', 'animal', 'cube-pets', 'animal-panda.glb'],
  ['penguin', 'Penguin', 'animal', 'cube-pets', 'animal-penguin.glb'],
  ['elephant', 'Elephant', 'animal', 'cube-pets', 'animal-elephant.glb'],
  ['giraffe', 'Giraffe', 'animal', 'cube-pets', 'animal-giraffe.glb'],
  ['lion', 'Lion', 'animal', 'cube-pets', 'animal-lion.glb'],
  ['monkey', 'Monkey', 'animal', 'cube-pets', 'animal-monkey.glb'],
  ['koala', 'Koala', 'animal', 'cube-pets', 'animal-koala.glb'],
  ['parrot', 'Parrot', 'animal', 'cube-pets', 'animal-parrot.glb'],
  ['polar', 'Polar Bear', 'animal', 'cube-pets', 'animal-polar.glb'],
  ['tiger', 'Tiger', 'animal', 'cube-pets', 'animal-tiger.glb'],
  ['deer', 'Deer', 'animal', 'cube-pets', 'animal-deer.glb'],
  ['bunny', 'Bunny', 'animal', 'cube-pets', 'animal-bunny.glb'],
  ['pig', 'Pig', 'animal', 'cube-pets', 'animal-pig.glb'],
  ['bee', 'Bee', 'animal', 'cube-pets', 'animal-bee.glb'],
  ['fish', 'Fish', 'animal', 'cube-pets', 'animal-fish.glb'],
  ['chick', 'Chick', 'animal', 'cube-pets', 'animal-chick.glb'],
  ['crab', 'Crab', 'animal', 'cube-pets', 'animal-crab.glb'],
  // food
  ['burger', 'Burger', 'food', 'food', 'burger.glb'],
  ['donut', 'Donut', 'food', 'food', 'donut-sprinkles.glb'],
  ['coffee', 'Coffee Cup', 'food', 'food', 'cup-coffee.glb'],
  ['cupcake', 'Cupcake', 'food', 'food', 'cupcake.glb'],
  ['cake', 'Birthday Cake', 'food', 'food', 'cake-birthday.glb'],
  ['pineapple', 'Pineapple', 'food', 'food', 'pineapple.glb'],
  ['mushroom', 'Mushroom', 'food', 'food', 'mushroom.glb'],
  ['taco', 'Taco', 'food', 'food', 'taco.glb'],
  ['icecream', 'Ice Cream', 'food', 'food', 'ice-cream.glb'],
  ['sushi', 'Sushi', 'food', 'food', 'sushi-salmon.glb'],
  ['croissant', 'Croissant', 'food', 'food', 'croissant.glb'],
  ['watermelon', 'Watermelon', 'food', 'food', 'watermelon.glb'],
  // objects
  ['chest', 'Treasure Chest', 'object', 'pirate', 'chest.glb'],
  ['cannon', 'Cannon', 'object', 'pirate', 'cannon.glb'],
  ['barrel', 'Barrel', 'object', 'pirate', 'barrel.glb'],
  ['crate', 'Crate', 'object', 'pirate', 'crate.glb'],
  ['flag', 'Flag', 'object', 'pirate', 'flag-high.glb'],
  ['candycane', 'Candy Cane', 'object', 'holiday', 'candy-cane-red.glb'],
  ['present', 'Gift Box', 'object', 'holiday', 'present-a-cube.glb'],
  ['dreidel', 'Dreidel', 'object', 'holiday', 'hanukkah-dreidel.glb'],
  ['lantern', 'Lantern', 'object', 'holiday', 'lantern.glb'],
  ['snowman', 'Snowman', 'object', 'holiday', 'snowman.glb'],
  ['nutcracker', 'Nutcracker', 'object', 'holiday', 'nutcracker.glb'],
  ['radio', 'Radio', 'object', 'furniture', 'radio.glb'],
  ['laptop', 'Laptop', 'object', 'furniture', 'laptop.glb'],
  ['speaker', 'Speaker', 'object', 'furniture', 'speaker.glb'],
  ['bench', 'Bench', 'object', 'furniture', 'bench.glb'],
  ['cashregister', 'Cash Register', 'object', 'mini-market', 'cash-register.glb'],
  ['sailboat', 'Sailboat', 'object', 'watercraft', 'boat-sail-a.glb'],
  ['locomotive', 'Locomotive', 'object', 'train', 'train-locomotive-a.glb'],
  ['marble', 'Marble', 'object', 'marble', 'marble-high.glb'],
  // fantasy
  ['tower', 'Castle Tower', 'fantasy', 'castle', 'tower-square.glb'],
  ['astronaut', 'Astronaut', 'fantasy', 'space', 'astronautA.glb'],
  ['rover', 'Rover', 'fantasy', 'space', 'rover.glb'],
  ['satellite', 'Satellite Dish', 'fantasy', 'space', 'satelliteDish.glb'],
  ['catapult', 'Catapult', 'fantasy', 'castle', 'siege-catapult.glb'],
  // Round 8: 28 more licensed pieces, bringing the usable set to 100.
  ['apple', 'Apple', 'food', 'food', 'apple.glb'],
  ['banana', 'Banana', 'food', 'food', 'banana.glb'],
  ['bread', 'Bread', 'food', 'food', 'bread.glb'],
  ['carrot', 'Carrot', 'food', 'food', 'carrot.glb'],
  ['cheese', 'Cheese', 'food', 'food', 'cheese.glb'],
  ['cherries', 'Cherries', 'food', 'food', 'cherries.glb'],
  ['cookie', 'Cookie', 'food', 'food', 'cookie.glb'],
  ['corn', 'Corn', 'food', 'food', 'corn.glb'],
  ['noodles', 'Noodles', 'food', 'food', 'chinese.glb'],
  ['ketchup', 'Ketchup', 'food', 'food', 'bottle-ketchup.glb'],
  ['soup', 'Soup', 'food', 'food', 'bowl-soup.glb'],
  ['avocado', 'Avocado', 'food', 'food', 'avocado.glb'],
  ['broccoli', 'Broccoli', 'food', 'food', 'broccoli.glb'],
  ['chocolate', 'Chocolate', 'food', 'food', 'chocolate.glb'],
  ['bookcase', 'Bookcase', 'object', 'furniture', 'bookcaseOpen.glb'],
  ['deskchair', 'Desk Chair', 'object', 'furniture', 'chairDesk.glb'],
  ['monitor', 'Monitor', 'object', 'furniture', 'computerScreen.glb'],
  ['desk', 'Desk', 'object', 'furniture', 'desk.glb'],
  ['fridge', 'Fridge', 'object', 'furniture', 'kitchenFridge.glb'],
  ['microwave', 'Microwave', 'object', 'furniture', 'kitchenMicrowave.glb'],
  ['stove', 'Stove', 'object', 'furniture', 'kitchenStove.glb'],
  ['bathtub', 'Bathtub', 'object', 'furniture', 'bathtub.glb'],
  ['alien', 'Alien', 'fantasy', 'space', 'alien.glb'],
  ['astronautb', 'Astronaut B', 'fantasy', 'space', 'astronautB.glb'],
  ['spaceracer', 'Space Racer', 'fantasy', 'space', 'craft_racer.glb'],
  ['speeder', 'Speeder', 'fantasy', 'space', 'craft_speederA.glb'],
  ['meteor', 'Meteor', 'fantasy', 'space', 'meteor.glb'],
  ['monorail', 'Monorail Car', 'fantasy', 'space', 'monorail_trainPassenger.glb'],
];

/** buildings: id -> kit/file. */
const BUILDINGS = [
  ['house', 'House', 'city-suburban', 'building-type-a.glb'],
  ['apartments', 'Apartments', 'city-suburban', 'building-type-j.glb'],
  ['shop', 'Corner Shop', 'city-commercial', 'low-detail-building-a.glb'],
  ['restaurant', 'Restaurant', 'city-commercial', 'low-detail-building-b.glb'],
  ['office', 'Office', 'city-commercial', 'building-c.glb'],
  ['hotel', 'Hotel', 'city-commercial', 'building-skyscraper-a.glb'],
  ['landmark', 'Landmark', 'city-commercial', 'building-skyscraper-e.glb'],
];

/** decorative, non-interactive props (still downloaded models). */
const PROPS = [
  ['palm', 'Palm', 'pirate', 'palm-straight.glb'],
  ['palmbend', 'Bent Palm', 'pirate', 'palm-bend.glb'],
  ['jailbars', 'Jail Fence', 'pirate', 'structure-fence.glb'],
  ['rock', 'Rock', 'pirate', 'rocks-a.glb'],
];

const ALL = [
  ...TOKENS.map((t) => ({ id: t[0], name: t[1], category: t[2], kit: t[3], file: t[4], kind: 'token' })),
  ...BUILDINGS.map((b) => ({ id: b[0], name: b[1], category: 'building', kit: b[2], file: b[3], kind: 'building' })),
  ...PROPS.map((p) => ({ id: p[0], name: p[1], category: 'prop', kit: p[2], file: p[3], kind: 'prop' })),
];

async function main() {
  const dir = path.join(OUT, 'tokens');
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(OUT, 'buildings'), { recursive: true });
  await mkdir(path.join(OUT, 'props'), { recursive: true });

  const manifest = { generatedAt: new Date().toISOString(), license: LICENSE, author: AUTHOR, assets: [] };
  let downloaded = 0;

  for (const asset of ALL) {
    const url = `${REPO}/${asset.kit}/${asset.file}`;
    const rel = `${asset.kind === 'token' ? 'tokens' : asset.kind === 'building' ? 'buildings' : 'props'}/${asset.id}.glb`;
    const dest = path.join(OUT, rel);
    let bytes;
    try {
      bytes = await readFile(dest);
    } catch {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
      bytes = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, bytes);
      downloaded += 1;
    }
    manifest.assets.push({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      category: asset.category,
      file: rel,
      kit: asset.kit,
      sourceUrl: `${PAGE}/${asset.kit}/${asset.file}`,
      downloadUrl: url,
      author: AUTHOR,
      license: LICENSE,
      licenseUrl: LICENSE_URL,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    });
  }

  // The city pass adds its own licensed assets to the same manifest. Preserve
  // every existing entry this script does not own, so a token refresh cannot
  // drop the city files again.
  const manifestPath = path.join(OUT, 'manifest.json');
  try {
    const existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    const known = new Set(manifest.assets.map((a) => a.id));
    for (const asset of existing.assets) {
      if (!known.has(asset.id)) {
        manifest.assets.push(asset);
        known.add(asset.id);
      }
    }
  } catch {
    // First run: there is nothing to preserve.
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const tokens = manifest.assets.filter((a) => a.kind === 'token').length;
  const buildings = manifest.assets.filter((a) => a.kind === 'building').length;
  console.log(`manifest: ${manifest.assets.length} assets (${tokens} tokens, ${buildings} buildings), ${downloaded} downloaded now`);

  const onDisk = await readdir(OUT, { recursive: true });
  const glbs = onDisk.filter((f) => String(f).endsWith('.glb')).length;
  if (glbs !== manifest.assets.length) throw new Error(`file/manifest mismatch: ${glbs} files vs ${manifest.assets.length} entries`);
}

await main();
