import os

from fastapi import FastAPI
from dotenv import load_dotenv


load_dotenv()
is_production = os.environ.get("NODE_ENV", "development") == "production"
app =   FastAPI()
