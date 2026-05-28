ALTER TABLE upstream_configs
    ADD COLUMN per_user_worker_concurrency SMALLINT NOT NULL DEFAULT 1
        CHECK (per_user_worker_concurrency BETWEEN 1 AND 16),
    ADD COLUMN per_user_queue_limit SMALLINT NOT NULL DEFAULT 5
        CHECK (per_user_queue_limit BETWEEN 1 AND 16);
