"""
Dashboard API Server - Turbine IoT Monitoring
Connects to Cassandra and serves turbine statistics via a Flask API.
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from cassandra.cluster import Cluster
from datetime import datetime, timedelta
import os
import sys

# ===========================
# CONFIGURATION
# ===========================
CASSANDRA_HOSTS = ["127.0.0.1"]
CASSANDRA_PORT = 9042
CASSANDRA_KEYSPACE = "turbine_data"
TURBINE_IDS = ["T101", "T102", "T103"]

app = Flask(__name__, static_folder="static")
CORS(app)

# ===========================
# CASSANDRA CONNECTION
# ===========================
session = None

def get_session():
    """Get or create Cassandra session"""
    global session
    if session is None:
        try:
            cluster = Cluster(CASSANDRA_HOSTS, port=CASSANDRA_PORT)
            session = cluster.connect(CASSANDRA_KEYSPACE)
            print("✅ Dashboard connecté à Cassandra")
        except Exception as e:
            print(f"❌ Erreur Cassandra: {e}")
            return None
    return session

# ===========================
# ROUTES - STATIC FILES
# ===========================
@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)

# ===========================
# API ROUTES
# ===========================
@app.route("/api/overview")
def api_overview():
    """Get overview statistics for all turbines"""
    s = get_session()
    if s is None:
        return jsonify({"error": "Cassandra non disponible"}), 503

    results = {}
    for tid in TURBINE_IDS:
        try:
            # Get aggregate stats
            row = s.execute(
                "SELECT COUNT(*) as total, AVG(wind_speed) as avg_wind, "
                "AVG(power_kw) as avg_power, SUM(energy_export_kwh) as total_energy, "
                "MAX(wind_speed) as max_wind, MAX(power_kw) as max_power "
                "FROM readings WHERE turbine_id = %s",
                [tid]
            ).one()

            # Get latest reading
            latest = s.execute(
                "SELECT timestamp, wind_speed, power_kw, energy_export_kwh "
                "FROM readings WHERE turbine_id = %s LIMIT 1",
                [tid]
            ).one()

            results[tid] = {
                "total_readings": row.total if row.total else 0,
                "avg_wind_speed": round(row.avg_wind, 2) if row.avg_wind else 0,
                "avg_power": round(row.avg_power, 2) if row.avg_power else 0,
                "total_energy": round(row.total_energy, 2) if row.total_energy else 0,
                "max_wind": round(row.max_wind, 2) if row.max_wind else 0,
                "max_power": round(row.max_power, 2) if row.max_power else 0,
                "latest": {
                    "timestamp": latest.timestamp.isoformat() if latest else None,
                    "wind_speed": round(latest.wind_speed, 2) if latest and latest.wind_speed else 0,
                    "power_kw": round(latest.power_kw, 2) if latest and latest.power_kw else 0,
                    "energy_kwh": round(latest.energy_export_kwh, 2) if latest and latest.energy_export_kwh else 0,
                } if latest else None
            }
        except Exception as e:
            print(f"⚠️ Erreur pour {tid}: {e}")
            results[tid] = {
                "total_readings": 0, "avg_wind_speed": 0, "avg_power": 0,
                "total_energy": 0, "max_wind": 0, "max_power": 0, "latest": None
            }

    return jsonify(results)


@app.route("/api/turbine/<turbine_id>/timeseries")
def api_timeseries(turbine_id):
    """Get time-series data for a specific turbine (last 100 readings)"""
    s = get_session()
    if s is None:
        return jsonify({"error": "Cassandra non disponible"}), 503

    if turbine_id not in TURBINE_IDS:
        return jsonify({"error": f"Turbine {turbine_id} inconnue"}), 404

    try:
        rows = s.execute(
            "SELECT timestamp, wind_speed, power_kw, energy_export_kwh "
            "FROM readings WHERE turbine_id = %s LIMIT 100",
            [turbine_id]
        )

        data = []
        for r in rows:
            data.append({
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "wind_speed": round(r.wind_speed, 2) if r.wind_speed else 0,
                "power_kw": round(r.power_kw, 2) if r.power_kw else 0,
                "energy_kwh": round(r.energy_export_kwh, 2) if r.energy_export_kwh else 0,
            })

        # Reverse so oldest first (for charts)
        data.reverse()
        return jsonify({"turbine_id": turbine_id, "data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/turbine/<turbine_id>/stats")
def api_turbine_stats(turbine_id):
    """Get detailed stats for a specific turbine"""
    s = get_session()
    if s is None:
        return jsonify({"error": "Cassandra non disponible"}), 503

    if turbine_id not in TURBINE_IDS:
        return jsonify({"error": f"Turbine {turbine_id} inconnue"}), 404

    try:
        # Aggregate stats
        row = s.execute(
            "SELECT COUNT(*) as total, AVG(wind_speed) as avg_wind, "
            "AVG(power_kw) as avg_power, SUM(energy_export_kwh) as total_energy, "
            "MAX(wind_speed) as max_wind, MIN(wind_speed) as min_wind, "
            "MAX(power_kw) as max_power, MIN(power_kw) as min_power "
            "FROM readings WHERE turbine_id = %s",
            [turbine_id]
        ).one()

        return jsonify({
            "turbine_id": turbine_id,
            "total_readings": row.total if row.total else 0,
            "wind_speed": {
                "avg": round(row.avg_wind, 2) if row.avg_wind else 0,
                "max": round(row.max_wind, 2) if row.max_wind else 0,
                "min": round(row.min_wind, 2) if row.min_wind else 0,
            },
            "power_kw": {
                "avg": round(row.avg_power, 2) if row.avg_power else 0,
                "max": round(row.max_power, 2) if row.max_power else 0,
                "min": round(row.min_power, 2) if row.min_power else 0,
            },
            "total_energy_kwh": round(row.total_energy, 2) if row.total_energy else 0,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cluster/status")
def api_cluster_status():
    """Basic cluster connectivity check"""
    s = get_session()
    if s is None:
        return jsonify({"status": "disconnected", "nodes": 0})

    try:
        s.execute("SELECT now() FROM system.local")
        return jsonify({"status": "connected", "nodes": 3, "keyspace": CASSANDRA_KEYSPACE})
    except Exception:
        return jsonify({"status": "error", "nodes": 0})


# ===========================
# MAIN
# ===========================
if __name__ == "__main__":
    print("🚀 Dashboard Turbine IoT - Démarrage...")
    print("📊 Accédez au dashboard sur: http://localhost:5050")
    app.run(host="0.0.0.0", port=5050, debug=True)
