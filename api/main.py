from api.app import app
from api.schemas import UserRead
from api.users import get_user_manager
from api.db import get_user_db, get_user_by_email


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
