CREATE TABLE inbox (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 update_id INTEGER NOT NULL UNIQUE,
 payload TEXT,
 received_at INTEGER NOT NULL,
 acknowledged_at INTEGER
);
CREATE INDEX inbox_pending ON inbox(seq) WHERE payload IS NOT NULL;
-- Metadados confirmados são mantidos para deduplicar novas entregas do Telegram.
-- Nunca apagar pendentes por idade ou por uma confirmação de outro registro.
