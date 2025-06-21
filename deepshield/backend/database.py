"""
Database configuration and utilities
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import logging
from .config import settings
from .models import Base

logger = logging.getLogger(__name__)

# Database engine configuration
engine_kwargs = {
    "echo": settings.debug,
    "future": True,
}

# SQLite specific configuration
if settings.database_url.startswith("sqlite"):
    engine_kwargs.update({
        "connect_args": {
            "check_same_thread": False,
            "timeout": 20,
        },
        "poolclass": StaticPool,
    })

# Create engine
engine = create_engine(settings.database_url, **engine_kwargs)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)


def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


def get_db() -> Session:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


# SQLite optimization
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Set SQLite pragmas for better performance"""
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        # Enable foreign key constraints
        cursor.execute("PRAGMA foreign_keys=ON")
        # Set journal mode to WAL for better concurrency
        cursor.execute("PRAGMA journal_mode=WAL")
        # Set synchronous mode to NORMAL for better performance
        cursor.execute("PRAGMA synchronous=NORMAL")
        # Set cache size (negative value means KB)
        cursor.execute("PRAGMA cache_size=-64000")  # 64MB
        # Set temp store to memory
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()


class DatabaseManager:
    """Database management utilities"""
    
    @staticmethod
    def init_db():
        """Initialize database with tables and initial data"""
        create_tables()
        logger.info("Database initialized")
    
    @staticmethod
    def reset_db():
        """Reset database (drop and recreate all tables)"""
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.warning("Database reset completed")
    
    @staticmethod
    def get_db_info():
        """Get database information"""
        with engine.connect() as conn:
            if settings.database_url.startswith("sqlite"):
                result = conn.execute("PRAGMA database_list").fetchall()
                return {"type": "SQLite", "databases": result}
            else:
                return {"type": "Unknown", "url": settings.database_url}


# Initialize database on import
try:
    create_tables()
except Exception as e:
    logger.warning(f"Could not initialize database: {e}")