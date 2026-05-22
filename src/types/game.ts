export type CharacterType =
  | "townsfolk"
  | "outsider"
  | "minion"
  | "demon";

export type Alignment = "good" | "evil";

export type AbilityTiming =
  | "setup"
  | "first_night"
  | "each_night"
  | "each_night_except_first"
  | "day"
  | "on_death"
  | "passive";

export type AbilityInteractionType =
  | "storyteller_inputs_private_info"
  | "player_selects_target"
  | "storyteller_selects_target"
  | "passive_state_modifier"
  | "public_trigger"
  | "setup_modifier";

export interface Character {
  id: string;
  nameZh: string;
  nameEn: string;
  type: CharacterType;
  alignment: Alignment;
  editions: string[];
  abilityCode: string;
  abilitySummaryZh: string;
  timing: AbilityTiming[];
  interactionType: AbilityInteractionType;
  requiresStorytellerInput: boolean;
  requiresPlayerInput: boolean;
  firstNightOrder?: number;
  otherNightOrder?: number;
}

export interface Script {
  id: string;
  nameZh: string;
  nameEn: string;
  minPlayers: number;
  maxPlayers: number;
  characterIds: string[];
}

export interface AbilityTemplate {
  abilityCode: string;
  actor: "storyteller" | "player" | "system";
  targetType?: "player" | "character" | "number" | "boolean" | "none";
  targetCount?: number | "variable";
  requiresStorytellerConfirmation: boolean;
  descriptionZh: string;
  playerMessageTemplate?: string;
}

export type GameStatus = "setup" | "running" | "finished";

export type GamePhase = "dusk" | "night" | "day" | "ended";

export type DaySubPhase =
  | "private_chat"
  | "speeches"
  | "open_discussion"
  | "nomination"
  | "execution";

export type WinningTeam = "good" | "evil" | null;

export type GameLogType =
  | "phase_change"
  | "player_death"
  | "player_executed"
  | "nomination"
  | "vote"
  | "night_action"
  | "private_info"
  | "status_change"
  | "win_condition"
  | "manual_note";

export interface GameLogEntry {
  id: string;
  gameId: string;
  day: number;
  phase: GamePhase;
  subPhase?: DaySubPhase | null;
  type: GameLogType;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface NominationRecord {
  id: string;
  gameId: string;
  day: number;
  nominatorPlayerId: string;
  nomineePlayerId: string;
  votePlayerIds: string[];
  voteCount: number;
  requiredVotes: number;
  isOnBlock: boolean;
  createdAt: string;
}

export interface ExecutionState {
  day: number;
  executedPlayerId?: string;
  pendingDeathPlayerId?: string;
  nominations: NominationRecord[];
  usedNominatorPlayerIds: string[];
  usedNomineePlayerIds: string[];
}

export interface NightActionState {
  day: number;
  currentStepIndex: number;
  completedStepIds: string[];
}

export interface GamePlayer {
  id: string;
  gameId: string;
  seatNumber: number;
  displayName: string;
  userId?: string;

  characterId?: string;
  apparentCharacterId?: string;
  alignment?: Alignment;

  isAlive: boolean;
  isDrunk: boolean;
  isPoisoned: boolean;
}

export interface Game {
  id: string;
  scriptId: string;
  status: GameStatus;

  storytellerId?: string;
  players: GamePlayer[];

  currentDay: number;
  currentPhase: GamePhase;
  currentDaySubPhase: DaySubPhase | null;

  winningTeam: WinningTeam;

  executionState: ExecutionState;
  nightActionState: NightActionState;
  logs: GameLogEntry[];

  createdAt: string;
  updatedAt: string;
}

export interface AbilityAction {
  id: string;
  gameId: string;
  actorPlayerId: string;
  sourceCharacterId: string;

  timing: AbilityTiming;
  status: "pending" | "submitted" | "resolved" | "cancelled";

  targetPlayerIds: string[];
  targetCharacterIds?: string[];

  submittedAt?: string;
  resolvedAt?: string;

  resultPrivateInfoId?: string;
}

export interface PrivateInfo {
  id: string;
  gameId: string;
  recipientPlayerId: string;
  sourceCharacterId: string;

  title: string;
  content: string;
  payload: Record<string, unknown>;

  createdBy: "storyteller" | "system";
  createdAt: string;
  isRevealedToPlayer: boolean;
}