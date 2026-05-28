import type {
  Alignment,
  DaySubPhase,
  GameLogCategory,
  GameLogVisibility,
  WinningTeam,
} from "@/types/game";

export type PhaseOperationAction =
  | {
      type: "ADVANCE_PHASE";
    }
  | {
      type: "RETREAT_PHASE";
    }
  | {
      type: "RESET_PHASE_ACTIONS";
    }
  | {
      type: "SET_DAY_SUB_PHASE";
      payload: {
        subPhase: DaySubPhase;
      };
    }
  | {
      type: "END_GAME_MANUALLY";
      payload: {
        winningTeam: Exclude<WinningTeam, null>;
      };
    };

export type NominationAction =
  | {
      type: "RESOLVE_NOMINATION";
      payload: {
        nominatorPlayerId: string;
        nomineePlayerId: string;
        votePlayerIds: string[];
        createdAt?: string;
        actorPlayerId?: string;
      };
    }
  | {
      type: "CLEAR_EXECUTION_CANDIDATE";
      payload?: {
        reason?: string;
        createdAt?: string;
        actorPlayerId?: string;
      };
    };

export type PlayerStatusAction = {
  type: "UPDATE_PLAYER_STATUS";
  payload: {
    playerId: string;
    isAlive?: boolean;
    isPoisoned?: boolean;
    isDrunk?: boolean;
    reason?: string;
    createdAt?: string;
    actorPlayerId?: string;
  };
};

export type DayAbilityAction = {
  type: "USE_DAY_ABILITY";
  payload: {
    characterId: string;
    actorPlayerId: string;
    targetPlayerId?: string;
    selectedCharacterId?: string;
    note?: string;
    createdAt?: string;
  };
};

export type ManualNoteAction = {
  type: "ADD_MANUAL_NOTE";
  payload: {
    title?: string;
    description: string;
    category?: GameLogCategory;
    visibility?: GameLogVisibility;
    metadata?: Record<string, unknown>;
    createdAt?: string;
    actorPlayerId?: string;
  };
};

export type CompleteNightStepAction = {
  type: "COMPLETE_NIGHT_STEP";
  payload?: {
    stepId?: string;
    note?: string;
    createdAt?: string;
    actorPlayerId?: string;
  };
};

export type ApplyNightAction = {
  type: "APPLY_NIGHT_ACTION";
  payload: {
    stepId?: string;
    characterId?: string;
    actorPlayerId?: string;
    targetPlayerIds?: string[];
    selectedCharacterId?: string;
    note?: string;
    infoNoRoleInPlay?: boolean;
    referenceNumber?: number;
    yesNoAnswer?: "yes" | "no";
    protectedPlayerId?: string;
    mayorRedirectPlayerId?: string;
    registrationOverrides?: Record<
      string,
      {
        alignment?: Alignment;
        characterId?: string;
      }
    >;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  };
};

export type ResetNightActionsAction = {
  type: "RESET_NIGHT_ACTIONS";
  payload?: {
    reason?: string;
    createdAt?: string;
    actorPlayerId?: string;
  };
};

export type NightAction =
  | CompleteNightStepAction
  | ApplyNightAction
  | ResetNightActionsAction;

export type GameAction =
  | PhaseOperationAction
  | NominationAction
  | PlayerStatusAction
  | DayAbilityAction
  | ManualNoteAction
  | NightAction;
