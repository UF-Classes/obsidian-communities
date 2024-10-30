from starlette.middleware.cors import CORSMiddleware

from api.app import app
from api.schemas import UserRead, UserCreate, UserUpdate
from api.users import fastapi_users, auth_backend, get_user_by_email

origins = [
    "*"
    # "http://localhost",
    # "http://localhost:8000",
    # "http://127.0.0.1",
    # "http://127.0.0.1:8000",
    # "http://127.0.0.1:*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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


@app.get("/")
def read_root():
    return {"Hello": "World"}


# Email
@app.get("/users/exists/{user_email}")  # Make sure no repeats
async def create_user(user_email: str):
    matching_users = await get_user_by_email(user_email)
    if matching_users is None:
        return {"exists": False}
    else:
        user = matching_users[0]
        return {
            "exists": True,
            "id": user.id,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "is_superuser": user.is_superuser,
        }

# HTTP Methods
# POST
# GET
# PUT
# DELETE

# login --> check if admin
