import type { GameAction } from "@/types/actions";
import type { Game } from "@/types/game";

export type OnlineRoomStatus = "waiting" | "playing" | "ended";

export type OnlineRoomRole = "storyteller" | "player" | "spectator";

export type OnlineRoom = {
  id: string;
  roomCode: string;
  gameId?: string;
  storytellerUserId: string;
  status: OnlineRoomStatus;
  createdAt: string;
  updatedAt: string;
};

export type RoomMember = {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  role: OnlineRoomRole;
  playerId?: string;
  joinedAt: string;
  lastSeenAt?: string;
};

export type OnlineViewerContext = {
  roomId: string;
  userId: string;
  memberId: string;
  role: OnlineRoomRole;
  playerId?: string;
};

export type CreateOnlineRoomInput = {
  storytellerUserId: string;
  displayName: string;
};

export type JoinOnlineRoomInput = {
  roomCode: string;
  userId: string;
  displayName: string;
  role?: OnlineRoomRole;
};

export type RemoteGameActionEnvelope = {
  id?: string;
  roomId: string;
  gameId: string;
  actorUserId: string;
  actorMemberId?: string;
  action: GameAction;
  clientActionId?: string;
  createdAt: string;
};

export type OnlineRoomSnapshot = {
  room: OnlineRoom;
  members: RoomMember[];
  game?: Game;
};
