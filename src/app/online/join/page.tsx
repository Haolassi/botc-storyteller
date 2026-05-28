"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { setOnlineIdentity } from "@/lib/online/browserIdentity";
import type { OnlineRoom, RoomMember } from "@/types/online";

type JoinRoomResponse =
  | {
      room: OnlineRoom;
      member: RoomMember;
    }
  | {
      error: string;
    };

export default function OnlineJoinPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoinRoom() {
    const trimmedDisplayName = displayName.trim();
    const normalizedRoomCode = roomCode.trim().toUpperCase();

    if (!trimmedDisplayName) {
      setError("请输入显示名。");
      return;
    }

    if (!normalizedRoomCode) {
      setError("请输入房间码。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/online/rooms/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomCode: normalizedRoomCode,
          displayName: trimmedDisplayName,
        }),
      });
      const result = (await response.json()) as JoinRoomResponse;

      if (!response.ok || "error" in result) {
        setError(
          response.status === 409
            ? "当前浏览器已经以其他身份加入该房间。请使用无痕窗口、其他浏览器，或重新打开新的玩家身份。"
            : "error" in result
              ? result.error
              : "加入房间失败。",
        );
        return;
      }

      setOnlineIdentity({
        userId: result.member.userId,
        memberId: result.member.id,
        displayName: result.member.displayName,
        roomId: result.room.id,
      });

      router.push(`/online/rooms/${result.room.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "加入房间失败。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="联机房间"
        title="加入联机房间"
        description="输入显示名和房间码，加入一个等待中的联机房间。"
        actions={
          <Button asChild variant="outline">
            <Link href="/online">
              <ArrowLeft aria-hidden="true" />
              返回联机入口
            </Link>
          </Button>
        }
      />

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="grid max-w-md gap-4">
          <div>
            <label
              htmlFor="display-name"
              className="text-sm font-medium text-gray-900"
            >
              显示名
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="例如：玩家一"
              className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="room-code"
              className="text-sm font-medium text-gray-900"
            >
              房间码
            </label>
            <input
              id="room-code"
              type="text"
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.trim().toUpperCase())
              }
              placeholder="例如：ABC234"
              className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleJoinRoom}
          disabled={isSubmitting}
          className="mt-4"
        >
          {isSubmitting ? "加入中..." : "加入房间"}
        </Button>
      </section>
    </div>
  );
}
