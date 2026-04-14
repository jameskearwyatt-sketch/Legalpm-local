-- Transactional inserts for analyst analyses + their extracted positions.
--
-- Problem: today the upload flow runs two separate mutations:
--   1) INSERT INTO <analyst>_analyses ...       (create the analysis)
--   2) INSERT INTO <analyst>_extracted_positions ... (save positions)
-- If the client disconnects (network drop, tab close) between the two,
-- we end up with an orphan analysis row and no positions. These RPCs
-- wrap both inserts in a single PL/pgSQL block, so Postgres enforces
-- all-or-nothing atomicity: if positions insertion fails, the analysis
-- row is rolled back automatically.
--
-- Design notes:
-- * SECURITY INVOKER so RLS still applies exactly as if the client had
--   done the inserts itself.
-- * user_id is forcibly set to auth.uid() on every row, so a caller
--   cannot impersonate another user even if they tried to stuff a
--   different user_id in the JSON payload.
-- * id / created_at / updated_at are stripped from the input so the
--   DB-generated defaults win.
-- * analysis_id on positions is overwritten with the freshly-minted
--   analysis id.
-- * Uses jsonb_populate_record(set) so adding new columns to the
--   analyses / positions tables does not require updating these
--   functions — they map by column name.

-- Generic helper not strictly required but documents the pattern used
-- below. We inline it into each function to keep them standalone and
-- independently grantable.

-- PPA --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_ppa_analysis_with_positions(
  analysis_data jsonb,
  positions_data jsonb DEFAULT '[]'::jsonb
) RETURNS ppa_analyses
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_analysis ppa_analyses;
  positions_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO ppa_analyses
  SELECT * FROM jsonb_populate_record(
    NULL::ppa_analyses,
    (analysis_data - 'id' - 'created_at' - 'updated_at')
      || jsonb_build_object('user_id', auth.uid())
  )
  RETURNING * INTO new_analysis;

  IF positions_data IS NOT NULL AND jsonb_array_length(positions_data) > 0 THEN
    SELECT jsonb_agg(
      (elem - 'id' - 'created_at')
        || jsonb_build_object('analysis_id', new_analysis.id, 'user_id', auth.uid())
    )
    INTO positions_payload
    FROM jsonb_array_elements(positions_data) elem;

    INSERT INTO ppa_extracted_positions
    SELECT * FROM jsonb_populate_recordset(
      NULL::ppa_extracted_positions,
      positions_payload
    );
  END IF;

  RETURN new_analysis;
END;
$$;

-- Tolling ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_tolling_analysis_with_positions(
  analysis_data jsonb,
  positions_data jsonb DEFAULT '[]'::jsonb
) RETURNS tolling_analyses
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_analysis tolling_analyses;
  positions_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO tolling_analyses
  SELECT * FROM jsonb_populate_record(
    NULL::tolling_analyses,
    (analysis_data - 'id' - 'created_at' - 'updated_at')
      || jsonb_build_object('user_id', auth.uid())
  )
  RETURNING * INTO new_analysis;

  IF positions_data IS NOT NULL AND jsonb_array_length(positions_data) > 0 THEN
    SELECT jsonb_agg(
      (elem - 'id' - 'created_at')
        || jsonb_build_object('analysis_id', new_analysis.id, 'user_id', auth.uid())
    )
    INTO positions_payload
    FROM jsonb_array_elements(positions_data) elem;

    INSERT INTO tolling_extracted_positions
    SELECT * FROM jsonb_populate_recordset(
      NULL::tolling_extracted_positions,
      positions_payload
    );
  END IF;

  RETURN new_analysis;
END;
$$;

-- Carbon ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_carbon_analysis_with_positions(
  analysis_data jsonb,
  positions_data jsonb DEFAULT '[]'::jsonb
) RETURNS carbon_analyses
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_analysis carbon_analyses;
  positions_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO carbon_analyses
  SELECT * FROM jsonb_populate_record(
    NULL::carbon_analyses,
    (analysis_data - 'id' - 'created_at' - 'updated_at')
      || jsonb_build_object('user_id', auth.uid())
  )
  RETURNING * INTO new_analysis;

  IF positions_data IS NOT NULL AND jsonb_array_length(positions_data) > 0 THEN
    SELECT jsonb_agg(
      (elem - 'id' - 'created_at')
        || jsonb_build_object('analysis_id', new_analysis.id, 'user_id', auth.uid())
    )
    INTO positions_payload
    FROM jsonb_array_elements(positions_data) elem;

    INSERT INTO carbon_extracted_positions
    SELECT * FROM jsonb_populate_recordset(
      NULL::carbon_extracted_positions,
      positions_payload
    );
  END IF;

  RETURN new_analysis;
END;
$$;

-- IT Supply -------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_it_supply_analysis_with_positions(
  analysis_data jsonb,
  positions_data jsonb DEFAULT '[]'::jsonb
) RETURNS it_supply_analyses
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_analysis it_supply_analyses;
  positions_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO it_supply_analyses
  SELECT * FROM jsonb_populate_record(
    NULL::it_supply_analyses,
    (analysis_data - 'id' - 'created_at' - 'updated_at')
      || jsonb_build_object('user_id', auth.uid())
  )
  RETURNING * INTO new_analysis;

  IF positions_data IS NOT NULL AND jsonb_array_length(positions_data) > 0 THEN
    SELECT jsonb_agg(
      (elem - 'id' - 'created_at')
        || jsonb_build_object('analysis_id', new_analysis.id, 'user_id', auth.uid())
    )
    INTO positions_payload
    FROM jsonb_array_elements(positions_data) elem;

    INSERT INTO it_supply_extracted_positions
    SELECT * FROM jsonb_populate_recordset(
      NULL::it_supply_extracted_positions,
      positions_payload
    );
  END IF;

  RETURN new_analysis;
END;
$$;

-- Cloud Compute --------------------------------------------------------
CREATE OR REPLACE FUNCTION create_cloud_compute_analysis_with_positions(
  analysis_data jsonb,
  positions_data jsonb DEFAULT '[]'::jsonb
) RETURNS cloud_compute_analyses
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_analysis cloud_compute_analyses;
  positions_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO cloud_compute_analyses
  SELECT * FROM jsonb_populate_record(
    NULL::cloud_compute_analyses,
    (analysis_data - 'id' - 'created_at' - 'updated_at')
      || jsonb_build_object('user_id', auth.uid())
  )
  RETURNING * INTO new_analysis;

  IF positions_data IS NOT NULL AND jsonb_array_length(positions_data) > 0 THEN
    SELECT jsonb_agg(
      (elem - 'id' - 'created_at')
        || jsonb_build_object('analysis_id', new_analysis.id, 'user_id', auth.uid())
    )
    INTO positions_payload
    FROM jsonb_array_elements(positions_data) elem;

    INSERT INTO cloud_compute_extracted_positions
    SELECT * FROM jsonb_populate_recordset(
      NULL::cloud_compute_extracted_positions,
      positions_payload
    );
  END IF;

  RETURN new_analysis;
END;
$$;

-- Grant execute to authenticated users so the RPCs are callable from
-- the JS client. Anon users cannot auth.uid() so they'd fail anyway,
-- but being explicit is clearer.
GRANT EXECUTE ON FUNCTION create_ppa_analysis_with_positions(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tolling_analysis_with_positions(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_carbon_analysis_with_positions(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_it_supply_analysis_with_positions(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_cloud_compute_analysis_with_positions(jsonb, jsonb) TO authenticated;
