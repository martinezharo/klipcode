-- Legacy snapshots and the final export can describe the same sign-in.
DELETE FROM analytics_signins WHERE rowid NOT IN (SELECT MIN(rowid) FROM analytics_signins GROUP BY account,at);
CREATE UNIQUE INDEX analytics_signins_unique_event ON analytics_signins(account,at);
