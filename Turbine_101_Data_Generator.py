import json
import time
import random
import numpy as np
from datetime import datetime
import paho.mqtt.client as mqtt

# ======================
# MQTT CONFIGURATION
# ======================
BROKER = "localhost"
PORT = 1883
TOPIC = "wind/turbine/data/T101"

client = mqtt.Client()
client.connect(BROKER, PORT, 60)

# ======================
# STATISTIQUES (Basé sur le Dataset original pour T101)
# ======================
WIND_MEAN, WIND_STD = 5.98, 2.52
POWER_MEAN, POWER_STD = 504.87, 519.44
NULL_PROBABILITY = 0.08

# Limites (approximatives basées sur les autres turbines si non définies, 
# ajustées pour cohérence avec les valeurs moyennes)
WIND_MIN = 0.1
WIND_MAX = 21.5
POWER_MIN = -15
POWER_MAX = 2068

def generate_message(row_id):
    wind_speed = np.random.normal(WIND_MEAN, WIND_STD)
    wind_speed = float(np.clip(wind_speed, WIND_MIN, WIND_MAX))
    
    # Simuler des valeurs nulles pour le TP (test imputation)
    if random.random() < NULL_PROBABILITY:
        wind_speed = None
        power = None
    else:
        power = wind_speed * np.random.normal(90, 25)
        
        # Parfois une puissance négative (consommation)
        if random.random() < 0.1:
             power = -abs(power)
             
        power = float(np.clip(power, POWER_MIN, POWER_MAX))

    energy = (power * 0.25) if (power and power > 0) else 0.0

    return {
        "turbine_id": "T101",
        "data": {
            "# Date and time": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
            "Wind speed (m/s)": round(wind_speed, 3) if wind_speed is not None else None,
            "Power (kW)": round(power, 2) if power is not None else None,
            "Energy Export (kWh)": round(energy, 2)
        }
    }

print(f"🚀 Démarrage du générateur T101 (MQTT)...")
row = 0
try:
    while True:
        msg = generate_message(row)
        payload = json.dumps(msg, indent=4)
        
        # Envoi via MQTT
        client.publish(TOPIC, payload)
        print(f"📡 [T101] Message envoyé: {msg['data']['# Date and time']}")
        
        time.sleep(1)
        row += 1
except KeyboardInterrupt:
    print("\n🛑 Arrêt du générateur.")
