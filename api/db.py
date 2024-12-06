import os
import uuid
from typing import AsyncGenerator, List

from fastapi import Depends, File
from fastapi_users.db import SQLAlchemyBaseUserTableUUID, SQLAlchemyUserDatabase
from sqlalchemy import Column, String, UUID, ARRAY, Integer, Table, ForeignKey, LargeBinary, VARBINARY, Boolean
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import DeclarativeMeta, declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Mapped
from sqlalchemy.sql.annotation import Annotated

from api import users

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
Base: DeclarativeMeta = declarative_base()

engine = create_async_engine(DATABASE_URL)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
session = None

# User - Community Relationship Table
class UserCommunityTable(Base):
    __tablename__ = "user_communities_table"
    user_id = Column(UUID, ForeignKey("user.id"), primary_key=True)
    community_id = Column(UUID, ForeignKey("communities.id"), primary_key=True)

# User - FlashCardSet Relationship Table
class FlashCardSetUserTable(Base):
    __tablename__ = "flashcard_sets_user_table"
    user_id = Column(UUID, ForeignKey("user.id"), primary_key=True)
    flashcard_set_id = Column(UUID, ForeignKey("flashcard_sets.id"), primary_key=True)

# FlashCardSet - Community Relationship Table
class FlashCardSetCommunityTable(Base):
    __tablename__ = "flashcard_set_community_table"
    community_id = Column(UUID, ForeignKey("communities.id"), primary_key=True)
    flashcard_set_id = Column(UUID, ForeignKey("flashcard_sets.id"), primary_key=True)


class SharedNoteGroupTable(Base):
    __tablename__ = "shared_note_groups"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    community_id = Column(UUID, ForeignKey("communities.id"))
    name = Column(String, nullable=True)

class User(SQLAlchemyBaseUserTableUUID, Base):
    communities = relationship("Community", secondary="user_communities_table", back_populates="members")
    flash_card_sets = relationship("FlashCardSet", secondary="flashcard_sets_user_table", back_populates="user")

class Community(Base):
    __tablename__ = "communities"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    members: Mapped[List["User"]] = relationship("User", secondary="user_communities_table", back_populates="communities", lazy="selectin")
    owner = Column(UUID, ForeignKey("user.id"))
    description = Column(String, nullable=True)
    flashcard_sets: Mapped[List["FlashCardSet"]] = relationship(
        "FlashCardSet",
        secondary="flashcard_set_community_table",
        back_populates="communities",
        lazy="selectin"
    )

class Note(Base):
    __tablename__ = "notes"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    shared_id = Column(UUID, ForeignKey("shared_note_groups.id"))
    user_id = Column(UUID, ForeignKey("user.id"))
    content = Column(VARBINARY, nullable=False)
    file_name = Column(String, nullable=False)

class FlashCard(Base):
    __tablename__ = "flashcards"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("user.id"))
    question = Column(String, nullable=False)
    answer = Column(String, nullable=False)
    flashcard_set_id = Column(UUID, ForeignKey("flashcard_sets.id"))
    def _asdict(self):  # Required to json formatting
        return {
            "id": str(self.id),
            "question": self.question,
            "answer": self.answer,
        }

class FlashCardSet(Base):
    __tablename__ = "flashcard_sets"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("user.id"))
    name = Column(String, nullable=False)
    communities: Mapped[List["Community"]] = relationship(
        "Community",
        secondary="flashcard_set_community_table",
        back_populates="flashcard_sets",
        lazy="selectin"
    )
    user = relationship("User", secondary="flashcard_sets_user_table", back_populates="flash_card_sets", lazy="selectin")
    def _asdict(self):  # Required to json formatting
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name
        }


async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    global session
    if session:
        yield session
        return
    async with async_session_maker() as new_session:
        session = new_session
        yield session

async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase (session, User)


