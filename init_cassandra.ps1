# Script d'initialisation du Keyspace et Table Cassandra
$OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "[WAIT] Initialisation de Cassandra (Attente du démarrage)..." -ForegroundColor Cyan

# Boucle pour attendre que Cassandra soit prêt
$retryCount = 0
$maxRetries = 20
while ($retryCount -lt $maxRetries) {
    if (docker exec cassandra1 nodetool status | Select-String "UN") {
        Write-Host "`n[OK] Cassandra est prêt !" -ForegroundColor Green
        break
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $retryCount++
}

if ($retryCount -eq $maxRetries) {
    Write-Host "`n[ERROR] Cassandra n'a pas démarré à temps (Vérifiez Docker)." -ForegroundColor Red
    exit 1
}

Write-Host "[SQL] Création du schéma (Keyspace + Table)..." -ForegroundColor Cyan
# Utilisation du fichier schema.cql avec pipe PowerShell
Get-Content schema.cql | docker exec -i cassandra1 cqlsh

Write-Host "`n[DONE] Base de données 'turbine_data' initialisée avec succès (RF=3)!" -ForegroundColor Green
Write-Host "[NEXT] Vous pouvez maintenant lancer bridge_mqtt_to_redis.py et pipeline.py." -ForegroundColor Yellow
