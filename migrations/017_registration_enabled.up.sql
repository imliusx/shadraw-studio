ALTER TABLE upstream_configs
    ADD COLUMN registration_enabled BOOLEAN NOT NULL DEFAULT TRUE;
