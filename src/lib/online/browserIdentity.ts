"use client";

const ONLINE_IDENTITY_CHANGE_EVENT = "online-identity-change";

export type OnlineBrowserIdentity = {
  userId?: string;
  memberId?: string;
  displayName?: string;
  roomId?: string;
  gameId?: string;
};

function readValue(key: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.sessionStorage.getItem(key) ?? undefined;
}

function writeValue(key: string, value: string | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(key, value);
  } else {
    window.sessionStorage.removeItem(key);
  }
}

function notifyIdentityChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ONLINE_IDENTITY_CHANGE_EVENT));
}

export function subscribeOnlineIdentityChange(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ONLINE_IDENTITY_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ONLINE_IDENTITY_CHANGE_EVENT, onStoreChange);
  };
}

export function getOnlineIdentity(): OnlineBrowserIdentity {
  return {
    userId: readValue("onlineUserId"),
    memberId: readValue("onlineMemberId"),
    displayName: readValue("onlineDisplayName"),
    roomId: readValue("onlineRoomId"),
    gameId: readValue("onlineGameId"),
  };
}

export function getOnlineMemberId() {
  return getOnlineIdentity().memberId ?? null;
}

export function setOnlineIdentity(identity: OnlineBrowserIdentity) {
  writeValue("onlineUserId", identity.userId);
  writeValue("onlineMemberId", identity.memberId);
  writeValue("onlineDisplayName", identity.displayName);
  writeValue("onlineRoomId", identity.roomId);
  writeValue("onlineGameId", identity.gameId);
  notifyIdentityChanged();
}

export function updateOnlineIdentity(identity: OnlineBrowserIdentity) {
  setOnlineIdentity({
    ...getOnlineIdentity(),
    ...identity,
  });
}

export function clearOnlineRoomIdentity() {
  writeValue("onlineMemberId", undefined);
  writeValue("onlineRoomId", undefined);
  writeValue("onlineGameId", undefined);
  notifyIdentityChanged();
}
