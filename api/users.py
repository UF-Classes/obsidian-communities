import asyncio
import contextlib
import io
import uuid
import zipfile
from typing import Optional

from fastapi import Depends, Request, UploadFile, Response
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users.exceptions import UserAlreadyExists
from sqlalchemy import select, delete, and_

from api.app import is_production
from api.schemas import UserCreate
from api.db import (
    User, get_user_db, create_db_and_tables, async_session_maker, get_async_session,
    Community, UserCommunityTable, Note, SharedNoteGroupTable, FlashCard, FlashCardSet, FlashCardSetCommunityTable,
    FlashCardSetUserTable
)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


SECRET = "SECRET"
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")
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


# ------------------------------------------------------ User Management ------------------------------------------------------

async def get_user_by_email(email: str):
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


# ------------------------------------------------------ Core Community Management ------------------------------------------------------
async def create_community(community_name: str, user: User):
    async with get_async_session_context() as session:
        new_community = Community(name=community_name, owner=user.id)
        session.add(new_community)
        await session.commit()
        await session.refresh(new_community)
        await add_user_to_community(user, new_community.id)

    return {"Community Created": new_community.id}


async def add_user_to_community(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}

        if not await is_community_member(user.id, community_id):
            return {"error": "User is already a member"}

        community = await session.get(Community, community_id)
        user_community = UserCommunityTable(user_id=user.id, community_id=community_id)
        session.add(user_community)
        await session.commit()

        return {"message": f"User {user.email} joined the community"}


async def remove_user_from_community(user_id: uuid.UUID, community_id: uuid.UUID):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_member(user_id, community_id):
            return {"error": "User is not a member of the community"}

        stmt = delete(UserCommunityTable).where(and_(
            UserCommunityTable.user_id == user_id,
            UserCommunityTable.community_id == community_id
        )
        )
        await session.execute(stmt)
        await session.commit()
        return {"message": "User removed from community"}


# ------------------------------------------------------ Community Misc. Options ------------------------------------------------------
async def update_community_name(user: User, community_id: uuid.UUID, new_name: str):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_owner(user, community_id):
            return {"error": "User is not the owner of the community"}

        community = await session.get(Community, community_id)
        community.name = new_name
        await session.commit()
        return {"message": "Community name changed"}


async def update_community_description(user: User, community_id: uuid.UUID, description: str):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_owner(user, community_id):
            return {"error": "User is not the owner of the community"}

        community = await session.get(Community, community_id)
        community.description = description
        await session.commit()
        return {"message": "Community description changed"}


async def update_community_owner(user: User, community_id: uuid.UUID, new_owner_id: uuid.UUID):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_owner(user, community_id):
            return {"error": "User is not the owner of the community"}

        new_owner_user = get_user_by_id(new_owner_id)
        if not await is_community_member(new_owner_user, community_id):
            return {"error": "New owner is not a member of the community"}

        community = await session.get(Community, community_id)
        community.owner = new_owner_id
        await session.commit()
        return {"message": "Community owner changed"}


# ------------------------------------------------------ Notes Functions ------------------------------------------------------

async def post_community_note(user: User, community_id: uuid.UUID, note: list[UploadFile], group_name: str):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_member(user.id, community_id):
            return {"error": "User is not a member of the community"}

        community = await session.get(Community, community_id)
        shared_note = SharedNoteGroupTable(community_id=community_id, name=group_name)
        session.add(shared_note)
        await session.commit()

        for file in note:
            content = await file.read()
            note = Note(user_id=user.id, shared_id=shared_note.id, content=content, file_name=file.filename)
            session.add(note)

        await session.commit()
        return {"message": "Note posted"}


async def get_all_community_notes(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_member(user.id, community_id):
            return {"error": "User is not a member of the community"}

        group_notes = await session.execute(
            select(SharedNoteGroupTable).filter_by(community_id=community_id)
        )
        group_notes = group_notes.fetchall()
        notes = []

        for group in group_notes:
            group_notes_result = await session.execute(
                select(Note).filter_by(shared_id=group.SharedNoteGroup.id)
            )
            notes += [note._asdict() for note in group_notes_result.fetchall()]

        note_tuple = (group.SharedNoteGroup.name, notes)
        return note_tuple


async def get_notes_by_group_id(community_id: uuid.UUID, note_group_id: uuid.UUID):
    async with get_async_session_context() as session:
        group_notes = await session.execute(
            select(SharedNoteGroupTable).filter_by(community_id=community_id, id=note_group_id)
        )
        group_notes = group_notes.fetchall()
        notes = []

        for group in group_notes:
            notes_result = await session.execute(
                select(Note).filter_by(shared_id=note_group_id)
            )
            notes += [note._asdict() for note in notes_result.fetchall()]

        return notes


async def delete_note_by_id(note_id: uuid.UUID):  #TODO: Check if no notes are left in group, if so then delete group
    async with get_async_session_context() as session:

        if not await existing_note(note_id):
            return {"error": "Note not found"}

        note_group = await get_note_group_by_note_id(note_id)
        if note_group is None:
            return {"error": "Note group not found"}

        note = await session.get(Note, note_id)
        await session.delete(note)
        await session.commit()

        # CHecking if note group is empty for deletion
        remaining_notes = await session.execute(
            select(Note).filter_by(shared_id=note_group.id)
        )
        if not remaining_notes.fetchall():
            await session.delete(note_group)
            await session.commit()

        return {"message": "Note deleted"}


#TODO: Review file_group_id usage
async def add_and_delete_notes(note_ids_to_delete: list[uuid.UUID], files_to_add: list[UploadFile],
                               community_id: uuid.UUID, file_group_id: uuid.UUID, user: User):
    async with get_async_session_context() as session:

        if not await is_existing_community(community_id):
            return {"message": "Community Not Found"}

        group_notes_result = await session.execute(
            select(SharedNoteGroupTable).filter_by(community_id=community_id, id=file_group_id)
        )
        group_notes = group_notes_result.scalars().first()

        for note_id in note_ids_to_delete:
            await delete_note_by_id(note_id)

        for file in files_to_add:
            await post_community_note(user, community_id, [file], group_notes.name)

        await session.commit()
        return {"message": "Notes updated"}


# ------------------------------------------------------ Utils ------------------------------------------------------
async def get_user_by_id(user_id: uuid.UUID):
    async with get_async_session_context() as session:
        user = await session.get(User, user_id)
        return user


async def get_note_group_by_note_id(note_id: uuid.UUID):
    async with get_async_session_context() as session:
        note = await session.get(Note, note_id)
        note_group = await session.get(SharedNoteGroupTable, note.shared_id)
        return note_group


async def is_existing_community(community_id: uuid.UUID) -> bool:
    async with get_async_session_context() as session:
        community = await session.get(Community, community_id)
        return community is not None


async def existing_note(note_id: uuid.UUID):
    async with get_async_session_context() as session:
        note = await session.get(Note, note_id)
        return note is not None


async def is_community_owner(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        if not await is_existing_community(community_id):
            return False
        community = await session.get(Community, community_id)
        return community.owner == user.id


async def is_community_member(user_id: uuid.UUID, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        if not await is_existing_community(community_id):
            return {"error": "Community not found"}

        result = await session.execute(
            select(UserCommunityTable).where(
                and_(
                    UserCommunityTable.user_id == user_id,
                    UserCommunityTable.community_id == community_id
                )
            )
        )
        return {"is_member": result.fetchone() is not None}


async def get_community_members(community_id: uuid.UUID):
    async with get_async_session_context() as session:
        if not await is_existing_community(community_id):
            return {"error": "Community not found"}

        members = await session.execute(
            select(UserCommunityTable).filter_by(community_id=community_id)
        )
        return [member.user_id for member in members]


async def get_user_communities(user_id: uuid.UUID):
    async with get_async_session_context() as session:
        user_communities = await session.execute(
            select(Community.id, Community.name).join(UserCommunityTable).filter_by(user_id=user_id)
        )
        return [{
            "id": community.id,
            "name": community.name
        } for community in user_communities]


async def is_flashcard_set_owner(user: User, flashcard_set_id: uuid.UUID):
    async with get_async_session_context() as session:
        flashcard_set = await session.get(FlashCardSet, flashcard_set_id)
        return flashcard_set.user_id == user.id


# ------------------------------------------------------ Flashcards ------------------------------------------------------

# Given list of tuple (Generalized form of flashcard - Unknown Datatype as of yet)
# Create the flashcards and flashcard set tied to user
# If community_id is provided, share the flashcard set with the community
async def upload_flashcard_set(set_name: str, flashcards: list[tuple], user: User, community_id: uuid.UUID = None):
    async with get_async_session_context() as session:
        flashcard_set = FlashCardSet(user_id=user.id, name=set_name)
        session.add(flashcard_set)
        await session.commit()
        await session.refresh(flashcard_set)

        for question, answer in flashcards:
            flashcard = FlashCard(user_id=user.id, question=question, answer=answer, flashcard_set_id=flashcard_set.id)
            session.add(flashcard)

        flashcard_user_table = FlashCardSetUserTable(user_id=user.id, flashcard_set_id=flashcard_set.id)
        session.add(flashcard_user_table)

        await session.commit()

        if community_id:
            if not await is_existing_community(community_id):
                return {"error": "Community not found"}
            if not await is_community_member(user.id, community_id):
                return {"error": "User is not a member of the community"}

            flashcard_set_table = FlashCardSetCommunityTable(community_id=community_id,
                                                             flashcard_set_id=flashcard_set.id)
            session.add(flashcard_set_table)
            await session.commit()
            return {"message": "Flashcard set uploaded to community"}

        return {"message": "Flashcard set uploaded to private"}


# Updates community accessibility permission to view a flashcard set depending on bool visibility
async def update_flashcard_set_community_visibility(user: User, flashcard_set_id: uuid.UUID, community_id: uuid.UUID,
                                                    visibility: bool):
    async with get_async_session_context() as session:
        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_member(user.id, community_id):
            return {"error": "User is not a member of the community"}
        if not await is_flashcard_set_owner(user, flashcard_set_id):
            return {"error": "User is not the owner of the flashcard set"}

        flashcard_set_user_table = await session.get(FlashCardSetUserTable, (user.id, flashcard_set_id))
        if not flashcard_set_user_table:
            return {"error": "Flashcard set not found"}

        if visibility:
            flashcard_set_community_table = FlashCardSetCommunityTable(community_id=community_id,
                                                                       flashcard_set_id=flashcard_set_id)
            session.add(flashcard_set_community_table)

        else:
            stmt = delete(FlashCardSetCommunityTable).where(
                and_(
                    FlashCardSetCommunityTable.community_id == community_id,
                    FlashCardSetCommunityTable.flashcard_set_id == flashcard_set_id
                )
            )
            await session.execute(stmt)

        await session.commit()
        return {"message": "Flashcard set visibility updated"}


# Deletes flashcard set and all associated flashcards - Uses String or UUID
async def delete_flashcard_set(user: User, flashcard_set_id: uuid.UUID = None, flashcard_set_name: str = None):
    async with get_async_session_context() as session:
        if not flashcard_set_id and not flashcard_set_name:
            return {"error": "Flashcard Set name or ID must be provided"}

        if flashcard_set_name:
            flashcard_set = await session.execute(
                select(FlashCardSet).filter_by(name=flashcard_set_name)
            )
            flashcard_set = flashcard_set.scalar_one_or_none()
            if not flashcard_set:
                return {"error": "Flashcard set not found"}
            flashcard_set_id = flashcard_set.id

        if not await is_flashcard_set_owner(user, flashcard_set_id):
            return {"error": "User is not the owner of the flashcard set"}

        flashcards = await session.execute(
            select(FlashCard).filter_by(flashcard_set_id=flashcard_set_id)
        )
        for flashcard in flashcards.scalars():
            await session.delete(flashcard)

        flashcard_set = await session.get(FlashCardSet, flashcard_set_id)
        await session.delete(flashcard_set)
        await session.commit()
        return {"message": "Flashcard set deleted"}


# ------------------------------------------------------ Flashcard Getters ------------------------------------------------------
async def get_all_flashcard_sets_from_user(user: User):
    async with get_async_session_context() as session:
        flashcard_sets = await session.execute(
            select(FlashCardSet).filter_by(user_id=user.id)
        )
        return [await get_flashcard_set_with_flashcards(flashcard_set.id) for flashcard_set in flashcard_sets.scalars()]


async def get_all_flashcard_sets_from_community(user: User, community_id: uuid.UUID):
    async with get_async_session_context() as session:
        if not await is_existing_community(community_id):
            return {"error": "Community not found"}
        if not await is_community_member(user.id, community_id):
            return {"error": "User is not a member of the community"}

        flashcard_sets = await session.execute(
            select(FlashCardSetCommunityTable).filter_by(community_id=community_id)
        )
        return [await get_flashcard_set_with_flashcards(flashcard_set.flashcard_set_id) for flashcard_set in
                flashcard_sets.scalars()]


async def get_all_flashcards_from_set_id(flashcard_set_id: uuid.UUID):
    async with get_async_session_context() as session:
        flashcards = await session.execute(
            select(FlashCard).filter_by(flashcard_set_id=flashcard_set_id)
        )
        return [flashcard._asdict() for flashcard in flashcards.scalars()]


async def get_specified_flashcard_set(flashcard_set_id: uuid.UUID = None, flashcard_set_name: str = None):
    async with get_async_session_context() as session:
        if not flashcard_set_id and not flashcard_set_name:
            return {"error": "Flashcard Set name or ID must be provided"}

        if flashcard_set_name:
            flashcard_set = await session.execute(
                select(FlashCardSet).filter_by(name=flashcard_set_name)
            )
            flashcard_set = flashcard_set.scalar_one_or_none()
            if not flashcard_set:
                return {"error": "Flashcard set not found"}
            flashcard_set_id = flashcard_set.id

        flashcard_set = await session.get(FlashCardSet, flashcard_set_id)
        return await get_flashcard_set_with_flashcards(flashcard_set.id)


async def get_flashcard_set_with_flashcards(flashcard_set_id: uuid.UUID):
    async with get_async_session_context() as session:
        flashcard_set = await session.get(FlashCardSet, flashcard_set_id)
        flashcards = await get_all_flashcards_from_set_id(flashcard_set_id)
        return {
            "FlashCardSet": flashcard_set._asdict(),
            "FlashCards": flashcards
        }


# ------------------------------------------------------ IO ------------------------------------------------------

async def zip_files(notes, zip_filename: str):
    zip_filename = zip_filename + ".zip"

    s = io.BytesIO()
    zf = zipfile.ZipFile(s, "w")

    for note in notes:
        note_obj = note['Note']
        file_name = note_obj.file_name
        content = note_obj.content
        zf.writestr(file_name, content)

    zf.close()

    resp = Response(s.getvalue(), media_type="application/x-zip-compressed", headers={
        'Content-Disposition': f'attachment;filename={zip_filename}'
    })

    return resp


# ------------------------------------------------------ Setup ------------------------------------------------------

async def setup_db():
    await create_db_and_tables()
    if is_production:
        return

    await create_user("admin@example.com", "admin", is_superuser=True)
    await create_user("user@example.com", "password", is_superuser=False)
    await create_community("Test Community", (await get_user_by_email("user@example.com"))[0])
