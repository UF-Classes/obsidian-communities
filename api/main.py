from fastapi import FastAPI
from api.auth import app as auth_app
from fastapi_users import models
from fastapi import FastAPI, Depends
from api.auth import app as auth_app, user_db
app = FastAPI()
app.mount("/", auth_app) # Allows all routes in auth_app to be accessed from the root of the app


@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/add_user")
async def add_user(user: models.BaseUserCreate, user_db=Depends(user_db)):
    await user_db.create(user)
    return {"message": "User created successfully"}

@app.get("/user_exists/{username}")
async def user_exists(username: str, user_db=Depends(user_db)) -> bool:
    user = await user_db.get_by_username(username)
    return user is not None
