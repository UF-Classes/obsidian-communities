from fastapi import FastAPI
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from api.UserModel import User, engine

DATABASE_URL = "sqlite+aiosqlite:///./test.db"  # TO DO: Implement DB
async_engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
user_db = SQLAlchemyUserDatabase(User, async_session_maker)

SECRET = "SECRET"

auth_backends = [   # Handles authentication for fastAPI-users
    JWTStrategy(secret=SECRET, lifetime_seconds=3600),
]

fastapi_users = FastAPIUsers(   # Initializes fastAPI-users using the db, authenitcation and usermodel
    user_db,
    auth_backends,
    User,
)

app = FastAPI()

app.include_router(
    fastapi_users.get_auth_router(auth_backends[0]),
    prefix="/auth/jwt",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_register_router(),
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_users_router(),
    prefix="/users",
    tags=["users"],
)