console.log("SCRIPT LOADED SUCCESSFULLY");

/**
 * BUSTRACK MB - Main Script
 * Clean version with no merge conflicts
 */

const TOMTOM_KEY = 'RlUjrRnVgicCym6rNTEWTDxJa7URNexi';
let map, busMarker, destMarker, routeLayer;
let activeBusID = "bus01";
let startCoords = null;
let endCoords = null;

// Role management
let currentRole = "";
let currentUser = "";
let currentBus = "bus01";

// Live bus state storage
const liveBusState = {
    bus01: {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    },
    bus02: {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    },
    bus03: {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    },
    bus04: {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    },
    bus05: {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    },
    bus06: {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    }
};

// Mapping for Parent → Bus
const parentBusMap = {
    "student01": "bus01",
    "student02": "bus02",
    "student03": "bus03",
    "student04": "bus04",
    "student05": "bus05",
    "student06": "bus06"
};

// Mapping for Driver → Bus
const driverBusMap = {
    "driver01": "bus01",
    "driver02": "bus02",
    "driver03": "bus03",
    "driver04": "bus04",
    "driver05": "bus05",
    "driver06": "bus06"
};

// State management flags
let isUserInteracting = false;
let isResetting = false;
let lastUserActionTime = 0;
const INTERACTION_COOLDOWN = 3000;

// Show/hide sync status
function showSyncStatus() {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) syncStatus.style.display = 'flex';
}

function hideSyncStatus() {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) syncStatus.style.display = 'none';
}

function updateSyncStatus() {
    if (isUserInteracting || isResetting) {
        showSyncStatus();
    } else {
        hideSyncStatus();
    }
}

// NOTIFICATION SYSTEM
let notifications = [];
let unreadCount = 0;
let journeySimulationInterval = null;

// HARDCODED USER CREDENTIALS
const USERS = {
    'admin': { password: 'schooladmin789', role: 'admin', busId: null },
    'student01': { password: 'pass01', role: 'parent', busId: 'bus01' },
    'student02': { password: 'pass02', role: 'parent', busId: 'bus02' },
    'student03': { password: 'pass03', role: 'parent', busId: 'bus03' },
    'student04': { password: 'pass04', role: 'parent', busId: 'bus04' },
    'student05': { password: 'pass05', role: 'parent', busId: 'bus05' },
    'stu1703': { password: '1703', role: 'parent', busId: null },
    'bus01': { password: 'drive123', role: 'driver', busId: 'bus01' },
    'bus02': { password: 'drive123', role: 'driver', busId: 'bus02' },
    'bus03': { password: 'drive123', role: 'driver', busId: 'bus03' },
    'bus04': { password: 'drive123', role: 'driver', busId: 'bus04' },
    'bus05': { password: 'drive123', role: 'driver', busId: 'bus05' },
    'bus06': { password: 'drive123', role: 'driver', busId: 'bus06' }
};

// Initialize fleet data
function initializeFleetData() {
    if (!localStorage.getItem("fleet_data")) {
        const initialFleet = {};
        for (let i = 1; i <= 6; i++) {
            const busId = `bus0${i}`;
            initialFleet[busId] = { active: false };
        }
        localStorage.setItem("fleet_data", JSON.stringify(initialFleet));
    }
}

// === AUTH FUNCTIONS ===
function setTempRole(role) {
    currentRole = role;
    document.getElementById("role-selection-v3").style.display = "none";
    document.getElementById("auth-form-v3").style.display = "block";
}

function processLogin() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Enter login details");
        return;
    }

    if (!currentRole) {
        alert("Select role first");
        return;
    }

    currentUser = username.toLowerCase();

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-container").style.display = "block";

    // Hide all portals
    document.getElementById("driver-portal").style.display = "none";
    document.getElementById("monitor-portal").style.display = "none";

    // ROLE LOGIC
    if (currentRole === "driver") {
        const assignedBus = currentUser;

        document.getElementById("driver-portal").style.display = "block";
        document.getElementById("monitor-portal").style.display = "none";

        setTimeout(() => {
            filterBusForUser(assignedBus);
            changeBus(assignedBus);
        }, 300);
    }
    else if (currentRole === "parent") {
        const assignedBus = parentBusMap[currentUser];

        if (!assignedBus) {
            alert("Invalid student ID");
            return;
        }

        currentBus = assignedBus;

        document.getElementById("monitor-portal").style.display = "block";
        document.getElementById("driver-portal").style.display = "none";

        setTimeout(() => {
            filterBusForUser(assignedBus);
            changeBus(assignedBus);
        }, 100);
    }
    else if (currentRole === "admin") {
        document.getElementById("monitor-portal").style.display = "block";
        document.getElementById("driver-portal").style.display = "none";

        setTimeout(() => {
            filterBusForUser("all");
            changeBus("bus01");
        }, 300);
    }

    // load map after UI
    setTimeout(() => {
        initMap();
    }, 500);
}

function resetLogin() {
    console.log("resetLogin called");
    const roleSelection = document.getElementById('role-selection-v3');
    const authForm = document.getElementById('auth-form-v3');
    if (roleSelection) roleSelection.style.display = 'block';
    if (authForm) authForm.style.display = 'none';
}

function launchDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    const role = sessionStorage.getItem("active_role") || localStorage.getItem("saved_user_role");
    const username = sessionStorage.getItem("active_user") || localStorage.getItem("active_user");
    activeBusID = sessionStorage.getItem("active_bus") || "bus01";
    
    document.getElementById('role-label').innerText = role.toUpperCase();
    document.getElementById('driver-portal').style.display = (role === 'driver') ? 'block' : 'none';
    document.getElementById('monitor-portal').style.display = (role !== 'driver') ? 'block' : 'none';
    
    renderFullFleetList();
    updateChipUI(activeBusID);
    initMap();
}

function logout() {
    localStorage.removeItem('saved_user_role');
    localStorage.removeItem('temp_role');
    sessionStorage.clear();
    location.reload();
}

function switchRole() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    sessionStorage.clear();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    } else {
        alert(message);
    }
}

// Format bus ID
function formatBusID(id) {
    return id.replace(/bus(\d+)/i, 'B-$1').toUpperCase();
}

// Render fleet list
function renderFullFleetList() {
    const fleetContainer = document.querySelector('.fleet-list');
    if (!fleetContainer) return;
    
    const buses = ['bus01', 'bus02', 'bus03', 'bus04', 'bus05', 'bus06'];
    let html = '';
    
    buses.forEach((busId) => {
        const isActive = busId === activeBusID;
        const activeClass = isActive ? 'active' : '';
        html += `
            <div class="fleet-item">
                <div class="chip ${activeClass}" onclick="changeBus('${busId}')">${formatBusID(busId)}</div>
                <button class="btn-reset-bus" onclick="event.stopPropagation(); showResetConfirm('${busId}')" title="Reset ${formatBusID(busId)}">↺</button>
            </div>
        `;
    });
    
    fleetContainer.innerHTML = html;
}

function updateChipUI(id) {
    document.querySelectorAll('.chip').forEach(c => {
        const chipId = c.innerText.toLowerCase().replace("-", "").replace("b", "bus");
        const isActive = chipId === id;
        c.classList.toggle('active', isActive);
    });
}

// Change bus
function changeBus(busId) {
    currentBus = busId;
    const data = liveBusState[busId];
    
    const busTitle = document.getElementById("m-bus-id");
    const fromText = document.getElementById("m-from");
    const toText = document.getElementById("m-to");
    const etaText = document.getElementById("m-eta");
    
    if (busTitle) {
        busTitle.innerText = "VEHICLE: " + busId.toUpperCase();
    }
    
    if (fromText) {
        fromText.innerText = data && data.current ? data.current.name : "--";
    }
    
    if (toText) {
        toText.innerText = data && data.destination ? data.destination.name : "--";
    }
    
    if (etaText) {
        etaText.innerText = data && data.eta ? data.eta + " mins" : "--";
    }
}

function updateParentPanel(busId) {
    const data = liveBusState[busId];
    if (!data) return;

    const fromText = document.getElementById("m-from");
    const toText = document.getElementById("m-to");
    const etaText = document.getElementById("m-eta");

    if (fromText && data.current) {
        fromText.innerText = data.current.name;
    }

    if (toText && data.destination) {
        toText.innerText = data.destination.name;
    }

    if (etaText) {
        etaText.innerText = data.eta ? data.eta + " mins" : "--";
    }
}

// Reset bus
function showResetConfirm(busId) {
    isUserInteracting = true;
    isResetting = true;
    lastUserActionTime = Date.now();
    
    if (confirm(`Reset bus ${formatBusID(busId)}?`)) {
        let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        fleet[busId] = { active: false };
        localStorage.setItem("fleet_data", JSON.stringify(fleet));
        showToast(`Bus ${formatBusID(busId)} reset`);
    }
    
    setTimeout(() => {
        isResetting = false;
        isUserInteracting = false;
    }, 500);
}

function resetBus(busId) {
    showResetConfirm(busId);
}

function closeConfirmModal() {}
function executeReset() {}

// Sync data
function syncData() {
    if (isResetting) return;
    if (isUserInteracting && (Date.now() - lastUserActionTime) < INTERACTION_COOLDOWN) return;
    
    hideSyncStatus();
    
    const fleet = JSON.parse(localStorage.getItem("fleet_data"));
    const role = sessionStorage.getItem("active_role") || localStorage.getItem("saved_user_role");
    
    if (!fleet || !fleet[activeBusID]) return;
    const d = fleet[activeBusID];
    
    if (role !== 'driver') {
        const busIdEl = document.getElementById('m-bus-id');
        if (busIdEl) busIdEl.innerText = "VEHICLE: " + formatBusID(activeBusID);
        
        const fromEl = document.getElementById('m-from');
        if (fromEl) fromEl.innerText = "From: " + (d.from || "--");
        
        const toEl = document.getElementById('m-to');
        if (toEl) toEl.innerText = "To: " + (d.to || "--");
        
        const etaEl = document.getElementById('m-eta');
        if (etaEl) etaEl.innerText = d.eta || "--";
    }
}

// Map functions
function initMap() {
    console.log("MAP INIT RUNNING");
    if (typeof tt === "undefined") {
        console.error("TomTom not loaded");
        return;
    }

    if (map) map.remove();
    
    map = tt.map({
        key: TOMTOM_KEY,
        container: "map",
        center: [72.8777, 19.0760],
        zoom: 12
    });
    
    map.on('load', () => {
        map.resize();
        syncData();
        setTimeout(() => map.invalidateSize(), 500);
    });
    
    window.addEventListener('resize', () => {
        if (map) {
            map.invalidateSize();
        }
    });
}

function loadAdminBuses() {
    const buses = ["bus01","bus02","bus03","bus04","bus05","bus06"];

    const container = document.querySelector(".fleet-list");
    if (!container) return;

    container.innerHTML = "";

    buses.forEach(bus => {
        const div = document.createElement("div");
        div.className = "fleet-item";
        div.innerHTML = `<div class="chip">${bus.toUpperCase()}</div>`;
        container.appendChild(div);
    });
}

function searchAndMove(type) {
    isUserInteracting = true;
    lastUserActionTime = Date.now();
    showToast("Location search coming soon!");
    setTimeout(() => {
        isUserInteracting = false;
    }, INTERACTION_COOLDOWN);
}

function getUserLocation() {
    showToast("GPS location feature coming soon!");
}

function publishTrip() {
    isUserInteracting = true;
    lastUserActionTime = Date.now();
    
    let f = JSON.parse(localStorage.getItem("fleet_data")) || {};
    f[activeBusID] = { ...f[activeBusID], active: true };
    localStorage.setItem("fleet_data", JSON.stringify(f));
    showToast(`Bus ${formatBusID(activeBusID)} is LIVE!`);
    
    setTimeout(() => {
        isUserInteracting = false;
    }, INTERACTION_COOLDOWN);
}

function mapZoomIn() {
    if (map) map.zoomIn();
}

function mapZoomOut() {
    if (map) map.zoomOut();
}

function mapFitAll() {
    if (map) {
        map.setView([72.8557, 19.2813], 14);
    }
}

// ============================================
function initMap() {
    console.log("MAP INIT RUNNING");
    if (typeof tt === "undefined") {
        console.error("TomTom not loaded");
        return;
    }

    map = tt.map({
        key: TOMTOM_KEY,
        container: "map",
        center: [72.8777, 19.0760],
        zoom: 12
    });

}

function loadAdminBuses() {
    const buses = ["bus01","bus02","bus03","bus04","bus05","bus06"];

    const container = document.querySelector(".fleet-list");
    if (!container) return;

    container.innerHTML = "";

    buses.forEach(bus => {
        const div = document.createElement("div");
        div.className = "fleet-item";
        div.innerHTML = `<div class="chip">${bus.toUpperCase()}</div>`;
        container.appendChild(div);
    });
}

function filterBusForUser(busId) {
    const fleetContainer = document.querySelector(".fleet-list");
    if (!fleetContainer) return;

    const buses = [
        "bus01",
        "bus02",
        "bus03",
        "bus04",
        "bus05",
        "bus06"
    ];

    fleetContainer.innerHTML = "";

    buses.forEach(bus => {
        if (busId !== "all" && bus !== busId) {
            return;
        }

        const data = liveBusState[bus];
        const status = data.active ? "LIVE" : "OFFLINE";
        const statusClass = data.active ? "live" : "offline";
        const display = bus.replace("bus", "B-");

        const card = document.createElement("div");
        card.className = "admin-bus-card";

        card.innerHTML = `
            <div class="bus-card-header">
                <div class="bus-id-badge">
                    ${display}
                </div>
                <div class="status-badge ${statusClass}">
                    ${status}
                </div>
            </div>

            <div class="bus-card-details">
                <div class="detail-row">
                    <span class="detail-label">
                        Route
                    </span>
                    <span class="detail-value">
                        ${data.active ? "Active" : "--"}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">
                        ETA
                    </span>
                    <span class="detail-value">
                        ${data.eta ? data.eta + " mins" : "--"}
                    </span>
                </div>
            </div>
        `;

        card.onclick = () => {
            if (!data.routeGeo) return;

            currentBus = bus;

            if (map.getLayer("route")) {
                map.removeLayer("route");
            }

            if (map.getSource("route")) {
                map.removeSource("route");
            }

            map.addLayer({
                id: "route",
                type: "line",
                source: {
                    type: "geojson",
                    data: data.routeGeo
                },
                paint: {
                    "line-color": "#2563eb",
                    "line-width": 7
                }
            });

            updateParentPanel(bus);
        };

        fleetContainer.appendChild(card);
    });
}

let currentCoords = null;
let destinationCoords = null;

async function searchAndMove(type) {
    const inputId = type === "current" ? "search-src" : "search-dest";
    const query = document.getElementById(inputId).value.trim();

    if (!query) return;

    try {
        const result = await tt.services.fuzzySearch({
            key: "RlUjrRnVgicCym6rNTEWTDxJa7URNexi",
            query: query,
            limit: 1
        });

        if (!result.results.length) {
            alert("Location not found");
            return;
        }

        const place = result.results[0];
        const coords = [place.position.lng, place.position.lat];

        if (type === "current") {
            currentCoords = coords;
            liveBusState[currentBus].current = {
                name: query,
                coords: coords
            };
        } else {
            destinationCoords = coords;
            liveBusState[currentBus].destination = {
                name: query,
                coords: coords
            };
        }

        map.flyTo({
            center: coords,
            zoom: 13
        });

        new tt.Marker().setLngLat(coords).addTo(map);

        if (currentCoords && destinationCoords) {
            drawRoute();
        }
    } catch(err) {
        console.error(err);
        alert("Search failed");
    }
}

async function drawRoute() {
    if (!currentCoords || !destinationCoords) {
        alert("Select current and destination");
        return;
    }

    try {
        const routeData = await tt.services.calculateRoute({
            key: "RlUjrRnVgicCym6rNTEWTDxJa7URNexi",
            locations: currentCoords.join(",") + ":" + destinationCoords.join(",")
        });

        const geojson = routeData.toGeoJson();
        const summary = routeData.routes[0].summary;
        const etaMinutes = Math.ceil(summary.travelTimeInSeconds / 60);

        liveBusState[currentBus].eta = etaMinutes;
        liveBusState[currentBus].active = true;
        liveBusState[currentBus].routeGeo = geojson;

        if (map.getLayer("route")) {
            map.removeLayer("route");
        }

        if (map.getSource("route")) {
            map.removeSource("route");
        }

        map.addLayer({
            id: "route",
            type: "line",
            source: {
                type: "geojson",
                data: geojson
            },
            paint: {
                "line-color": "#2563eb",
                "line-width": 7
            }
        });

        const bounds = new tt.LngLatBounds();
        geojson.features[0].geometry.coordinates.forEach(coord => {
            bounds.extend(coord);
        });

        map.fitBounds(bounds, { padding: 70 });

        updateParentPanel(currentBus);
        filterBusForUser(currentRole === "admin" ? "all" : currentBus);
    } catch(err) {
        console.error(err);
        alert("Route generation failed");
    }
}

// EXPORT ALL FUNCTIONS TO GLOBAL SCOPE
// REQUIRED for inline onclick handlers
// ============================================
window.setTempRole = setTempRole;
window.processLogin = processLogin;
window.resetLogin = resetLogin;
window.logout = logout;
window.switchRole = switchRole;
window.showToast = showToast;
window.changeBus = changeBus;
window.resetBus = resetBus;
window.showResetConfirm = showResetConfirm;
window.closeConfirmModal = closeConfirmModal;
window.executeReset = executeReset;
window.searchAndMove = searchAndMove;
window.getUserLocation = getUserLocation;
window.publishTrip = publishTrip;
window.mapZoomIn = mapZoomIn;
window.mapZoomOut = mapZoomOut;
window.mapFitAll = mapFitAll;

console.log('✅ All functions exported to global scope');
console.log('✅ processLogin:', typeof window.processLogin);
console.log('✅ setTempRole:', typeof window.setTempRole);
console.log('✅ Login system ready!');

// Initialize on load
window.onload = () => {
    initializeFleetData();
    
    const savedRole = localStorage.getItem("saved_user_role");
    const isLoggedInSession = sessionStorage.getItem("is_logged_in");
    
    if (isLoggedInSession === "true" || savedRole) {
        launchDashboard();
    }
};
