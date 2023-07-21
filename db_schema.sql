
-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

--create your tables with SQL commands here (watch out for slight syntactical differences with SQLite)

CREATE TABLE IF NOT EXISTS userLoginInfo (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT UNIQUE NOT NULL,
    user_password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS userRecords (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_value TEXT NOT NULL,
    user_id  INT, --the user that the record belongs to
    FOREIGN KEY (user_id) REFERENCES userLoginInfo(user_id)
);

--insert default data (if necessary here)

COMMIT;

