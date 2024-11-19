import os
import uuid
from typing import AsyncGenerator, List

from fastapi import Depends, File
from fastapi_users.db import SQLAlchemyBaseUserTableUUID, SQLAlchemyUserDatabase
from sqlalchemy import Column, String, UUID, ARRAY, Integer, Table, ForeignKey, LargeBinary, VARBINARY
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import DeclarativeMeta, declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Mapped
from sqlalchemy.sql.annotation import Annotated

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
Base: DeclarativeMeta = declarative_base()

engine = create_async_engine(DATABASE_URL)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
session = None

communities_table = Table(
   "user_communities",
   Base.metadata,
   Column("user_id", UUID, ForeignKey("user.id"), primary_key=True),
   Column("community_id", UUID, ForeignKey("communities.id"), primary_key=True),
)



class User(SQLAlchemyBaseUserTableUUID, Base):
    communities = relationship("Community", secondary="user_communities", back_populates="members")

class Community(Base):
    __tablename__ = "communities"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    members: Mapped[List["User"]] = relationship("User", secondary=communities_table, back_populates="communities", lazy="selectin")
    owner = Column(UUID, ForeignKey("user.id"))
    description = Column(String, nullable=True)

class SharedNoteGroup(Base):
    __tablename__ = "shared_note_groups"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    community_id = Column(UUID, ForeignKey("communities.id"))
    name = Column(String, nullable=True)

class Note(Base):
    __tablename__ = "notes"
    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    shared_id = Column(UUID, ForeignKey("shared_note_groups.id"))
    user_id = Column(UUID, ForeignKey("user.id"))
    content = Column(VARBINARY, nullable=False)
    file_name = Column(String, nullable=False)



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


