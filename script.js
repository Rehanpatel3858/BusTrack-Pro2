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

// Mapping for Parent → Bus
const parentBusMap = {
    "student1": "bus01",
    "student2": "bus02",
    "student3": "bus03",
    "student4": "bus04",
    "student5": "bus05",
    "student6": "bus06"
};

// Mapping for Driver → Bus
const driverBusMap = {
    "bus01": "bus01",
    "bus02": "bus02",
    "bus03": "bus03",
    "bus04": "bus04",
    "bus05": "bus05",
    "bus06": "bus06"
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
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Enter login details");
        return;
    }

    if (!currentRole) {
        alert("Select role first");
        return;
    }

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-container").style.display = "block";

    // Hide all portals first
    document.getElementById("driver-portal").style.display = "none";
    document.getElementById("monitor-portal").style.display = "none";

    // Show correct portal
    if (currentRole === "driver") {
        document.getElementById("driver-portal").style.display = "block";
    } else if (currentRole === "admin") {
        document.getElementById("monitor-portal").style.display = "block";
        loadAdminBuses();
    } else if (currentRole === "parent") {
        document.getElementById("monitor-portal").style.display = "block";
        const assignedBus = parentBusMap[username];
        if (assignedBus) {
            changeBus(assignedBus);
        }
    }

    // Initialize map after login success
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
function changeBus(id) {
    isUserInteracting = true;
    lastUserActionTime = Date.now();
    
    activeBusID = id;
    sessionStorage.setItem("active_bus", id);
    updateChipUI(id);
    
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (busMarker) { busMarker.remove(); busMarker = null; }
    if (destMarker) { destMarker.remove(); destMarker = null; }
    
    startCoords = null;
    endCoords = null;
    
    syncData();
    showToast(`Selected Bus ${formatBusID(id)}`);
    
    setTimeout(() => {
        isUserInteracting = false;
        lastUserActionTime = 0;
    }, INTERACTION_COOLDOWN);
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
    const allChips = document.querySelectorAll(".chip");

    allChips.forEach(chip => {
        const bus = chip.innerText.toLowerCase().replace("-", "");

        if (busId === "all") {
            chip.parentElement.style.display = "flex";
        } else {
            if (bus === busId) {
                chip.parentElement.style.display = "flex";
            } else {
                chip.parentElement.style.display = "none";
            }
        }
    });

    if (busId !== "all") {
        changeBus(busId);
    }
}

let currentCoords = null;
let destinationCoords = null;

function searchAndMove(type) {
    const inputId = type === "current" ? "search-src" : "search-dest";
    const query = document.getElementById(inputId).value;

    if (!query) return;

    tt.services.fuzzySearch({
        key: "RlUjrRnVgicCym6rNTEWTDxJa7URNexi",
        query: query
    }).then(result => {
        const pos = result.results[0].position;
        const coords = [pos.lng, pos.lat];

        if (type === "current") {
            currentCoords = coords;
        } else {
            destinationCoords = coords;
        }

        if (currentCoords && destinationCoords) {
            drawRoute();
        }
    });
}

function drawRoute() {
    tt.services.calculateRoute({
        key: "RlUjrRnVgicCym6rNTEWTDxJa7URNexi",
        locations: currentCoords.join(",") + ":" + destinationCoords.join(",")
    }).then(routeData => {
        const geojson = routeData.toGeoJson();

        if (map.getSource("route")) {
            map.removeLayer("route");
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
                "line-color": "#3b82f6",
                "line-width": 5
            }
        });
    });
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
