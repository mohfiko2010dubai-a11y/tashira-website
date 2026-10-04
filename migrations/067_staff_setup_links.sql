CREATE TABLE staff_setup_links (
 token_hash CHAR(64) NOT NULL PRIMARY KEY,
 staff_id BIGINT UNSIGNED NOT NULL,
 expires_at TIMESTAMP NOT NULL,
 consumed_at TIMESTAMP NULL,
 provider_reference VARCHAR(100) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT staff_setup_account_fk FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE RESTRICT,
 INDEX staff_setup_account_idx(staff_id)
);

-- Default closed. A guarded staging operation may temporarily preserve legacy login.
CREATE TABLE staff_auth_transition (
 singleton TINYINT NOT NULL PRIMARY KEY,
 owner_staff_id BIGINT UNSIGNED NOT NULL,
 legacy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 named_admin_verified_at TIMESTAMP NULL,
 legacy_disabled_at TIMESTAMP NULL,
 CONSTRAINT staff_transition_owner_fk FOREIGN KEY(owner_staff_id) REFERENCES staff_users(id) ON DELETE RESTRICT,
 CONSTRAINT staff_transition_singleton CHECK(singleton=1)
);
