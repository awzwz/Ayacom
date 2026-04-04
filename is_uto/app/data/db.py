from typing import Optional

import psycopg2
from psycopg2 import pool
from app.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

_pool: Optional[pool.SimpleConnectionPool] = None


def get_pool() -> pool.SimpleConnectionPool:
    global _pool
    if _pool is None:
        _pool = pool.SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            sslmode="require",
        )
    return _pool


def get_conn():
    return get_pool().getconn()


def put_conn(conn):
    get_pool().putconn(conn)


class DBConn:
    """Context manager for DB connections."""

    def __enter__(self):
        self.conn = get_conn()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        put_conn(self.conn)
        return False
