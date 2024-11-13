import asyncio
import contextlib
import uuid
from typing import Optional

from fastapi import Depends, Request, File, UploadFile
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users.exceptions import UserAlreadyExists
from sqlalchemy import select
from sqlalchemy.sql.annotation import Annotated

from api.app import is_production
from api.db import User, get_user_db, create_db_and_tables, async_session_maker, get_async_session, Community, \
    communities_table, Note, SharedNoteGroup
from api.schemas import UserCreate

SECRET = "SECRET"


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"User {user.id} has forgot their password. Reset token: {token}")

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)


get_async_session_context = contextlib.asynccontextmanager(get_async_session)
get_user_db_context = contextlib.asynccontextmanager(get_user_db)
get_user_manager_context = contextlib.asynccontextmanager(get_user_manager)


async def get_user_by_email(email : str):
    async with async_session_maker() as session:
        async with session.begin():
            result = await session.execute(select(User).where(User.email == email))
            return result.fetchone()


async def create_user(email: str, password: str, is_superuser: bool = False):
    try:
        async with get_async_session_context() as session:
            async with get_user_db_context(session) as user_db:
                async with get_user_manager_context(user_db) as user_manager:
                    user = await user_manager.create(
                        UserCreate(
                            email=email, password=password, is_superuser=is_superuser
                        )
                    )
                    print(f"User created {user.email}")
    except UserAlreadyExists:
        pass

async def create_community(community_name: str, user: User):
    async with get_async_session_context() as session:
        new_community = Community(name=community_name, owner=user.id)
        session.add(new_community)
        await session.commit()
        await session.refresh(new_community)
        await add_user_to_community(user, new_community.id)

    return  new_community.id

async def is_community_owner(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        if community is None:
            return False
        return community.owner == user.id

async def is_community_member(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        result = await session.execute(
            select(communities_table).where(
                communities_table.c.user_id == user.id,
                communities_table.c.community_id == community_id
            )
        )
        return result.fetchone() is not None

async def add_user_to_community(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        community_session = await session.merge(user)
        session.add(community_session)
        if community is None:
            return {"error": "Community not found"}

        community.members.append(user)
        await session.commit()
        return {"message": f"User {user.email} joined the community"}

async def remove_user_from_community(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        if community is None:
            return {"error": "Community not found"}
        community.members.remove(user)
        await session.commit()
        return {"message": f"User {user.email} removed from the community"}

async def change_community_name(user: User, community_id: uuid.UUID, new_name: str):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        if community is None:
            return {"error": "Community not found"}
        if community.owner != user.id:
            return {"error": "User is not the owner of the community"}
        community.name = new_name
        await session.commit()
        return {"message": "Community name changed"}

async def update_community_description(user: User, community_id: uuid.UUID, description: str):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        if community is None:
            return {"error": "Community not found"}
        if community.owner != user.id:
            return {"error": "User is not the owner of the community"}
        community.description = description
        await session.commit()
        return {"message": "Community description changed"}

async def change_community_owner(user: User, community_id: uuid.UUID, new_owner_id: uuid.UUID):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        if community is None:
            return {"error": "Community not found"}
        if community.owner != user.id:
            return {"error": "User is not the owner of the community"}
        if not await is_community_member(user, community_id):
            return {"error": "New owner is not a member of the community"}
        community.owner = new_owner_id
        await session.commit()
        return {"message": "Community owner changed"}

async def post_community_note(user: User, community_id: uuid.UUID, note: list[UploadFile]):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)

        if community is None:
            return {"error": "Community not found"}
        if not await is_community_member(user, community_id):
            return {"error": "User is not a member of the community"}

        shared_note = SharedNoteGroup(community_id=community_id)
        session.add(shared_note)

        for file in note:
            content = await file.read()
            note = Note(user_id=user.id, shared_id=shared_note.id, content=content)
            session.add(note)

        await session.commit()
        return {"message": "Note posted"}


async def get_community_notes(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)

        if community is None:
            return {"error": "Community not found"}
        if not await is_community_member(user, community_id):
            return {"error": "User is not a member of the community"}

        result = await session.execute(
            select(Note).where(Note.shared_id == SharedNoteGroup.id)
        )
        return result.fetchall()

async def setup_db():
    await create_db_and_tables()
    if is_production:
        return
    # Create admin user
    await create_user("admin@example.com", "admin", is_superuser=True)
    # Create normal user
    await create_user("user@example.com", "password", is_superuser=False)



asyncio.create_task(setup_db())
