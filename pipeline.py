import json
import redis
from cassandra.cluster import Cluster
from cassandra.query import SimpleStatement
from datetime import datetime
import sys

# ===========================
# CONFIGURATION
# ===========================
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_KEY = "turbine_queue"

# Cassandra Cluster
CASSANDRA_HOSTS = ["127.0.0.1"]
CASSANDRA_PORT = 9042
CASSANDRA_KEYSPACE = "turbine_data"

stats_memory = {}

def get_cassandra_session():
    """Connexion au cluster Cassandra"""
    try:
        cluster = Cluster(CASSANDRA_HOSTS, port=CASSANDRA_PORT)
        session = cluster.connect(CASSANDRA_KEYSPACE)
        print("✅ Connexion Cassandra OK")
        return session
    except Exception as e:
        print(f"❌ Erreur Connexion Cassandra: {e}")
        return None

def process_and_impute(payload):
    """Traitement et imputation des données manquantes"""
    global stats_memory
    
    turbine_id = payload.get("turbine_id")
    data = payload.get("data", {})
    
    if turbine_id not in stats_memory:
        stats_memory[turbine_id] = {}
        
    # Champs numériques à surveiller
    fields_to_check = ["Wind speed (m/s)", "Power (kW)", "Energy Export (kWh)"]
    
    imputed = []
    
    for field in fields_to_check:
        val = data.get(field)
        
        # Init stats si nécessaire
        if field not in stats_memory[turbine_id]:
            stats_memory[turbine_id][field] = {"count": 0, "sum": 0.0, "mean": 0.0}
            
        stats = stats_memory[turbine_id][field]
        
        if val is None:
            # IMPUTATION PAR LA MOYENNE
            imputed_val = stats["mean"]
            data[field] = round(imputed_val, 3)
            imputed.append(field)
        else:
            # MISE A JOUR DE LA MOYENNE
            try:
                val_float = float(val)
                stats["count"] += 1
                stats["sum"] += val_float
                stats["mean"] = stats["sum"] / stats["count"]
            except:
                pass  # Non numérique
                
    if imputed:
        payload["_imputed_fields"] = imputed
        
    return payload

def insert_to_cassandra(session, payload):
    """Insertion des données dans Cassandra"""
    try:
        turbine_id = payload.get("turbine_id")
        data = payload.get("data", {})
        ts_str = payload.get("timestamp")
        if not ts_str:
            ts_str = data.get("# Date and time")
            
        if ts_str:
            timestamp = datetime.fromisoformat(str(ts_str))
        else:
            timestamp = datetime.now() # Fallback

        
        # Extraction des valeurs
        wind_speed = data.get("Wind speed (m/s)", 0.0)
        power_kw = data.get("Power (kW)", 0.0)
        energy_export = data.get("Energy Export (kWh)", 0.0)
        imputed_fields = payload.get("_imputed_fields", [])
        
        # Requête d'insertion CQL
        query = """
        INSERT INTO readings (
            turbine_id, timestamp, wind_speed, power_kw, 
            energy_export_kwh, imputed_fields, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        
        prepared = session.prepare(query)
        session.execute(prepared, (
            turbine_id,
            timestamp,
            float(wind_speed),
            float(power_kw),
            float(energy_export),
            imputed_fields,
            json.dumps(data)
        ))
        
        return True
    except Exception as e:
        print(f"❌ Erreur insertion Cassandra: {e}")
        return False

def main():
    # Connexion Redis
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        print("✅ Connecté à Redis (Lecteur)")
    except Exception as e:
        print(f"❌ Erreur Redis: {e}")
        return

    # Connexion Cassandra
    session = get_cassandra_session()
    if session is None:
        print("⚠️ Avertissement: Cassandra non disponible, les données ne seront que affichées.")

    print("🔄 En attente de données dans la file Redis...")
    
    while True:
        # Lecture bloquante de la liste Redis
        item = r.blpop(REDIS_KEY, timeout=0)
        
        if item:
            _, raw_json = item
            try:
                payload = json.loads(raw_json)
                
                # Traitement et imputation
                clean_payload = process_and_impute(payload)
                
                # Insertion Cassandra
                if session is not None:
                    if insert_to_cassandra(session, clean_payload):
                        imputed_info = clean_payload.get('_imputed_fields', [])
                        print(f"✅ [{clean_payload['turbine_id']}] Inséré. (Imputés: {imputed_info})")
                else:
                    print(f"⚠️ [{clean_payload['turbine_id']}] Traité (Pas de DB): {clean_payload}")
                    
            except json.JSONDecodeError:
                print("❌ Erreur JSON reçu")
            except Exception as e:
                print(f"❌ Erreur traitement: {e}")

if __name__ == "__main__":
    main()
