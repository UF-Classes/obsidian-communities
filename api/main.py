from api.app import app
from api.schemas import UserRead
from api.users import get_user_manager
from api.db import get_user_db, get_user_by_email

@app.get("/")
def read_root():
    return {"Hello": "World"}



# Email
@app.get("/users/exists/{user_email}") # Make sure no repeats
async def create_user(user_email : str):
    exists = await get_user_by_email(user_email)
    if exists is None:
        return {"exists": False}
    else:
        return {"exists": True}



# HTTP Methods
# POST
# GET
# PUT
# DELETE

#login --> check if admin