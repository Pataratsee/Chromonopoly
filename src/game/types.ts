import type { GroupKey, QualityKey } from '../config';
import type { BuildingType } from './buildings';

export type { BuildingType } from './buildings';

export type GameMode = 'solo' | 'multi';

export type SpaceType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'free'
  | 'gotojail';

export interface Space {
  index: number;
  name: string;
  type: SpaceType;
  group: GroupKey | null;
  price: number;
  rents: number[];
  buildCost: number;
  mortgage: number;
  tax?: number;
  icon: string;
  label?: string;
}

/** One independently upgradable building. Multiplayer may hold several. */
export interface Building {
  type: BuildingType;
  rank: 1 | 2 | 3 | 4;
}

export interface TileState {
  ownerId: string | null;
  mortgaged: boolean;
  buildings: Building[];
  shares: Record<string, number>;
  lockedBy: string | null;
}

export interface JailRecordEntry {
  tile: number;
  amount: number;
  at: number;
}

export interface ReputationEntry {
  at: number;
  text: string;
}

export interface ChanceZone {
  key: string;
  label: string;
  percent: number;
}

export interface ChanceRoll {
  label: string;
  percent: number;
  success: boolean;
  rollPercent: number;
  result?: string;
  zones?: ChanceZone[];
}

export interface PlayerPublic {
  id: string;
  name: string;
  tokenId: string;
  color: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  jailReleaseCost: number;
  jailCause: string | null;
  jailOutcome: 'all' | 'some' | 'none' | null;
  jailSold: number[];
  inHospital: boolean;
  hospitalTurns: number;
  bankrupt: boolean;
  jailRecord: JailRecordEntry[];
  lastSeen: number;
  online: boolean;
  isBot: boolean;
}

export interface DossierEntry {
  reputation: number;
  evidence: number;
  at: number;
  record: JailRecordEntry[];
  acts: ReputationEntry[];
}

export interface PlayerPrivate extends PlayerPublic {
  reputation: number;
  dossier: Record<string, DossierEntry>;
  acts: ReputationEntry[];
  loan: number;
  holdings: Record<string, number>;
  costBasis: Record<string, number>;
  realizedPnl: number;
  unpaidRent: number;
}

export interface Pending {
  kind: 'buy' | 'rent';
  tile: number;
  amount: number;
  expiresAt: number;
  ownerId?: string;
}

export interface TradeSide {
  cash: number;
  properties: number[];
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  give: TradeSide;
  want: TradeSide;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'cancelled' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface MarketFeedEntry {
  id: number;
  at: number;
  tile: number;
  name: string;
  oldPrice: number;
  newPrice: number;
  percent: number;
}

export interface PublicState {
  seq: number;
  serverTime: number;
  mode: GameMode;
  activePlayerId: string | null;
  turnNumber: number;
  players: Record<string, PlayerPublic>;
  tiles: Record<number, TileState>;
  prices: Record<number, number>;
  log: LogEntry[];
  /** Public-only logs grouped by player; private acts never enter this map. */
  playerLogs: Record<string, LogEntry[]>;
  marketFeed: MarketFeedEntry[];
  buildingCount: number;
  gameOver: null | { winnerId: string; at: number };
}

export interface LogEntry {
  id: number;
  at: number;
  text: string;
  kind: 'info' | 'money' | 'crime' | 'court' | 'build';
}

export interface Suit {
  id: string;
  plaintiffId: string;
  defendantId: string;
  claim: number;
  evidence: number;
  filedAt: number;
  status: 'pending' | 'closed' | 'dismissed';
}

export interface Offer {
  id: string;
  kind: 'settle';
  fromId: string;
  toId: string;
  suitId: string;
  claim: number;
}

export interface PrivateState {
  you: PlayerPrivate;
  offers: Offer[];
  suits: Suit[];
  trades: TradeOffer[];
  pending: Pending | null;
  netWorth: number;
  loanCap: number;
  /** The recipient's own log; includes private underworld acts and offline sales. */
  playerLog: LogEntry[];
}

export interface CrimeOutcome {
  success: boolean;
  kind: 'theft' | 'robbery' | 'murder' | 'detective' | 'wipe';
  amount: number;
  targetName?: string;
  taken?: string[];
  reputationDelta: number;
  detail: string;
}

export type Intent =
  | { t: 'roll'; key: string }
  | { t: 'buy'; tile: number; key: string }
  | { t: 'decline'; tile: number; key: string }
  | { t: 'build'; tile: number; type: BuildingType; key: string }
  | { t: 'upgrade'; tile: number; type: BuildingType; key: string }
  | { t: 'sellBuilding'; tile: number; type: BuildingType; key: string }
  | { t: 'mortgage'; tile: number; key: string }
  | { t: 'unmortgage'; tile: number; key: string }
  | { t: 'loan'; amount: number; key: string }
  | { t: 'repayLoan'; amount: number; key: string }
  | { t: 'stock'; tile: number; qty: number; key: string }
  | { t: 'theft'; target: string; key: string }
  | { t: 'robbery'; amount: number; key: string }
  | { t: 'murder'; target: string; key: string }
  | { t: 'evade'; tile: number; key: string }
  | { t: 'payRent'; tile: number; key: string }
  | { t: 'hireDetective'; target: string; key: string }
  | { t: 'sue'; target: string; claim: number; key: string }
  | { t: 'settle'; suitId: string; key: string }
  | { t: 'court'; suitId: string; key: string }
  | { t: 'jailPay'; key: string }
  | { t: 'selectToken'; tokenId: string; key: string }
  | { t: 'selectColor'; color: string; key: string }
  | { t: 'recordWipe'; key: string }
  | { t: 'tradeOffer'; targetId: string; giveCash: number; giveTiles: number[]; wantCash: number; wantTiles: number[]; key: string }
  | { t: 'tradeAccept'; tradeId: string; key: string }
  | { t: 'tradeDecline'; tradeId: string; key: string }
  | { t: 'tradeCounter'; tradeId: string; giveCash: number; giveTiles: number[]; wantCash: number; wantTiles: number[]; key: string };

export interface GameEvent {
  kind:
    | 'roll'
    | 'move'
    | 'cash'
    | 'purchase'
    | 'rent'
    | 'build'
    | 'card'
    | 'jail'
    | 'theft'
    | 'murder'
    | 'hospital'
    | 'detective'
    | 'verdict'
    | 'stock'
    | 'loan'
    | 'trade'
    | 'wipe'
    | 'turn'
    | 'win';
  playerId?: string;
  targetId?: string;
  audience?: string[];
  tile?: number;
  amount?: number;
  dice?: [number, number];
  text?: string;
  deck?: 'chance' | 'chest';
  chance?: ChanceRoll;
  outcome?: CrimeOutcome;
  taken?: number[];
  at?: number;
}

export interface ServerMessage {
  type: 'state' | 'private' | 'welcome' | 'rejected' | 'event' | 'resync';
  seq?: number;
  state?: PublicState;
  private?: PrivateState;
  playerId?: string;
  session?: string;
  mode?: GameMode;
  reason?: string;
  key?: string;
  event?: GameEvent;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  sfxOn: boolean;
  musicOn: boolean;
  cameraSpeed: number;
  invertOrbit: boolean;
  shake: boolean;
  quality: QualityKey;
  reducedMotion: boolean;
  uiScale: number;
  colorblind: boolean;
  showPrices: boolean;
  darkMode: boolean;
  followCamera: boolean;
  skyRunning: boolean;
  skyHour: number;
  fpsCounter: boolean;
  fastBots: boolean;
}
