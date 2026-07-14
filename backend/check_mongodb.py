import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


load_dotenv()

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://127.0.0.1:27017",
)

MONGODB_DATABASE = os.getenv(
    "MONGODB_DATABASE",
    "stress_research_platform",
)


def get_target_name(uri: str) -> str:
    if uri.startswith("mongodb+srv://"):
        return "MongoDB Atlas"

    if "127.0.0.1" in uri or "localhost" in uri:
        return "Local MongoDB"

    return "External MongoDB"


def main() -> None:
    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=10_000,
        connectTimeoutMS=10_000,
    )

    target = get_target_name(MONGODB_URI)

    try:
        ping_result = client.admin.command("ping")

        database = client[MONGODB_DATABASE]

        print("")
        print("MongoDB connection successful")
        print("--------------------------------")
        print(f"Target:   {target}")
        print(f"Database: {MONGODB_DATABASE}")
        print(f"Ping:     {ping_result}")
        print("--------------------------------")

        collections = database.list_collection_names()

        print("Available collections:")

        if not collections:
            print("- No collections found")
        else:
            for collection_name in sorted(collections):
                count = database[collection_name].count_documents({})
                print(f"- {collection_name}: {count} documents")

    except PyMongoError as error:
        print("")
        print("MongoDB connection failed")
        print("--------------------------------")
        print(f"Target:   {target}")
        print(f"Database: {MONGODB_DATABASE}")
        print(f"Error:    {error}")
        raise SystemExit(1)

    finally:
        client.close()


if __name__ == "__main__":
    main()
