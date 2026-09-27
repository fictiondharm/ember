"""
FleetGrid Backend — PostgreSQL Setup & Database Management Script
Usage:
  python setup_db.py --check         Check database connectivity
  python setup_db.py --create        Create local PostgreSQL database
  python setup_db.py --migrate       Run Alembic migrations (create/update tables)
  python setup_db.py --seed          Seed deterministic demo data
  python setup_db.py --reset         Full reset: drop tables, migrate, seed
  python setup_db.py --all           Full setup: check + migrate + seed
"""
import os
import sys
import subprocess
import argparse

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite:///./fleetgrid.db")
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


from app.config import settings
from app.database import engine, SessionLocal, test_connection, Base


# Resolve alembic from the same Python environment that is running this script.
# This works on Linux (Render), macOS, and Windows without hardcoding paths.
import shutil

ALEMBIC = shutil.which("alembic")
if not ALEMBIC:
    # Fall back to python -m alembic if the script is not on PATH
    ALEMBIC_CMD = [sys.executable, "-m", "alembic"]
else:
    ALEMBIC_CMD = [ALEMBIC]


def check_db():
    print(f"\n🔍 Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print(f"   Type: {'PostgreSQL' if settings.is_postgres else 'SQLite'}")
    ok = test_connection()
    if ok:
        print("   ✅ Connection: OK")
    else:
        print("   ❌ Connection: FAILED")
        if settings.is_postgres:
            print("\n   ⚠️  Could not connect to PostgreSQL.")
            print("   Options:")
            print("   1. Check DATABASE_URL in your .env file")
            print("   2. Verify Render PostgreSQL is running (or use local SQLite)")
            print("   3. Use local SQLite: set DATABASE_URL=sqlite:///./fleetgrid.db")
    return ok


def create_local_db():
    """Create fleetgrid database in local PostgreSQL."""
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

    # Parse connection params from DATABASE_URL
    url = settings.DATABASE_URL
    if not url.startswith("postgresql://"):
        print("⚠️  Skipping DB creation — not PostgreSQL.")
        return False

    print("\n📦 Creating local PostgreSQL database...")
    # Connect to 'postgres' default DB first
    local_url = url.rsplit("/", 1)[0] + "/postgres"
    try:
        conn = psycopg2.connect(local_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        db_name = url.rsplit("/", 1)[-1].split("?")[0]
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
        if cursor.fetchone():
            print(f"   ✅ Database '{db_name}' already exists")
        else:
            cursor.execute(f"CREATE DATABASE {db_name}")
            print(f"   ✅ Created database '{db_name}'")
        conn.close()
        return True
    except Exception as e:
        print(f"   ❌ Failed to create database: {e}")
        return False


def run_migrations():
    print("\n🚀 Running Alembic migrations...")
    result = subprocess.run(ALEMBIC_CMD + ["upgrade", "head"], cwd=os.path.dirname(__file__))
    if result.returncode == 0:
        print("   ✅ Migrations applied successfully")
        return True
    else:
        print("   ❌ Migration failed — check DATABASE_URL and database connectivity")
        return False


def generate_migration(message="auto"):
    print(f"\n🔧 Generating migration: '{message}'...")
    result = subprocess.run(ALEMBIC_CMD + ["revision", "--autogenerate", "-m", message], cwd=os.path.dirname(__file__))
    if result.returncode == 0:
        print("   ✅ Migration file generated — review it in migrations/versions/")
    return result.returncode == 0


def seed_data():
    print("\n🌱 Seeding deterministic demo data...")
    from app.services.seed_service import seed_demo_database
    db = SessionLocal()
    try:
        result = seed_demo_database(db)
        print(f"   ✅ {result['message']}")
        print(f"   Trucks: {', '.join(result['trucks'])}")
        print(f"   Users: {', '.join(result['users'])}")
        return True
    except Exception as e:
        print(f"   ❌ Seed failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def reset_all():
    print("\n🔄 Full reset: dropping all tables and re-seeding...")
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF")) if settings.is_sqlite else None
        for table in reversed(Base.metadata.sorted_tables):
            print(f"   Dropping: {table.name}")
            table.drop(bind=engine, checkfirst=True)
        conn.commit()
    print("   ✅ Tables dropped")
    run_migrations()
    seed_data()


def main():
    parser = argparse.ArgumentParser(description="FleetGrid DB Setup")
    parser.add_argument("--check", action="store_true", help="Test DB connectivity")
    parser.add_argument("--create", action="store_true", help="Create local Postgres DB")
    parser.add_argument("--migrate", action="store_true", help="Run Alembic migrations")
    parser.add_argument("--seed", action="store_true", help="Seed demo data")
    parser.add_argument("--reset", action="store_true", help="Drop all + migrate + seed")
    parser.add_argument("--all", action="store_true", help="check + migrate + seed")
    parser.add_argument("--gen-migration", type=str, metavar="MSG", help="Generate migration")
    args = parser.parse_args()

    if not any(vars(args).values()):
        parser.print_help()
        return

    if args.check or args.all:
        check_db()
    if args.create:
        create_local_db()
    if args.gen_migration:
        generate_migration(args.gen_migration)
    if args.migrate or args.all:
        run_migrations()
    if args.seed or args.all:
        seed_data()
    if args.reset:
        reset_all()

    print("\n✅ Done!\n")


if __name__ == "__main__":
    main()
