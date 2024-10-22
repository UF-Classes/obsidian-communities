from sqlalchemy import Boolean, Column, Integer, String, MetaData, Table, ForeignKey
from sqlalchemy.ext.declarative import DeclarativeMeta, declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import create_engine
from fastapi_users.db import SQLAlchemyBaseUserTable

DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL)
metadata = MetaData()
Base: DeclarativeMeta = declarative_base(metadata=metadata)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
user_community_association = Table(
    "user_community",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("user.id")),
    Column("community_id", Integer, ForeignKey("community.id")),
)
communities = relationship("Community", secondary=user_community_association, back_populates="users")

class User(SQLAlchemyBaseUserTable[int], Base):
    username = Column(String, unique=True, index=True, nullable=False)
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

class Community(SQLAlchemyBaseUserTable[int], Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=False)
    members = relationship("User", secondary=user_community_association, back_populates="communities")
