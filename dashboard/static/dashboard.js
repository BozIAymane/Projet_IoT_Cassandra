/**
 * ========================================
 * TURBINE IoT DASHBOARD — JavaScript
 * Real-time monitoring & data visualization
 * ========================================
 */

// ===== CONFIG =====
const API_BASE = "";
const TURBINE_IDS = ["T101", "T102", "T103"];
const TURBINE_COLORS = {
    T101: { main: "#6366f1", light: "rgba(99,102,241,0.15)", gradient: ["#6366f1", "#818cf8"] },
    T102: { main: "#06b6d4", light: "rgba(6,182,212,0.15)", gradient: ["#06b6d4", "#22d3ee"] },
    T103: { main: "#f59e0b", light: "rgba(245,158,11,0.15)", gradient: ["#f59e0b", "#fbbf24"] },
};
const REFRESH_INTERVAL = 10000; // 10 seconds

// ===== STATE =====
let currentPage = "overview";
let overviewData = null;
let charts = {};
let refreshTimer = null;

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initRefreshButton();
    initMenuToggle();
    loadOverview();

    // Auto-refresh
    refreshTimer = setInterval(() => {
        if (currentPage === "overview") loadOverview();
        else loadTurbineDetail(currentPage);
    }, REFRESH_INTERVAL);

    // Render icons
    if (window.lucide) lucide.createIcons();
});

// ===== NAVIGATION =====
function initNavigation() {
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update nav
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add("active");

    // Update pages
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));

    if (page === "overview") {
        document.getElementById("page-overview").classList.add("active");
        document.getElementById("page-title").textContent = "Vue d'ensemble";
        document.getElementById("page-subtitle").textContent = "Monitoring en temps réel des turbines éoliennes";
        loadOverview();
    } else {
        document.getElementById("page-turbine-detail").classList.add("active");
        document.getElementById("page-title").textContent = `Turbine ${page}`;
        document.getElementById("page-subtitle").textContent = `Statistiques détaillées et historique`;
        loadTurbineDetail(page);
    }

    currentPage = page;

    // Close mobile sidebar
    document.getElementById("sidebar").classList.remove("open");
}

// ===== MENU TOGGLE =====
function initMenuToggle() {
    const btn = document.getElementById("menu-toggle");
    btn.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });
}

// ===== REFRESH =====
function initRefreshButton() {
    const btn = document.getElementById("btn-refresh");
    btn.addEventListener("click", () => {
        btn.classList.add("spinning");
        const cb = () => btn.classList.remove("spinning");
        if (currentPage === "overview") loadOverview().finally(cb);
        else loadTurbineDetail(currentPage).finally(cb);
    });
}

// ===== LOADING =====
function showLoading() {
    document.getElementById("loading-overlay").classList.remove("hidden");
}
function hideLoading() {
    document.getElementById("loading-overlay").classList.add("hidden");
}

function updateTimestamp() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const el = document.getElementById("last-update");
    el.querySelector("span").textContent = `Mis à jour: ${timeStr}`;
}

// ===== DATA FETCHING =====
async function fetchJSON(url) {
    const res = await fetch(API_BASE + url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ===== CLUSTER STATUS =====
async function checkClusterStatus() {
    try {
        const data = await fetchJSON("/api/cluster/status");
        const el = document.getElementById("cluster-status");
        const dot = el.querySelector(".status-dot");
        const span = el.querySelector("span");

        if (data.status === "connected") {
            dot.className = "status-dot connected";
            span.textContent = `Cluster: ${data.nodes} nœuds`;
        } else {
            dot.className = "status-dot disconnected";
            span.textContent = "Cluster: Déconnecté";
        }
    } catch {
        const el = document.getElementById("cluster-status");
        el.querySelector(".status-dot").className = "status-dot disconnected";
        el.querySelector("span").textContent = "Cluster: Erreur";
    }
}

// ===== OVERVIEW PAGE =====
async function loadOverview() {
    try {
        const [overview] = await Promise.all([
            fetchJSON("/api/overview"),
            checkClusterStatus(),
        ]);

        overviewData = overview;
        renderGlobalKPIs(overview);
        renderTurbineCards(overview);
        await loadOverviewCharts();
        updateTimestamp();
        hideLoading();
    } catch (err) {
        console.error("Error loading overview:", err);
        hideLoading();
    }
}

function renderGlobalKPIs(data) {
    let totalReadings = 0;
    let totalEnergy = 0;
    let avgWindAll = 0;
    let avgPowerAll = 0;
    let count = 0;

    for (const tid of TURBINE_IDS) {
        const t = data[tid];
        if (!t) continue;
        totalReadings += t.total_readings;
        totalEnergy += t.total_energy;
        avgWindAll += t.avg_wind_speed;
        avgPowerAll += t.avg_power;
        count++;
    }

    if (count > 0) {
        avgWindAll = (avgWindAll / count).toFixed(2);
        avgPowerAll = (avgPowerAll / count).toFixed(1);
    }

    const kpiRow = document.getElementById("global-kpi-row");
    kpiRow.innerHTML = `
        <div class="kpi-card accent-primary">
            <div class="kpi-icon bg-primary">
                <i data-lucide="database"></i>
            </div>
            <div class="kpi-label">Total Lectures</div>
            <div class="kpi-value">${formatNumber(totalReadings)}</div>
        </div>
        <div class="kpi-card accent-cyan">
            <div class="kpi-icon bg-cyan">
                <i data-lucide="wind"></i>
            </div>
            <div class="kpi-label">Vent Moyen</div>
            <div class="kpi-value">${avgWindAll}<span class="unit">m/s</span></div>
        </div>
        <div class="kpi-card accent-green">
            <div class="kpi-icon bg-green">
                <i data-lucide="zap"></i>
            </div>
            <div class="kpi-label">Puissance Moyenne</div>
            <div class="kpi-value">${formatNumber(Math.round(avgPowerAll))}<span class="unit">kW</span></div>
        </div>
        <div class="kpi-card accent-amber">
            <div class="kpi-icon bg-amber">
                <i data-lucide="battery-charging"></i>
            </div>
            <div class="kpi-label">Énergie Totale</div>
            <div class="kpi-value">${formatNumber(Math.round(totalEnergy))}<span class="unit">kWh</span></div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function renderTurbineCards(data) {
    const container = document.getElementById("turbine-cards");
    container.innerHTML = "";

    for (const tid of TURBINE_IDS) {
        const t = data[tid];
        if (!t) continue;

        const card = document.createElement("div");
        card.className = "turbine-card";
        card.dataset.turbine = tid;
        card.addEventListener("click", () => navigateTo(tid));

        card.innerHTML = `
            <div class="turbine-card-header">
                <div class="turbine-id-badge">
                    <span class="turbine-dot ${tid}"></span>
                    <h3>${tid}</h3>
                </div>
                <span class="readings-count">${formatNumber(t.total_readings)} lectures</span>
            </div>
            <div class="turbine-card-stats">
                <div class="stat-item">
                    <span class="stat-val">${t.avg_wind_speed}</span>
                    <span class="stat-label">Vent Moy. (m/s)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-val">${formatNumber(Math.round(t.avg_power))}</span>
                    <span class="stat-label">Puissance (kW)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-val">${formatNumber(Math.round(t.total_energy))}</span>
                    <span class="stat-label">Énergie (kWh)</span>
                </div>
            </div>
        `;

        container.appendChild(card);
    }
}

async function loadOverviewCharts() {
    try {
        const allTimeseries = await Promise.all(
            TURBINE_IDS.map((tid) => fetchJSON(`/api/turbine/${tid}/timeseries`))
        );

        renderWindCompare(allTimeseries);
        renderPowerCompare(allTimeseries);
    } catch (err) {
        console.error("Chart data error:", err);
    }
}

// ===== CHART RENDERING =====
const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
        legend: {
            position: "top",
            labels: {
                color: "#94a3b8",
                font: { family: "Inter", size: 11, weight: 500 },
                usePointStyle: true,
                pointStyleWidth: 8,
                boxHeight: 6,
                padding: 16,
            },
        },
        tooltip: {
            backgroundColor: "#1a1f35",
            titleColor: "#f1f5f9",
            bodyColor: "#94a3b8",
            borderColor: "rgba(148,163,184,0.15)",
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: "Inter", weight: 600 },
            bodyFont: { family: "Inter" },
        },
    },
    scales: {
        x: {
            grid: { color: "rgba(148,163,184,0.06)", drawBorder: false },
            ticks: {
                color: "#64748b",
                font: { family: "Inter", size: 10 },
                maxTicksLimit: 12,
                maxRotation: 0,
            },
        },
        y: {
            grid: { color: "rgba(148,163,184,0.06)", drawBorder: false },
            ticks: {
                color: "#64748b",
                font: { family: "Inter", size: 10 },
            },
        },
    },
};

function getOrCreateChart(canvasId, config) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    const ctx = document.getElementById(canvasId)?.getContext("2d");
    if (!ctx) return null;

    charts[canvasId] = new Chart(ctx, config);
    return charts[canvasId];
}

function makeGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, color1.replace(")", ",0.25)").replace("rgb", "rgba"));
    gradient.addColorStop(1, color1.replace(")", ",0.01)").replace("rgb", "rgba"));
    return gradient;
}

function formatTimeLabel(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderWindCompare(allData) {
    const labels = allData[0]?.data?.map((d) => formatTimeLabel(d.timestamp)) || [];

    const datasets = allData.map((td, i) => {
        const tid = TURBINE_IDS[i];
        const color = TURBINE_COLORS[tid];
        return {
            label: tid,
            data: td.data.map((d) => d.wind_speed),
            borderColor: color.main,
            backgroundColor: color.light,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.4,
            fill: false,
        };
    });

    getOrCreateChart("chart-wind-compare", {
        type: "line",
        data: { labels, datasets },
        options: {
            ...CHART_DEFAULTS,
            scales: {
                ...CHART_DEFAULTS.scales,
                y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: "m/s", color: "#64748b", font: { family: "Inter", size: 10 } } },
            },
        },
    });
}

function renderPowerCompare(allData) {
    const labels = allData[0]?.data?.map((d) => formatTimeLabel(d.timestamp)) || [];

    const datasets = allData.map((td, i) => {
        const tid = TURBINE_IDS[i];
        const color = TURBINE_COLORS[tid];
        return {
            label: tid,
            data: td.data.map((d) => d.power_kw),
            borderColor: color.main,
            backgroundColor: color.light,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.4,
            fill: false,
        };
    });

    getOrCreateChart("chart-power-compare", {
        type: "line",
        data: { labels, datasets },
        options: {
            ...CHART_DEFAULTS,
            scales: {
                ...CHART_DEFAULTS.scales,
                y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: "kW", color: "#64748b", font: { family: "Inter", size: 10 } } },
            },
        },
    });
}

// ===== TURBINE DETAIL PAGE =====
async function loadTurbineDetail(turbineId) {
    try {
        const [stats, timeseries] = await Promise.all([
            fetchJSON(`/api/turbine/${turbineId}/stats`),
            fetchJSON(`/api/turbine/${turbineId}/timeseries`),
        ]);

        renderDetailHeader(turbineId, stats);
        renderDetailKPIs(turbineId, stats);
        renderDetailCharts(turbineId, timeseries);
        renderReadingsTable(timeseries);
        updateTimestamp();
        hideLoading();
    } catch (err) {
        console.error("Error loading detail:", err);
        hideLoading();
    }
}

function renderDetailHeader(tid, stats) {
    const el = document.getElementById("turbine-detail-header");
    el.innerHTML = `
        <div class="detail-turbine-icon ${tid}">
            <i data-lucide="wind"></i>
        </div>
        <div class="detail-turbine-info">
            <h2>Turbine ${tid}</h2>
            <p>${formatNumber(stats.total_readings)} lectures enregistrées dans Cassandra</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDetailKPIs(tid, stats) {
    const el = document.getElementById("detail-kpi-row");
    el.innerHTML = `
        <div class="kpi-card accent-primary">
            <div class="kpi-icon bg-primary"><i data-lucide="database"></i></div>
            <div class="kpi-label">Lectures</div>
            <div class="kpi-value">${formatNumber(stats.total_readings)}</div>
        </div>
        <div class="kpi-card accent-cyan">
            <div class="kpi-icon bg-cyan"><i data-lucide="wind"></i></div>
            <div class="kpi-label">Vent Moyen</div>
            <div class="kpi-value">${stats.wind_speed.avg}<span class="unit">m/s</span></div>
        </div>
        <div class="kpi-card accent-green">
            <div class="kpi-icon bg-green"><i data-lucide="zap"></i></div>
            <div class="kpi-label">Puissance Moy.</div>
            <div class="kpi-value">${formatNumber(Math.round(stats.power_kw.avg))}<span class="unit">kW</span></div>
        </div>
        <div class="kpi-card accent-amber">
            <div class="kpi-icon bg-amber"><i data-lucide="battery-charging"></i></div>
            <div class="kpi-label">Énergie Totale</div>
            <div class="kpi-value">${formatNumber(Math.round(stats.total_energy_kwh))}<span class="unit">kWh</span></div>
        </div>
        <div class="kpi-card accent-primary">
            <div class="kpi-icon bg-primary"><i data-lucide="arrow-up"></i></div>
            <div class="kpi-label">Vent Max</div>
            <div class="kpi-value">${stats.wind_speed.max}<span class="unit">m/s</span></div>
        </div>
        <div class="kpi-card accent-green">
            <div class="kpi-icon bg-green"><i data-lucide="trending-up"></i></div>
            <div class="kpi-label">Puissance Max</div>
            <div class="kpi-value">${formatNumber(Math.round(stats.power_kw.max))}<span class="unit">kW</span></div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDetailCharts(tid, timeseries) {
    const labels = timeseries.data.map((d) => formatTimeLabel(d.timestamp));
    const color = TURBINE_COLORS[tid];

    // Wind Chart
    const windCtx = document.getElementById("chart-detail-wind")?.getContext("2d");
    if (windCtx) {
        const gradient = windCtx.createLinearGradient(0, 0, 0, 340);
        gradient.addColorStop(0, color.main + "33");
        gradient.addColorStop(1, color.main + "03");

        getOrCreateChart("chart-detail-wind", {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Vitesse du Vent",
                    data: timeseries.data.map((d) => d.wind_speed),
                    borderColor: color.main,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 5,
                    tension: 0.4,
                    fill: true,
                }],
            },
            options: {
                ...CHART_DEFAULTS,
                plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
            },
        });
    }

    // Power Chart
    getOrCreateChart("chart-detail-power", {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Puissance",
                data: timeseries.data.map((d) => d.power_kw),
                backgroundColor: color.main + "55",
                borderColor: color.main,
                borderWidth: 1,
                borderRadius: 3,
            }],
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
        },
    });

    // Energy Chart
    getOrCreateChart("chart-detail-energy", {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Énergie Exportée",
                data: timeseries.data.map((d) => d.energy_kwh),
                borderColor: "#10b981",
                backgroundColor: "rgba(16,185,129,0.1)",
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 5,
                tension: 0.4,
                fill: true,
            }],
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
        },
    });
}

function renderReadingsTable(timeseries) {
    const tbody = document.getElementById("readings-tbody");
    // Show last 20 readings (most recent first)
    const recent = [...timeseries.data].reverse().slice(0, 20);

    tbody.innerHTML = recent.map((r) => `
        <tr>
            <td>${r.timestamp ? new Date(r.timestamp).toLocaleString("fr-FR") : "—"}</td>
            <td>${r.wind_speed} m/s</td>
            <td>${r.power_kw} kW</td>
            <td>${r.energy_kwh} kWh</td>
        </tr>
    `).join("");
}

// ===== UTILITIES =====
function formatNumber(n) {
    if (n === null || n === undefined) return "0";
    return n.toLocaleString("fr-FR");
}
