def ensure_views(con):
    with con:
        con.execute(
            """
          CREATE VIEW IF NOT EXISTS v_daily_summary AS
          SELECT date(ts,'unixepoch') AS day, type, COALESCE(project_id,'') AS project_id,
                 COUNT(*) AS events, SUM(seconds) AS dwell_total
          FROM events GROUP BY day, type, project_id
        """
        )
