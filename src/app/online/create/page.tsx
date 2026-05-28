"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { OnlineRoom, RoomMember } from "@/types/online";

type CreateRoomResponse =
  | {
      room: OnlineRoom;
      member: RoomMember;
    }
  | {
      error: string;
    };

async function readCreateRoomResponse(
  response: Response,
): Promise<CreateRoomResponse> {
  const text = await response.text();

  if (!text) {
    return {
      error: `创建房间失败：服务器返回空响应（${response.status}）。`,
    };
  }

  try {
    return JSON.parse(text) as CreateRoomResponse;
  } catch {
    return {
      error: `创建房间失败：服务器返回了非 JSON 响应（${response.status}）。请检查 Vercel 环境变量和函数日志。`,
    };
  }
}

export default function OnlineCreatePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom() {
    const trimmedDisplayName = displayName.trim();

    if (!trimmedDisplayName) {
      setError("请输入显示名。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/online/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: trimmedDisplayName,
        }),
      });
      const result = await readCreateRoomResponse(response);

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "创建房间失败。");
        return;
      }

      window.localStorage.setItem("onlineUserId", result.member.userId);
      window.localStorage.setItem("onlineMemberId", result.member.id);
      window.localStorage.setItem("onlineDisplayName", result.member.displayName);
      window.localStorage.setItem("onlineRoomId", result.room.id);

      router.push(`/online/rooms/${result.room.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "创建房间失败。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="联机房间"
        title="创建联机房间"
        description="输入说书人的显示名，创建一个等待中的联机房间。"
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
          placeholder="例如：说书人"
          className="mt-2 block w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
        />

        {error ? (
          <div className="mt-3 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleCreateRoom}
          disabled={isSubmitting}
          className="mt-4"
        >
          {isSubmitting ? "创建中..." : "创建房间"}
        </Button>
      </section>
    </div>
  );
}
