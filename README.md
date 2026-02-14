# 🌬️ Projet IoT — Ingestion et Traitement de Données Turbines Éoliennes

> **Pipeline IoT complet** avec stockage distribué Cassandra, traitement temps réel, et dashboard de monitoring interactif.

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white)
![Cassandra](https://img.shields.io/badge/Cassandra-4.1-1287B1?style=flat-square&logo=apache-cassandra&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Alpine-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-Dashboard-000000?style=flat-square&logo=flask&logoColor=white)

---

## 📋 Table des Matières

- [Architecture](#-architecture-du-système)
- [Guide de Démarrage](#-guide-de-démarrage)
- [Dashboard](#-dashboard-de-monitoring)
- [Analyse CQL](#-analyse-des-données-cql)
- [Choix Techniques](#-choix-techniques)

---

## 🏗️ Architecture du Système

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Turbine    │    │  Turbine    │    │  Turbine    │
│   T101      │    │   T102      │    │   T103      │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │  MQTT
                 ┌────────▼────────┐
                 │   Mosquitto     │
                 │  (MQTT Broker)  │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │  Bridge MQTT    │
                 │  → Redis        │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │  Redis Queue    │
                 │  (Buffer)       │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │  Pipeline.py    │
                 │  (Imputation)   │
                 └────────┬────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │ Cassandra 1 │ │ Cassandra 2 │ │ Cassandra 3 │
   │  (Node 1)   │ │  (Node 2)   │ │  (Node 3)   │
   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                          │
                 ┌────────▼────────┐
                 │   Dashboard     │
                 │  (Flask + JS)   │
                 │  localhost:5050 │
                 └─────────────────┘
```

**Composants :**

| # | Composant | Rôle |
|---|-----------|------|
| 1 | **Générateurs IoT** | 3 scripts Python simulant des turbines via MQTT |
| 2 | **Mosquitto** | Broker MQTT collectant les messages |
| 3 | **Bridge MQTT-Redis** | Transfère les données MQTT vers Redis |
| 4 | **Pipeline** | Imputation automatique + insertion Cassandra |
| 5 | **Cassandra Cluster** | 3 nœuds, Replication Factor = 3 |
| 6 | **Dashboard** | Interface web de monitoring temps réel |

---

## 🚀 Guide de Démarrage

### Prérequis
- **Docker Desktop** installé et lancé
- **Python 3.8+**

### 1. Installation des dépendances
```powershell
pip install -r requirements.txt
```

### 2. Lancement de l'infrastructure
```powershell
docker-compose up -d
```
> ⏳ Attendez ~60 secondes pour que le cluster Cassandra soit opérationnel.

### 3. Initialisation de la base de données
```powershell
powershell -ExecutionPolicy Bypass -File .\init_cassandra.ps1
```

### 4. Démarrage du pipeline (terminaux séparés)
```powershell
# Terminal 1 — Bridge MQTT → Redis
python bridge_mqtt_to_redis.py

# Terminal 2 — Pipeline de traitement
python pipeline.py

# Terminal 3, 4, 5 — Simulateurs de turbines
python Turbine_101_Data_Generator.py
python Turbine_102_Data_Generator.py
python Turbine_103_Data_Generator.py
```

### 5. Lancer le Dashboard
```powershell
cd dashboard
python app.py
```
> 📊 Accédez au dashboard sur **http://localhost:5050**

---

## 📊 Dashboard de Monitoring

Le dashboard interactif permet de visualiser en temps réel les données de chaque turbine.

### Fonctionnalités
- **Vue d'ensemble** — KPI globaux (lectures totales, vent moyen, puissance, énergie)
- **Cartes par turbine** — Statistiques individuelles avec accès rapide
- **Graphiques interactifs** — Comparaison des vitesses de vent et puissances (Chart.js)
- **Pages détaillées** — Historique, graphiques dédiés et table des dernières lectures
- **Auto-refresh** — Mise à jour automatique toutes les 10 secondes
- **Responsive** — Fonctionne sur desktop, tablette et mobile
- **Dark Mode** — Interface premium avec design moderne

### Structure du Dashboard
```
dashboard/
├── app.py              # Serveur Flask (API REST)
└── static/
    ├── index.html      # Interface utilisateur
    ├── styles.css      # Design system (Dark Mode)
    └── dashboard.js    # Logique client (Charts, API)
```

### Endpoints API
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/overview` | Statistiques globales de toutes les turbines |
| GET | `/api/turbine/<id>/timeseries` | 100 dernières lectures (time-series) |
| GET | `/api/turbine/<id>/stats` | Statistiques détaillées d'une turbine |
| GET | `/api/cluster/status` | État de connexion au cluster Cassandra |

---

## 🔍 Analyse des Données (CQL)

```sql
-- Voir les dernières données
SELECT * FROM turbine_data.readings LIMIT 5;

-- Vitesse moyenne du vent (T101)
SELECT AVG(wind_speed) FROM turbine_data.readings WHERE turbine_id = 'T101';

-- Énergie totale exportée
SELECT SUM(energy_export_kwh) FROM turbine_data.readings WHERE turbine_id = 'T101';
```

Exécuter via Docker :
```powershell
docker exec -it cassandra1 cqlsh -e "SELECT * FROM turbine_data.readings LIMIT 5;"
```

---

## 🛠️ Maintenance

| Action | Commande |
|--------|----------|
| État du cluster | `docker exec -it cassandra1 nodetool status` |
| Arrêter le projet | `docker-compose down` |

---

## 📝 Choix Techniques

| Technologie | Justification |
|-------------|---------------|
| **Cassandra** | Haute disponibilité et performances exceptionnelles en écriture, idéal pour le flux continu IoT |
| **Redis** | Buffer (tampon) pour éviter la perte de messages si le pipeline est ralenti |
| **MQTT** | Protocole léger et standard pour la communication IoT |
| **Flask** | API REST légère pour servir les données au dashboard |
| **Chart.js** | Visualisation interactive et responsive des données |
| **Imputation** | Le pipeline détecte les valeurs `null` et les remplace par la moyenne glissante |

---

<p align="center">
  <b>Réalisé par Aymane  Bozian</b><br>
  <i>Projet NoSQL — Redis-Cassandra</i>
</p>
