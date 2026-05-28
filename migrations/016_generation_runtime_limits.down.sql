ALTER TABLE upstream_configs
    DROP COLUMN per_user_queue_limit,
    DROP COLUMN per_user_worker_concurrency;
