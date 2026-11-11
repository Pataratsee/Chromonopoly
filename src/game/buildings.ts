/**
 * Every building type is one data row: cost, rent, perk and trade-off.
 * Perks are aggregated on the server by src/game/perks.ts; the UI never invents
 * a number. Models may repeat, but every type has a distinct strategic effect.
 */
export type PerkKey =
  | 'steadyIncome'
  | 'loanDesk'
  | 'lawAndOrder'
  | 'healRecovery'
  | 'rentBoost'
  | 'courtDesk'
  | 'marketDesk'
  | 'detectiveDesk'
  | 'jailDesk'
  | 'insurance'
  | 'casino'
  | 'taxDesk'
  | 'fireWatch'
  | 'schooling'
  | 'powerGrid'
  | 'transport'
  | 'reputation'
  | 'traffic'
  | 'cashShield'
  | 'underworld'
  | 'hospitality'
  | 'seasonal'
  | 'harbor'
  | 'security'
  | 'showpiece';

export interface BuildingMeta {
  name: string;
  category: 'stay' | 'shopping' | 'food' | 'entertainment' | 'services' | 'industry' | 'landmark';
  model: string;
  costMultiple: number;
  rentMultiple: number;
  blurb: string;
  perk: string;
  tradeoff: string;
  perkKey: PerkKey;
  /** Effect per rank, in the unit described by perkKey. */
  perkValue: number;
}

export const BUILDING_CATALOG = {
  house: {
    name: 'House', category: 'stay', model: 'house', costMultiple: 1, rentMultiple: 1,
    blurb: 'A small pitched-roof home with steady tenants.',
    perk: 'Reliable base rent; the cheapest way to start earning.',
    tradeoff: 'No special bonus and the lowest rent ceiling.',
    perkKey: 'steadyIncome', perkValue: 0.02,
  },
  apartments: {
    name: 'Apartments', category: 'stay', model: 'apartments', costMultiple: 1.8, rentMultiple: 2.2,
    blurb: 'A three-storey rental block with steady tenant income.',
    perk: 'Adds a little income per turn to its owner.',
    tradeoff: 'Costs almost twice a house for no burst income.',
    perkKey: 'steadyIncome', perkValue: 0.03,
  },
  corner_shop: {
    name: 'Corner Shop', category: 'shopping', model: 'shop', costMultiple: 1.4, rentMultiple: 1.8,
    blurb: 'A friendly local shop that always has a queue.',
    perk: 'Reliable retail income with a low build cost.',
    tradeoff: 'Small rent multiplier and no defensive effect.',
    perkKey: 'steadyIncome', perkValue: 0.025,
  },
  restaurant: {
    name: 'Restaurant', category: 'food', model: 'restaurant', costMultiple: 2.2, rentMultiple: 3,
    blurb: 'Full-service dining with a busy evening trade.',
    perk: 'Small discount on the owner’s own spending.',
    tradeoff: 'Expensive kitchen; only a modest discount.',
    perkKey: 'hospitality', perkValue: 0.015,
  },
  office: {
    name: 'Office', category: 'industry', model: 'office', costMultiple: 3, rentMultiple: 4,
    blurb: 'Glass mid-rise leased to steady corporate tenants.',
    perk: 'Corporate leases increase this property’s rent.',
    tradeoff: 'Very expensive and vulnerable to a jail sale.',
    perkKey: 'rentBoost', perkValue: 0.015,
  },
  hotel: {
    name: 'Hotel', category: 'stay', model: 'hotel', costMultiple: 5, rentMultiple: 8,
    blurb: 'Landmark lodging with visitors all year.',
    perk: 'High rent from every visitor.',
    tradeoff: 'Loses an extra share of rent while jailed.',
    perkKey: 'rentBoost', perkValue: 0.03,
  },
  landmark: {
    name: 'Landmark', category: 'landmark', model: 'landmark', costMultiple: 9, rentMultiple: 13,
    blurb: 'A city icon that tourists pay handsomely to visit.',
    perk: 'Attracts traffic: every landing here pays a premium.',
    tradeoff: 'The most expensive build on the board.',
    perkKey: 'traffic', perkValue: 0.02,
  },
  clothing_store: {
    name: 'Clothing Store', category: 'shopping', model: 'city-a', costMultiple: 1.7, rentMultiple: 2,
    blurb: 'Seasonal fashion with window displays on the high street.',
    perk: 'Steady retail income with no upkeep.',
    tradeoff: 'No defensive or court benefit.',
    perkKey: 'steadyIncome', perkValue: 0.02,
  },
  bookstore: {
    name: 'Bookstore', category: 'shopping', model: 'city-b', costMultiple: 1.6, rentMultiple: 1.9,
    blurb: 'Paperbacks, coffee and a cosy reading corner.',
    perk: 'Raises the owner’s reputation a little each turn.',
    tradeoff: 'Low rent multiplier.',
    perkKey: 'reputation', perkValue: 0.5,
  },
  toy_store: {
    name: 'Toy Store', category: 'shopping', model: 'city-c', costMultiple: 1.5, rentMultiple: 1.8,
    blurb: 'Bright shelves of games, kites and model trains.',
    perk: 'Cheap traffic draw for the whole colour group.',
    tradeoff: 'Small direct income and no cash protection.',
    perkKey: 'traffic', perkValue: 0.01,
  },
  electronics_store: {
    name: 'Electronics Store', category: 'shopping', model: 'city-d', costMultiple: 2.4, rentMultiple: 3.1,
    blurb: 'Screens, consoles and every cable in the city.',
    perk: 'Lower stock trading fee for its owner.',
    tradeoff: 'High build cost and no rent bonus.',
    perkKey: 'marketDesk', perkValue: 0.01,
  },
  supermarket: {
    name: 'Supermarket', category: 'shopping', model: 'city-e', costMultiple: 3.2, rentMultiple: 4.2,
    blurb: 'Aisles of groceries and a permanent crowd at the tills.',
    perk: 'Steady, reliable income at every rank.',
    tradeoff: 'Large footprint and no defensive effect.',
    perkKey: 'steadyIncome', perkValue: 0.035,
  },
  pharmacy: {
    name: 'Pharmacy', category: 'services', model: 'city-f', costMultiple: 1.9, rentMultiple: 2.4,
    blurb: 'Late-night prescriptions and a green cross over the door.',
    perk: 'Shortens hospital stays for its owner.',
    tradeoff: 'Modest rent and high build cost.',
    perkKey: 'healRecovery', perkValue: 0.2,
  },
  cafe: {
    name: 'Cafe', category: 'food', model: 'suburb-a', costMultiple: 1.3, rentMultiple: 1.7,
    blurb: 'Espresso, pastries and pavement tables.',
    perk: 'Small everyday income and a tiny spending discount.',
    tradeoff: 'Low rent multiplier.',
    perkKey: 'hospitality', perkValue: 0.01,
  },
  pizzeria: {
    name: 'Pizzeria', category: 'food', model: 'suburb-b', costMultiple: 1.8, rentMultiple: 2.4,
    blurb: 'A stone oven, red awnings and delivery scooters.',
    perk: 'Food traffic lifts rent on this property.',
    tradeoff: 'No protection against jail or theft.',
    perkKey: 'traffic', perkValue: 0.012,
  },
  burger_joint: {
    name: 'Burger Joint', category: 'food', model: 'suburb-c', costMultiple: 1.7, rentMultiple: 2.3,
    blurb: 'Fast food with a neon sign and a lunchtime rush.',
    perk: 'Fast, reliable income at a low price.',
    tradeoff: 'Small effect and no late-game scaling.',
    perkKey: 'steadyIncome', perkValue: 0.025,
  },
  ice_cream_shop: {
    name: 'Ice Cream Shop', category: 'food', model: 'suburb-d', costMultiple: 1.2, rentMultiple: 1.6,
    blurb: 'A tiny parlour with a big summer queue.',
    perk: 'The cheapest food plot with a traffic bonus.',
    tradeoff: 'Weakest rent on the board.',
    perkKey: 'traffic', perkValue: 0.008,
  },
  cinema: {
    name: 'Cinema', category: 'entertainment', model: 'city-g', costMultiple: 3.6, rentMultiple: 4.8,
    blurb: 'Three screens, fresh popcorn and a glowing marquee.',
    perk: 'Attracts extra landings, increasing rent.',
    tradeoff: 'Expensive and a target during a jail sale.',
    perkKey: 'traffic', perkValue: 0.015,
  },
  arcade: {
    name: 'Arcade', category: 'entertainment', model: 'city-h', costMultiple: 2.6, rentMultiple: 3.4,
    blurb: 'A wall of cabinets, token machines and high scores.',
    perk: 'High-variance bonus income each landing.',
    tradeoff: 'Can pay little or nothing on a bad roll.',
    perkKey: 'casino', perkValue: 0.02,
  },
  bowling_alley: {
    name: 'Bowling Alley', category: 'entertainment', model: 'city-i', costMultiple: 3.1, rentMultiple: 4.1,
    blurb: 'Twelve lanes, rented shoes and a Friday-night league.',
    perk: 'Group traffic bonus grows with each rank.',
    tradeoff: 'Costly and slow to repay.',
    perkKey: 'traffic', perkValue: 0.014,
  },
  nightclub: {
    name: 'Nightclub', category: 'entertainment', model: 'building-j', costMultiple: 4.2, rentMultiple: 5.6,
    blurb: 'A neon queue around the block after dark.',
    perk: 'Raises successful theft odds and the take.',
    tradeoff: 'Large reputation penalty when caught.',
    perkKey: 'underworld', perkValue: 0.02,
  },
  salon: {
    name: 'Hair Salon', category: 'services', model: 'building-e', costMultiple: 1.4, rentMultiple: 1.8,
    blurb: 'Cuts, colour and a window full of good chairs.',
    perk: 'Small reputation gain each turn.',
    tradeoff: 'Low rent and no defensive value.',
    perkKey: 'reputation', perkValue: 0.4,
  },
  gym: {
    name: 'Gym', category: 'services', model: 'building-g', costMultiple: 2.5, rentMultiple: 3.3,
    blurb: 'Memberships, free weights and a very busy treadmill row.',
    perk: 'Reduces the owner’s chance of being caught.',
    tradeoff: 'Mediocre rent for its price.',
    perkKey: 'security', perkValue: 0.01,
  },
  hospital: {
    name: 'Hospital', category: 'services', model: 'building-i', costMultiple: 4.8, rentMultiple: 6.4,
    blurb: 'A private wing with round-the-clock demand.',
    perk: 'Recovers part of cash lost to theft and shortens hospital time.',
    tradeoff: 'Very high build cost.',
    perkKey: 'healRecovery', perkValue: 0.1,
  },
  school: {
    name: 'School', category: 'services', model: 'building-l', costMultiple: 3.4, rentMultiple: 4.5,
    blurb: 'A busy campus with a waiting list every autumn.',
    perk: 'Slowly adds income to every owned property each turn.',
    tradeoff: 'Almost no immediate rent.',
    perkKey: 'schooling', perkValue: 0.015,
  },
  factory: {
    name: 'Factory', category: 'industry', model: 'city-far-a', costMultiple: 4.4, rentMultiple: 5.8,
    blurb: 'Smokestacks, loading bays and an endless night shift.',
    perk: 'Boosts rent on neighbouring same-group properties.',
    tradeoff: 'High cost and a weak solo rent.',
    perkKey: 'powerGrid', perkValue: 0.02,
  },
  warehouse: {
    name: 'Warehouse', category: 'industry', model: 'city-far-b', costMultiple: 3.8, rentMultiple: 5,
    blurb: 'Pallet racks stacked to the roof beside the freight line.',
    perk: 'Protects a share of cash from theft.',
    tradeoff: 'No court or legal benefit.',
    perkKey: 'cashShield', perkValue: 0.03,
  },
  parking_garage: {
    name: 'Parking Garage', category: 'services', model: 'city-far-c', costMultiple: 2.8, rentMultiple: 3.7,
    blurb: 'Six decks of downtown parking with no empty spaces.',
    perk: 'Cheap traffic draw that grows with rank.',
    tradeoff: 'Weak rent for a developed property.',
    perkKey: 'traffic', perkValue: 0.01,
  },
  tech_campus: {
    name: 'Tech Campus', category: 'industry', model: 'city-far-d', costMultiple: 6.2, rentMultiple: 8.2,
    blurb: 'Glass offices, a roof garden and a very long lease.',
    perk: 'Lowers stock fees and pays a small dividend.',
    tradeoff: 'The costliest non-landmark build.',
    perkKey: 'marketDesk', perkValue: 0.02,
  },
  museum: {
    name: 'Museum', category: 'entertainment', model: 'type-c', costMultiple: 5.4, rentMultiple: 7.1,
    blurb: 'Touring exhibitions and a gift shop by the entrance.',
    perk: 'Extra visitors mean extra rent.',
    tradeoff: 'Large upfront cost with no defensive perk.',
    perkKey: 'traffic', perkValue: 0.018,
  },
  stadium: {
    name: 'Stadium', category: 'entertainment', model: 'type-d', costMultiple: 7.5, rentMultiple: 10,
    blurb: 'Match days fill every seat and every nearby till.',
    perk: 'Boosts rent from all the owner’s other buildings.',
    tradeoff: 'Low direct income for the price.',
    perkKey: 'rentBoost', perkValue: 0.02,
  },
  amusement_park: {
    name: 'Amusement Park', category: 'entertainment', model: 'skyscraper-a', costMultiple: 9.5, rentMultiple: 12.5,
    blurb: 'A Ferris wheel, a coaster and a queue at every gate.',
    perk: 'Strong traffic bonus on the whole colour group.',
    tradeoff: 'The largest possible jail-sale loss.',
    perkKey: 'traffic', perkValue: 0.025,
  },
  bank_branch: {
    name: 'Bank Branch', category: 'services', model: 'city-b', costMultiple: 4.6, rentMultiple: 5.2,
    blurb: 'Marble counters and a queue of hopeful borrowers.',
    perk: 'Lowers loan interest and raises the borrowing limit.',
    tradeoff: 'Low rent and no property protection.',
    perkKey: 'loanDesk', perkValue: 0.15,
  },
  police_station: {
    name: 'Police Station', category: 'services', model: 'city-f', costMultiple: 5.2, rentMultiple: 5.6,
    blurb: 'Blue lights and a desk that never closes.',
    perk: 'Lowers the owner’s chance of being caught and arrested.',
    tradeoff: 'Expensive and disliked by underworld neighbours.',
    perkKey: 'lawAndOrder', perkValue: 0.04,
  },
  courthouse: {
    name: 'Courthouse', category: 'services', model: 'type-c', costMultiple: 6.4, rentMultiple: 6.8,
    blurb: 'Columns, oak doors and a very long docket.',
    perk: 'Lowers the filing fee and raises the owner’s court odds.',
    tradeoff: 'Very low rent for the price.',
    perkKey: 'courtDesk', perkValue: 0.025,
  },
  law_office: {
    name: 'Law Office', category: 'services', model: 'city-a', costMultiple: 5.8, rentMultiple: 6.2,
    blurb: 'Brass nameplates and billable hours.',
    perk: 'Raises the owner’s win chance in lawsuits.',
    tradeoff: 'High cost, modest rent, no income scaling.',
    perkKey: 'courtDesk', perkValue: 0.02,
  },
  stock_exchange: {
    name: 'Stock Exchange', category: 'industry', model: 'city-d', costMultiple: 8.2, rentMultiple: 9.8,
    blurb: 'A tower of screens, tickers and traders.',
    perk: 'Lower trading fees and a dividend bonus.',
    tradeoff: 'The largest non-landmark investment.',
    perkKey: 'marketDesk', perkValue: 0.025,
  },
  detective_agency: {
    name: 'Detective Agency', category: 'services', model: 'city-e', costMultiple: 3.9, rentMultiple: 4.4,
    blurb: 'A frosted-glass door and a very good filing cabinet.',
    perk: 'Lowers detective cost and improves detective success.',
    tradeoff: 'Weak rent and no direct cash protection.',
    perkKey: 'detectiveDesk', perkValue: 0.08,
  },
  security_company: {
    name: 'Security Company', category: 'services', model: 'city-h', costMultiple: 3.7, rentMultiple: 4,
    blurb: 'Concrete yard, patrol vans and a control room.',
    perk: 'Shortens jail time and reduces the release fee.',
    tradeoff: 'Low rent and expensive for a utility-style plot.',
    perkKey: 'jailDesk', perkValue: 0.12,
  },
  insurance_office: {
    name: 'Insurance Office', category: 'services', model: 'city-g', costMultiple: 5.1, rentMultiple: 5.3,
    blurb: 'A calm office that sells peace of mind.',
    perk: 'Refunds part of any large rent payment.',
    tradeoff: 'Low income and a high price.',
    perkKey: 'insurance', perkValue: 0.01,
  },
  casino: {
    name: 'Casino', category: 'entertainment', model: 'building-j', costMultiple: 4.9, rentMultiple: 4.6,
    blurb: 'Carpet, chips and a house edge.',
    perk: 'Chance of a large payout on every landing.',
    tradeoff: 'Can pay nothing; the highest-variance building.',
    perkKey: 'casino', perkValue: 0.03,
  },
  tax_office: {
    name: 'Tax Office', category: 'services', model: 'building-l', costMultiple: 6.1, rentMultiple: 5.9,
    blurb: 'Forms in triplicate and a very patient queue.',
    perk: 'Reduces the owner’s tax payments.',
    tradeoff: 'Low rent and no protection from jail.',
    perkKey: 'taxDesk', perkValue: 0.05,
  },
  fire_station: {
    name: 'Fire Station', category: 'services', model: 'city-far-b', costMultiple: 4.3, rentMultiple: 4.6,
    blurb: 'A red door, a brass pole and a waiting engine.',
    perk: 'Protects other buildings from events and downgrades.',
    tradeoff: 'No rent bonus and a high upkeep price.',
    perkKey: 'fireWatch', perkValue: 0.05,
  },
  university: {
    name: 'University', category: 'services', model: 'building-i', costMultiple: 7.2, rentMultiple: 7.4,
    blurb: 'A quad, a library and a lecture hall full of ambition.',
    perk: 'Raises income of every owned property each turn.',
    tradeoff: 'Slow to repay; almost no immediate rent.',
    perkKey: 'schooling', perkValue: 0.02,
  },
  power_plant: {
    name: 'Power Plant', category: 'industry', model: 'city-far-a', costMultiple: 6.7, rentMultiple: 7.2,
    blurb: 'Turbines, pylons and a low hum over the island.',
    perk: 'Boosts the output of neighbouring same-group properties.',
    tradeoff: 'Expensive and a target during a jail sale.',
    perkKey: 'powerGrid', perkValue: 0.025,
  },
  airport: {
    name: 'Airport', category: 'industry', model: 'city-far-a', costMultiple: 8.8, rentMultiple: 9.4,
    blurb: 'A runway, a control tower and a permanent departure board.',
    perk: 'Each owned transport hub adds rent to every property.',
    tradeoff: 'Huge cost and poor direct rent.',
    perkKey: 'transport', perkValue: 0.02,
  },
  train_station: {
    name: 'Train Station', category: 'industry', model: 'city-far-b', costMultiple: 5.6, rentMultiple: 6.1,
    blurb: 'A clock, four platforms and a coffee kiosk.',
    perk: 'Transport bonus per owned hub.',
    tradeoff: 'High price for a modest direct rent.',
    perkKey: 'transport', perkValue: 0.015,
  },
  bus_station: {
    name: 'Bus Station', category: 'industry', model: 'city-far-c', costMultiple: 4.4, rentMultiple: 4.8,
    blurb: 'A canopy, departure bays and a queue that never ends.',
    perk: 'Links the owner’s properties together for extra rent.',
    tradeoff: 'No defensive or court benefit.',
    perkKey: 'transport', perkValue: 0.01,
  },
  park: {
    name: 'Park', category: 'entertainment', model: 'suburb-a', costMultiple: 2.2, rentMultiple: 1.2,
    blurb: 'A green square with benches and a bandstand.',
    perk: 'Gives reputation each turn and a visitor bonus.',
    tradeoff: 'Very low rent.',
    perkKey: 'reputation', perkValue: 1,
  },
  playground: {
    name: 'Playground', category: 'entertainment', model: 'suburb-d', costMultiple: 1.9, rentMultiple: 1.1,
    blurb: 'Swings, a slide and a very loud afternoon.',
    perk: 'Cheap reputation gain and traffic.',
    tradeoff: 'Almost no direct income.',
    perkKey: 'reputation', perkValue: 0.7,
  },
  theater: {
    name: 'Theater', category: 'entertainment', model: 'building-j', costMultiple: 5.3, rentMultiple: 6.6,
    blurb: 'Velvet seats, a lit marquee and a sold-out run.',
    perk: 'Raises visitor traffic on the group.',
    tradeoff: 'Expensive and no defensive effect.',
    perkKey: 'traffic', perkValue: 0.016,
  },
  zoo: {
    name: 'Zoo', category: 'entertainment', model: 'city-far-d', costMultiple: 7.8, rentMultiple: 8.8,
    blurb: 'Habitat paths and a queue at the gate.',
    perk: 'Strong traffic bonus and steady visitor income.',
    tradeoff: 'Very large build and upkeep cost.',
    perkKey: 'traffic', perkValue: 0.02,
  },
  bank_vault: {
    name: 'Bank Vault', category: 'industry', model: 'city-e', costMultiple: 6.8, rentMultiple: 7,
    blurb: 'Steel doors and a very private basement.',
    perk: 'Protects a share of cash from theft.',
    tradeoff: 'Low rent and no court protection.',
    perkKey: 'cashShield', perkValue: 0.07,
  },
  armored_depot: {
    name: 'Armored Depot', category: 'industry', model: 'city-far-b', costMultiple: 5.7, rentMultiple: 5.8,
    blurb: 'Reinforced doors and a fleet of grey vans.',
    perk: 'Lowers theft losses and raises security.',
    tradeoff: 'Weak rent for a fortified plot.',
    perkKey: 'cashShield', perkValue: 0.05,
  },
  smugglers_den: {
    name: "Smuggler's Den", category: 'entertainment', model: 'building-j', costMultiple: 3.4, rentMultiple: 4.9,
    blurb: 'A quiet door, a loud cellar and no questions.',
    perk: 'Raises theft odds and the cash taken.',
    tradeoff: 'Raises the reputation penalty when caught.',
    perkKey: 'underworld', perkValue: 0.035,
  },
  bakery: {
    name: 'Bakery', category: 'food', model: 'suburb-c', costMultiple: 2, rentMultiple: 2.5,
    blurb: 'Warm bread, cold mornings and a queue by seven.',
    perk: 'Small income and a spending discount.',
    tradeoff: 'Low rent ceiling.',
    perkKey: 'hospitality', perkValue: 0.012,
  },
  food_truck_park: {
    name: 'Food Truck Park', category: 'food', model: 'city-e', costMultiple: 2.7, rentMultiple: 3.4,
    blurb: 'Six trucks, picnic tables and string lights.',
    perk: 'Food traffic lifts group rent.',
    tradeoff: 'Expensive for its small direct rent.',
    perkKey: 'hospitality', perkValue: 0.014,
  },
  farmers_market: {
    name: 'Farmers Market', category: 'shopping', model: 'shop', costMultiple: 2.9, rentMultiple: 3.2,
    blurb: 'Cider, squash and apples under striped awnings.',
    perk: 'Seasonal income rises with each rank.',
    tradeoff: 'No defensive or legal effect.',
    perkKey: 'seasonal', perkValue: 0.025,
  },
  pumpkin_patch: {
    name: 'Pumpkin Patch', category: 'shopping', model: 'suburb-d', costMultiple: 1.8, rentMultiple: 1.9,
    blurb: 'Orange rows, a hay maze and a very large pumpkin.',
    perk: 'Cheap seasonal traffic bonus.',
    tradeoff: 'Low rent outside the harvest season.',
    perkKey: 'seasonal', perkValue: 0.02,
  },
  turkey_farm: {
    name: 'Turkey Farm', category: 'food', model: 'house', costMultiple: 2.4, rentMultiple: 2.8,
    blurb: 'A red barn, a fence and a chorus of gobbles.',
    perk: 'Seasonal income and a small reputation gain.',
    tradeoff: 'Low rent and a high build cost.',
    perkKey: 'seasonal', perkValue: 0.022,
  },
  harvest_hall: {
    name: 'Harvest Hall', category: 'entertainment', model: 'building-j', costMultiple: 6.9, rentMultiple: 8,
    blurb: 'A long table, warm light and enough pie for everyone.',
    perk: 'A large autumn traffic bonus for the whole group.',
    tradeoff: 'The most expensive seasonal building.',
    perkKey: 'seasonal', perkValue: 0.03,
  },
} as const satisfies Record<string, BuildingMeta>;

export type BuildingType = keyof typeof BUILDING_CATALOG;
export type BuildingCategory = (typeof BUILDING_CATALOG)[BuildingType]['category'];

/** Every multiplayer property has exactly three independent building slots. */
export const BUILD_SLOTS = 3;

/** The nth copy of one type on a property earns this share of its perk/income. */
export const DUPLICATE_RETURN_FACTORS = [1, 0.7, 0.5] as const;

export function buildSlots(_space: { price: number }): number {
  return BUILD_SLOTS;
}

/** Factor for the building at `index`; only earlier copies of the same type count. */
export function duplicateFactor(buildings: ReadonlyArray<{ type: string }>, index: number): number {
  const type = buildings[index]?.type;
  if (!type) return 1;
  const copy = buildings.slice(0, index).filter((b) => b.type === type).length;
  return DUPLICATE_RETURN_FACTORS[Math.min(copy, DUPLICATE_RETURN_FACTORS.length - 1)]!;
}

export const BUILDING_META = BUILDING_CATALOG;
export const BUILDING_TYPES = Object.keys(BUILDING_CATALOG) as BuildingType[];

export const BUILDING_CATEGORIES: Array<{ id: BuildingCategory; label: string; icon: string }> = [
  { id: 'shopping', label: 'Shopping', icon: '🛍' },
  { id: 'food', label: 'Food & drink', icon: '🍽' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎟' },
  { id: 'services', label: 'Services', icon: '🛠' },
  { id: 'industry', label: 'Industry', icon: '🏭' },
  { id: 'stay', label: 'Stay', icon: '🛏' },
  { id: 'landmark', label: 'Landmarks', icon: '🏛' },
];

/** Solo keeps printed house/hotel rules; multiplayer exposes the full catalog. */
export function buildingTypesForMode(mode: 'solo' | 'multi'): BuildingType[] {
  return mode === 'solo' ? ['house', 'hotel'] : BUILDING_TYPES;
}
