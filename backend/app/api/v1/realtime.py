"""Real-time collaboration routes and presence tracking."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import and_, func, select

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.core.security import decode_token
from app.models.book import BookChapter
from app.models.chapter import Chapter
from app.models.collaboration import Collaborator
from app.models.user import User

router = APIRouter(prefix="/ws", tags=["Real-time Collaboration"])


class ConnectionManager:
    """Manages websocket connections and presence by chapter."""

    def __init__(self) -> None:
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.presence: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.collaboration_state: Dict[str, Dict[str, Any]] = {}

    async def connect(
        self,
        chapter_id: str,
        user_id: str,
        websocket: WebSocket,
        user_name: str,
        user_avatar: Optional[str] = None,
    ) -> None:
        await websocket.accept()

        if chapter_id not in self.active_connections:
            self.active_connections[chapter_id] = {}
            self.presence[chapter_id] = {}
            self.collaboration_state[chapter_id] = {
                "chapter_id": chapter_id,
                "last_update": datetime.now(timezone.utc).isoformat(),
            }

        self.active_connections[chapter_id][user_id] = websocket
        self.presence[chapter_id][user_id] = {
            "user_id": user_id,
            "name": user_name,
            "avatar": user_avatar,
            "cursor_pos": 0,
            "selection": None,
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        }

        await self.broadcast_presence(chapter_id)

    def disconnect(self, chapter_id: str, user_id: str) -> None:
        if chapter_id in self.active_connections:
            self.active_connections[chapter_id].pop(user_id, None)

        if chapter_id in self.presence:
            self.presence[chapter_id].pop(user_id, None)

        if chapter_id in self.active_connections and not self.active_connections[chapter_id]:
            self.active_connections.pop(chapter_id, None)
            self.presence.pop(chapter_id, None)
            self.collaboration_state.pop(chapter_id, None)

    async def broadcast(
        self,
        chapter_id: str,
        message: Dict[str, Any],
        exclude_user: Optional[str] = None,
    ) -> None:
        if chapter_id not in self.active_connections:
            return

        dead_connections: list[str] = []
        for user_id, connection in self.active_connections[chapter_id].items():
            if exclude_user and user_id == exclude_user:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(user_id)

        for user_id in dead_connections:
            self.disconnect(chapter_id, user_id)

    async def broadcast_presence(self, chapter_id: str) -> None:
        users = list(self.presence.get(chapter_id, {}).values())
        await self.broadcast(chapter_id, {"type": "presence_update", "users": users})

    async def broadcast_cursor(
        self,
        chapter_id: str,
        user_id: str,
        position: int,
        selection: Optional[Dict[str, int]] = None,
    ) -> None:
        if chapter_id in self.presence and user_id in self.presence[chapter_id]:
            self.presence[chapter_id][user_id]["cursor_pos"] = position
            self.presence[chapter_id][user_id]["selection"] = selection
            self.presence[chapter_id][user_id]["last_activity"] = datetime.now(
                timezone.utc
            ).isoformat()

        await self.broadcast(
            chapter_id,
            {
                "type": "cursor_update",
                "user_id": user_id,
                "position": position,
                "selection": selection,
            },
            exclude_user=user_id,
        )

    async def broadcast_edit(self, chapter_id: str, user_id: str, delta: Dict[str, Any]) -> None:
        await self.broadcast(
            chapter_id,
            {
                "type": "text_edit",
                "user_id": user_id,
                "delta": delta,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            exclude_user=user_id,
        )


manager = ConnectionManager()


async def _resolve_socket_user(websocket: WebSocket, db: AsyncSessionDep) -> Optional[User]:
    query_string = websocket.scope.get("query_string", b"").decode()
    token = parse_qs(query_string).get("token", [None])[0]
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing auth token",
        )
        return None

    token_data = decode_token(token)
    if token_data is None or token_data.token_type != "access":
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid auth token",
        )
        return None

    try:
        user_id = uuid.UUID(token_data.user_id)
    except ValueError:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid user id in token",
        )
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Inactive or missing user",
        )
        return None

    return user


async def _has_chapter_access(
    db: AsyncSessionDep,
    chapter_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    chapter_result = await db.execute(
        select(Chapter.user_id).where(Chapter.id == chapter_id)
    )
    owner_id = chapter_result.scalar_one_or_none()
    if owner_id is None:
        return False

    if owner_id == user_id:
        return True

    collab_result = await db.execute(
        select(func.count(Collaborator.id))
        .join(BookChapter, and_(BookChapter.book_id == Collaborator.book_id))
        .where(
            BookChapter.chapter_id == chapter_id,
            Collaborator.user_id == user_id,
            Collaborator.is_accepted.is_(True),
        )
    )
    return (collab_result.scalar() or 0) > 0


@router.websocket("/chapters/{chapter_id}/collaborate")
async def websocket_endpoint(
    chapter_id: uuid.UUID,
    websocket: WebSocket,
    db: AsyncSessionDep,
) -> None:
    user = await _resolve_socket_user(websocket, db)
    if user is None:
        return

    has_access = await _has_chapter_access(db, chapter_id, user.id)
    if not has_access:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="No access to chapter",
        )
        return

    chapter_key = str(chapter_id)
    user_key = str(user.id)
    user_name = user.full_name or user.email or "Unknown"

    await manager.connect(
        chapter_id=chapter_key,
        user_id=user_key,
        websocket=websocket,
        user_name=user_name,
        user_avatar=user.avatar_url,
    )

    try:
        while True:
            payload = await websocket.receive_json()
            message_type = str(payload.get("type") or "").strip()

            if message_type == "cursor_move":
                position = int(payload.get("position") or 0)
                selection = payload.get("selection")
                await manager.broadcast_cursor(chapter_key, user_key, position, selection)

            elif message_type == "text_edit":
                delta = payload.get("delta") or {}
                if isinstance(delta, dict):
                    await manager.broadcast_edit(chapter_key, user_key, delta)

            elif message_type == "comment_added":
                await manager.broadcast(
                    chapter_key,
                    {
                        "type": "comment_added",
                        "data": payload.get("data") or {},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    exclude_user=user_key,
                )

            elif message_type == "suggestion_added":
                await manager.broadcast(
                    chapter_key,
                    {
                        "type": "suggestion_added",
                        "data": payload.get("data") or {},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    exclude_user=user_key,
                )

            elif message_type == "typing":
                is_typing = bool(payload.get("is_typing", False))
                await manager.broadcast(
                    chapter_key,
                    {
                        "type": "user_typing",
                        "user_id": user_key,
                        "is_typing": is_typing,
                    },
                    exclude_user=user_key,
                )

            elif message_type == "request_sync":
                chapter_result = await db.execute(
                    select(Chapter).where(Chapter.id == chapter_id)
                )
                chapter = chapter_result.scalar_one_or_none()
                if chapter is not None:
                    await websocket.send_json(
                        {
                            "type": "sync_response",
                            "content": chapter.compiled_content or "",
                            "last_modified": (
                                chapter.updated_at.isoformat()
                                if chapter.updated_at
                                else None
                            ),
                        }
                    )

            elif message_type == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(chapter_key, user_key)
        await manager.broadcast_presence(chapter_key)


@router.get("/chapters/{chapter_id}/presence")
async def get_chapter_presence(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    user_uuid = uuid.UUID(user_id)
    has_access = await _has_chapter_access(db, chapter_id, user_uuid)
    if not has_access:
        return {
            "chapter_id": str(chapter_id),
            "active_users": [],
            "count": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    chapter_key = str(chapter_id)
    active_users = list(manager.presence.get(chapter_key, {}).values())
    return {
        "chapter_id": chapter_key,
        "active_users": active_users,
        "count": len(active_users),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/chapters/{chapter_id}/collaboration-state")
async def get_collaboration_state(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    user_uuid = uuid.UUID(user_id)
    has_access = await _has_chapter_access(db, chapter_id, user_uuid)
    if not has_access:
        return {
            "chapter_id": str(chapter_id),
            "connected_users": [],
            "last_update": datetime.now(timezone.utc).isoformat(),
        }

    chapter_key = str(chapter_id)
    state = dict(manager.collaboration_state.get(chapter_key, {}))
    state["chapter_id"] = chapter_key
    state["connected_users"] = list(manager.presence.get(chapter_key, {}).keys())
    state["last_update"] = datetime.now(timezone.utc).isoformat()
    return state
