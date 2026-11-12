-- Hand-written: allow the owner's "clear data for a date range" action to hard-delete.
-- Deletes stay forbidden unless the transaction explicitly sets baki.allow_delete = 'on'
-- (only the ClearDateRange use case does that). activity_log stays append-only.
CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('baki.allow_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% rows are never deleted (archive or void instead)', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;
