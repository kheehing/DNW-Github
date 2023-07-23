
-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

--create your tables with SQL commands here (watch out for slight syntactical differences with SQLite)

CREATE TABLE IF NOT EXISTS userLoginInfo (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT UNIQUE NOT NULL,
    user_password TEXT NOT NULL,
    user_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    publicationDate TIMESTAMP NOT NULL,
    isPublished BOOLEAN NOT NULL,
    lastModified TIMESTAMP NOT NULL,
    likes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comments TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    lastModified TEXT NOT NULL,
    ArticleId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    FOREIGN KEY (ArticleId) REFERENCES Articles(id),
    FOREIGN KEY (UserId) REFERENCES userLoginInfo(user_id)
);

CREATE TABLE IF NOT EXISTS Blog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Subtitle TEXT NOT NULL,
    author TEXT NOT NULL
);


--insert default data (if necessary here)

COMMIT;

