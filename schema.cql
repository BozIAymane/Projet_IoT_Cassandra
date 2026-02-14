CREATE KEYSPACE IF NOT EXISTS turbine_data 
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};

CREATE TABLE IF NOT EXISTS turbine_data.readings (
    turbine_id text,
    timestamp timestamp,
    wind_speed double,
    power_kw double,
    energy_export_kwh double,
    imputed_fields list<text>,
    raw_data text,
    PRIMARY KEY (turbine_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);
