from fastapi import FastAPI
import sqlalchemy as sa
from sqlalchemy.testing.suite.test_reflection import metadata
from websockets.asyncio.client import connect

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}

# Server Stuff that I'm not 100% sure belongs
# 2 Versions of SQL Alchemy Installed !!!

account_db = sa.create_engine("Accounts")
account_db_con = account_db.connect()
account_meta = account_db_con.MetaData()
user_table = sa.table(
    "users",
    account_meta,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("name", sa.String),
    sa.Column("key", sa.String),
)

def insert_user(username, email, password):
    query = user_table.insert().values(name=username, email=email, password=password)
    account_db_con.execute(query)

def select_user(username):
    query = user_table.select().where(user_table.c.name == username)
    result = account_db_con.execute(query).fetchone()
    return result

def account_db_main_debug():
    metadata.create_all(account_db_con)
    insert_user("admin", "<EMAIL>", "password")
    print(select_user("admin"))
    account_db_con.close()

def account_authentication(name, password) -> bool:
    query = user_table.select().where(user_table.c.name == name)
    result = account_db_con.execute(query).fetchone()
    if result and result['key'] == password:
        return True
    return False

