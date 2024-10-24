from fastapi import FastAPI, HTTPException
from fastapi_users import models
from fastapi import FastAPI, Depends
from starlette import status

from api.schemas import UserRead, UserCreate, UserUpdate
from users import auth_backend, current_active_user, fastapi_users, UserManager, get_user_manager
from db import create_db_and_tables

app = FastAPI()

# TO DO: Are these routers necessary?
app.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# HTTP Methods
# POST
# GET
# PUT
# DELETE

#login --> check if admin
@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/users", response_model=UserRead) # Make sure no repeats
async def create_user(user: UserCreate, user_manager: UserManager = Depends(get_user_manager)):
    try:
        created_user = await user_manager.create(user)
        return created_user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Review if necessary
@app.on_event("startup")
async def startup():
    print("Server starting up")
    await create_db_and_tables()