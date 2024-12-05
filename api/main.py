import uuid
from fastapi import Depends, UploadFile, Form, Header
from starlette.middleware.cors import CORSMiddleware

from api import users
from api.app import app
from api.db import User
from api.schemas import UserRead, UserCreate, UserUpdate
from api.users import fastapi_users, auth_backend, get_user_by_email, current_active_user

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


# ---------------------------------------------------- Core Routes (Tech Spec) ----------------------------------------------------
# Post Notes to Community
@app.post("/community/{community_id}/{group_name}/shared-notes")
async def post_community_note(community_id: uuid.UUID, group_name: str, files: list[UploadFile],
                              user: User = Depends(current_active_user)):
    response = await users.post_community_note(user, community_id, files, group_name)
    return response


# Get all notes from a community
@app.get("/community/{community_id}/shared-notes")
async def get_all_community_notes(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    notes = await users.get_all_community_notes(user, community_id)
    return await users.zip_files(notes[1], notes[0])


# Get all notes from a community by group id
@app.get("/community/{community_id}/shared-notes/{note_group_id}")
async def get_notes_by_group_id(community_id: uuid.UUID, note_group_id: uuid.UUID):
    notes = await users.get_notes_by_group_id(community_id, note_group_id)
    return await users.zip_files(notes)


# Add and Delete Notes in a community
@app.put("/community/{community_id}/shared-notes/{file_group_id}")
async def add_and_delete_notes(community_id: uuid.UUID, file_group_id: uuid.UUID, note_ids: list[uuid.UUID],
                               files: list[UploadFile], user: User = Depends(current_active_user)):
    await users.add_and_delete_notes(note_ids, files, community_id, file_group_id, user)
    return {"message": "Note edited"}


# -------------------------------------------------- Core Community Routes --------------------------------------------------

# Create a community
@app.post("/communities/create/{community_name}")
async def create_community(community_name: str, user: User = Depends(current_active_user)):
    community_id = await users.create_community(community_name, user)
    return {"community_id": community_id}


# Join a community
@app.post("/communities/join/{community_id}")
async def add_user_to_community(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.add_user_to_community(user, community_id)
    if result.get("error"):
        return result

    return {"message": f"User {user.email} joined the community"}


# Leave a community
@app.delete("/communities/leave/{community_id}")
async def remove_user_from_community(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.remove_user_from_community(user.id, community_id)
    return result


# Get all communities a user is in
@app.get("/communities/user/{user_id}")
async def get_user_communities(user_id: uuid.UUID):
    communities = await users.get_user_communities(user_id)
    return communities


# Delete a note by note id
@app.delete("/communities/note/delete/{note_id}")
async def delete_note_by_id(note_id: uuid.UUID):
    await users.delete_note_by_id(note_id)
    return {"message": "Note deleted"}


# ------------------------------------------------------ Misc. User Routes ------------------------------------------------------
# Get user by email
@app.get("/users/exists/{user_email}")
async def get_user_info(user_email: str):
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


# ----------------------------------------------------- Misc. Community Management Routes ---------------------------------------------------
# Check if user is owner of community
@app.post("/communities/is_owner/{community_id}")
async def is_community_owner(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    result = await users.is_community_owner(user, community_id)
    return {"is_owner": result}


# Check if user is member of community
@app.get("/communities/is_member/{community_id}/{user_id}")
async def is_community_member(community_id: uuid.UUID, user_id: uuid.UUID):
    result = await users.is_community_member(user_id, community_id)
    return {"is_member": result}


# Change community owner
@app.post("/communities/change_owner/{community_id}")
async def update_community_owner(community_id: uuid.UUID, new_owner_id: uuid.UUID,
                                 user: User = Depends(current_active_user)):
    result = await users.update_community_owner(user, community_id, new_owner_id)
    if result.get("error"):
        return result
    else:
        return {"message": f"Community owner changed to {new_owner_id}"}


# Update community description
@app.post("/communities/update_description/{community_id}/{description}")
async def update_community_description(community_id: uuid.UUID, description: str,
                                       user: User = Depends(current_active_user)):
    result = await users.update_community_description(user, community_id, description)
    if result.get("error"):
        return result
    else:
        return {"message": f"Community description changed to {description}"}


# Update community name
@app.post("/communities/change_name/{community_id}/{new_name}")
async def update_community_name(community_id: uuid.UUID, new_name: str, user: User = Depends(current_active_user)):
    result = await users.update_community_name(user, community_id, new_name)
    if result.get("error"):
        return result
    else:
        return {"message": f"Community name changed to {new_name}"}


# Check if community exists
@app.get("/communities/exists/{community_id}")
async def is_existing_community(community_id: uuid.UUID):
    result = await users.is_existing_community(community_id)
    return {"exists": result}


# ----------------------------------------------------- Flashcard Routes ---------------------------------------------------
# *****************************************************************************************************
#    Flashcard set implemented as list of tuples (Data type abstracted due to unknown final data type)
# *****************************************************************************************************

# Upload flashcard and immediately share with community (Immediately accessbile to community members)
# Current Implementation - Key: flashcards | Value: Question, Answer (Comma delimiter)
@app.post("/flashcards/upload/community/{set_name}/{community_id}")
async def upload_flashcard_set_to_community(set_name: str, community_id: uuid.UUID, flashcards: list[str] = Form(...),
                                            user: User = Depends(current_active_user, )):
    parsed_flashcards = [tuple(f.split(",")) for f in flashcards]
    response = await users.upload_flashcard_set(set_name, parsed_flashcards, user, community_id)
    return response


# Upload flashcard and dont immediately share with community (Stays private)
@app.post("/flashcards/upload/user/{set_name}")
async def upload_flashcard_set_to_user(set_name: str, flashcards: list[str] = Form(...),
                                       user: User = Depends(current_active_user)):
    parsed_flashcards = [tuple(f.split(",")) for f in flashcards]
    response = await users.upload_flashcard_set(set_name, parsed_flashcards, user)
    return response


# Gets formatted JSON file of all FlashcardSets in a community
# formatted JSON file  = Formats each object with respect to its hierarchy
#i.e Flashcard Set --> FlashCard --> attributes
@app.get("/communities/{community_id}/flashcard-sets")
async def get_flashcard_sets_from_community(community_id: uuid.UUID, user: User = Depends(current_active_user)):
    flashcard_sets = await users.get_all_flashcard_sets_from_community(user, community_id)
    return flashcard_sets


# Sends formatted JSON file of a FlashcardSet by ID
@app.get("/flashcards/flashcard-sets/{flashcard_set_id}")
async def get_flashcard_set_from_community(flashcard_set_id: uuid.UUID):
    flashcard_set = await users.get_specified_flashcard_set(flashcard_set_id=flashcard_set_id)
    return flashcard_set


# Sends formatted JSON file of a FlashcardSet by Name
@app.get("/flashcards/flashcard-sets/name/{flashcard_set_name}")
async def get_flashcard_set_from_community_by_name(flashcard_set_name: str):
    flashcard_set = await users.get_specified_flashcard_set(flashcard_set_name=flashcard_set_name)
    return flashcard_set


# Sends formatted JSON file of all FlashcardSet by a user
@app.get("/flashcards/flashcard-sets/user/{user_id}")
async def get_flashcard_sets_by_user(user: User = Depends(current_active_user)):
    flashcard_sets = await users.get_all_flashcard_sets_from_user(user)
    return flashcard_sets


# Adds specified community to list of communities that can access a flashcard set - Dependent on privacy_state
# Chooses whether a set able to be downloaded when calling get_flashcard_sets_from_community
# TODO: Review privacy_str as a boolean
@app.post("/flashcards/flashcard-sets/change_privacy/{flashcard_set_id}/{community_id}/{privacy_str}")
async def update_flashcard_set_community_visibility(flashcard_set_id: uuid.UUID, community_id: uuid.UUID,
                                                    privacy_str: str, user: User = Depends(current_active_user)):
    privacy_bool = privacy_str == "true" or privacy_str == "True" or privacy_str == "TRUE"
    response = await users.update_flashcard_set_community_visibility(user, flashcard_set_id, community_id, privacy_bool)
    return response


# Deletes a flashcard set by ID
@app.delete("/flashcards/flashcard-sets/{flashcard_set_id}")
async def delete_flashcard_set(flashcard_set_id: uuid.UUID, user: User = Depends(current_active_user)):
    response = await users.delete_flashcard_set(user, flashcard_set_id)
    return response


@app.on_event("startup")
async def on_startup():
    await users.setup_db()
