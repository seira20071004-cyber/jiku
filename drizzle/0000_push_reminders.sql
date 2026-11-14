CREATE TABLE jiku_push (
 endpoint TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 subscription TEXT NOT NULL,
 delivery_day TEXT
);
