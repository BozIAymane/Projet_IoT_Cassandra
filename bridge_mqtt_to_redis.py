import json
import paho.mqtt.client as mqtt
import redis
import sys

# Configuration
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "wind/turbine/data/#"

REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_KEY = "turbine_queue"

# Connexion Redis
try:
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.ping()
    print("Connecté à Redis !")
except Exception as e:
    print(f"Erreur de connexion Redis: {e}")
    sys.exit(1)

def on_connect(client, userdata, flags, rc):
    print(f"Connecté au MQTT Broker avec code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        # On pousse brut dans Redis (LPUSH)
        # Le script de traitement fera le BLPOP
        r.lpush(REDIS_KEY, payload)
        print(f"Message relayé vers Redis pour topic {msg.topic}")
    except Exception as e:
        print(f"Erreur relais: {e}")

def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    print(f"Connexion MQTT {MQTT_BROKER}...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"Erreur connexion MQTT: {e}")

if __name__ == "__main__":
    main()
