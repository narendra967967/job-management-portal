#!/bin/bash
# Runs ONCE, on Postgres's first start with an empty data volume. Creates one
# database + one owner role per environment, each able to reach only its own DB.
# Passwords come from /srv/jobtiva/.env — use letters/digits only (openssl rand -hex 24).
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
	CREATE ROLE jmp_prod LOGIN PASSWORD '${PROD_DB_PASSWORD}';
	CREATE DATABASE jmp_prod OWNER jmp_prod;
	REVOKE ALL ON DATABASE jmp_prod FROM PUBLIC;

	CREATE ROLE jmp_preprod LOGIN PASSWORD '${PREPROD_DB_PASSWORD}';
	CREATE DATABASE jmp_preprod OWNER jmp_preprod;
	REVOKE ALL ON DATABASE jmp_preprod FROM PUBLIC;
SQL
