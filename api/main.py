import io
import uuid
import zipfile

from fastapi.openapi.models import Response
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.annotation import Annotated
from starlette.middleware.cors import CORSMiddleware

from api import users
from api.app import app
from api.db import Community, User
from api.schemas import UserRead, UserCreate, UserUpdate
from api.users import fastapi_users, auth_backend, get_user_by_email, current_active_user, zipfiles
from fastapi import File, UploadFile


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

@app.post("/communities/create/{community_name}")
async def create_community(community_name: str, user: User = Depends(current_active_user)):
    community_id = await users.create_community(community_name, user)
    return {"community_id": community_id}

@app.post("/communities/is_owner/{community_id}")
async def is_owner(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.is_community_owner(user, community_id)
    return {"is_owner": result}

@app.post("/communities/is_member/{community_id}")
async def is_member(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.is_community_member(user, community_id)
    return {"is_member": result}

@app.post("/communities/change_owner/{community_id}")
async def change_owner(community_id: uuid.UUID, new_owner_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.change_community_owner(user, community_id, new_owner_id)
    if result.get("error"):
        return result
    else:
        return {"message": f"Community owner changed to {new_owner_id}"}

@app.post("/communities/update_description/{community_id}/{description}")
async def change_description(community_id: uuid.UUID, description: str, user: User = Depends(current_active_user)):
    result = await users.update_community_description(user, community_id, description)
    if result.get("error"):
        return result
    else:
        return {"message": f"Community description changed to {description}"}

@app.post("/communities/change_name/{community_id}/{new_name}")
async def change_name(community_id: uuid.UUID, new_name: str, user: User = Depends(current_active_user)):
    result = await users.change_community_name(user, community_id, new_name)
    if result.get("error"):
        return result
    else:
        return {"message": f"Community name changed to {new_name}"}

@app.post("/communities/join/{community_id}")
async def join_community(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.add_user_to_community(user, community_id)
    if result.get("error"):
        return result

    return {"message": f"User {user.email} joined the community"}

@app.post("/communities/post/note/{community_id}/{note}")               # TODO: Redundant Method?
async def post_note(community_id: uuid.UUID, note: str, user: User = Depends(current_active_user)):
    result = await users.post_community_note(user, community_id, note)
    if result.get("error"):
        return result

    return {"message": f"Note posted to community {community_id}"}

@app.post("/community/{community_id}/{group_name}/shared-notes")
async def create_file(community_id: uuid.UUID, files: list[UploadFile], group_name: str, user: User = Depends(current_active_user)):
    await users.post_community_note(user, community_id, files, group_name)
    return {"file_size": len(await files[0].read())}

@app.get("/community/{community_id}/shared-notes")
async def get_files(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    notes = await users.get_community_notes(user, community_id)
    return await users.zipfiles(notes[1], notes[0])

@app.get("/community/{community_id}/shared-notes/{note_group_id}")
async def get_file(community_id: uuid.UUID, note_group_id: uuid.UUID):
    notes = await users.get_note_by_id(community_id, note_group_id)
    return await users.zipfiles(notes)

@app.put("/community/{community_id}/shared-notes/{file_group_id}")
async def edit_note(community_id: uuid.UUID, file_group_id: uuid.UUID, note_ids: list[uuid.UUID], files: list[UploadFile], user: User = Depends(current_active_user)):
    await users.edit_notes(note_ids, files, community_id, file_group_id, user)
    return {"message": "Note edited"}

@app.delete("/communities/note/delete/{note_id}")
async def delete_note(note_id: uuid.UUID):
    await users.delete_note(note_id)
    return {"message": "Note deleted"}


@app.get("/users/exists/{user_email}")
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