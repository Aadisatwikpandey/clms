-- PostgreSQL tuning for CLMS workload
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '200';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET max_connections = '200';
SELECT pg_reload_conf();
