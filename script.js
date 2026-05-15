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

// Authentication users
const authUsers = {
    admin: {
        username: "admin",
        password: "Admin@BusTrack2026"
    },
    drivers: {
        driver01: "Driver@BusTrack2026",
        driver02: "Driver@BusTrack2026",
        driver03: "Driver@BusTrack2026",
        driver04: "Driver@BusTrack2026",
        driver05: "Driver@BusTrack2026",
        driver06: "Driver@BusTrack2026"
    },
    parents: {
        student01: "Parent@BusTrack2026",
        student02: "Parent@BusTrack2026",
        student03: "Parent@BusTrack2026",
        student04: "Parent@BusTrack2026",
        student05: "Parent@BusTrack2026",
        student06: "Parent@BusTrack2026"
    }
};

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
function selectRole(role) {
    currentRole = role;

    const roleBadge = document.getElementById("role-badge");

    const roleTitles = {
        parent: "PARENT PORTAL",
        driver: "DRIVER TERMINAL",
        admin: "ADMIN CENTER"
    };

    roleBadge.innerHTML = roleTitles[role];
    roleBadge.style.display = "block";

    document.getElementById("role-selection-v3").style.display = "none";
    document.getElementById("auth-form-v3").style.display = "block";
}

/**
 * Toggle Password Visibility
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('password-toggle');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '🔒'; // Icon for visible
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️'; // Icon for hidden
    }
}

function processLogin() {
    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        showCustomAlert("Invalid username or password");
        return;
    }

    if (!currentRole) {
        showCustomAlert("Select role first");
        return;
    }

    currentUser = username;

    // ROLE LOGIC
    if (currentRole === "driver") {
        if (!authUsers.drivers[username]) {
            showCustomAlert("Invalid username or password");
            return;
        }

        if (authUsers.drivers[username] !== password) {
            showCustomAlert("Invalid username or password");
            return;
        }

        const assignedBus = driverBusMap[username];
        currentBus = assignedBus;

        // PERSIST ROLE FOR SYNC
        sessionStorage.setItem("active_role", "driver");
        sessionStorage.setItem("active_user", username);
        sessionStorage.setItem("active_bus", assignedBus);
        sessionStorage.setItem("is_logged_in", "true");

        document.getElementById("driver-portal").style.display = "block";
        document.getElementById("monitor-portal").style.display = "none";

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("app-container").style.display = "block";

        setTimeout(() => {
            filterBusForUser(assignedBus);
            changeBus(assignedBus);
        }, 300);
    }
    else if (currentRole === "parent") {
        if (!authUsers.parents[username]) {
            showCustomAlert("Invalid username or password");
            return;
        }

        if (authUsers.parents[username] !== password) {
            showCustomAlert("Invalid username or password");
            return;
        }

        const assignedBus = parentBusMap[username];
        currentBus = assignedBus;

        // PERSIST ROLE FOR SYNC
        sessionStorage.setItem("active_role", "parent");
        sessionStorage.setItem("active_user", username);
        sessionStorage.setItem("active_bus", assignedBus);
        sessionStorage.setItem("is_logged_in", "true");

        document.getElementById("monitor-portal").style.display = "block";
        document.getElementById("driver-portal").style.display = "none";

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("app-container").style.display = "block";

        setTimeout(() => {
            filterBusForUser(assignedBus);
            changeBus(assignedBus);
            updateParentPanel(assignedBus);
        }, 300);
    }
    else if (currentRole === "admin") {
        if (username !== authUsers.admin.username) {
            showCustomAlert("Invalid username or password");
            return;
        }

        if (password !== authUsers.admin.password) {
            showCustomAlert("Invalid username or password");
            return;
        }

        // PERSIST ROLE FOR SYNC
        sessionStorage.setItem("active_role", "admin");
        sessionStorage.setItem("active_user", username);
        sessionStorage.setItem("is_logged_in", "true");

        document.getElementById("monitor-portal").style.display = "block";
        document.getElementById("driver-portal").style.display = "none";

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("app-container").style.display = "block";

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

function changeRole() {
    const roleBadge = document.getElementById("role-badge");
    roleBadge.innerHTML = "";
    roleBadge.style.display = "none";

    currentRole = null;
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
        showCustomAlert(message);
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


// Toggle bus card details
function selectBusCard(busId) {
    // First, change the active bus
    changeBus(busId);

    // Toggle details panel
    const allPanels = document.querySelectorAll('.bus-details-panel');
    const targetPanel = document.getElementById(`details-${busId}`);

    // Close all other panels
    allPanels.forEach(panel => {
        if (panel.id !== `details-${busId}`) {
            panel.style.display = 'none';
        }
    });

    // Toggle current panel
    if (targetPanel) {
        if (targetPanel.style.display === 'none') {
            targetPanel.style.display = 'block';
            targetPanel.parentElement.classList.add('expanded');
        } else {
            targetPanel.style.display = 'none';
            targetPanel.parentElement.classList.remove('expanded');
        }
    }
}

// Get driver name for bus
function getDriverInfo(busId) {
    const info = {
        'bus01': { name: 'Rajesh Patil', contact: '+91 98765 43210', students: 28 },
        'bus02': { name: 'Suresh Kumar', contact: '+91 98765 43211', students: 32 },
        'bus03': { name: 'Anita Desai', contact: '+91 98765 43212', students: 25 },
        'bus04': { name: 'Vikram Singh', contact: '+91 98765 43213', students: 30 },
        'bus05': { name: 'Meena Iyer', contact: '+91 98765 43214', students: 27 },
        'bus06': { name: 'Rohan Mehta', contact: '+91 98765 43215', students: 29 }
    };
    return info[busId] || { name: 'Not Assigned', contact: '--', students: 0 };
}

function getDriverName(busId) {
    return getDriverInfo(busId).name;
}

// --- 2. TOMTOM SEARCH API & ROUTING ---

// Known locations with EXACT coordinates as specified
const KNOWN_LOCATIONS = {
    // Shree L.R. Tiwari College of Engineering - EXACT COORDINATES
    'shree l.r. tiwari college of engineering': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'shree l.r. tiwari college': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'l.r. tiwari college': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'lr tiwari college': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'tiwari college': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'l r tiwari': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'i.r. tiwari college of engg': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'i.r. tiwari college': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    'ir tiwari': { lat: 19.282, lng: 72.855, name: 'Shree L.R. Tiwari College of Engineering' },
    // Mira Road Railway Station - EXACT COORDINATES
    'mira road station': { lat: 19.281, lng: 72.855, name: 'Mira Road Railway Station' },
    'mira road railway station': { lat: 19.281, lng: 72.855, name: 'Mira Road Railway Station' },
    'mira road': { lat: 19.281, lng: 72.855, name: 'Mira Road Railway Station' },
    'mira road rly station': { lat: 19.281, lng: 72.855, name: 'Mira Road Railway Station' }
};



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
    activeBusID = busId;

    // Clear current map state before switching
    if (currentMarker) currentMarker.remove();
    if (destinationMarker) destinationMarker.remove();
    if (map && map.getLayer("route")) map.removeLayer("route");
    if (map && map.getSource("route")) map.removeSource("route");

    // Update text UI
    const busTitle = document.getElementById("m-bus-id");
    if (busTitle) {
        busTitle.innerText = "VEHICLE: " + busId.toUpperCase();
    }

    // Trigger immediate sync and map refresh
    syncData(true); // true to fit bounds
}

function updateParentPanel(busId) {
    const fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
    const d = fleet[busId];
    if (!d) return;

    const fromText = document.getElementById("m-from");
    const toText = document.getElementById("m-to");
    const etaText = document.getElementById("m-eta");
    const busLabel = document.getElementById("m-bus-id");

    if (busLabel) busLabel.innerText = busId.toUpperCase();
    if (fromText) fromText.innerText = d.from || "--";
    if (toText) toText.innerText = d.to || "--";
    if (etaText) etaText.innerText = d.eta ? d.eta + " mins" : "--";
}

// Reset bus
function showResetConfirm(busId) {
    isUserInteracting = true;
    isResetting = true;
    lastUserActionTime = Date.now();

    if (confirm(`Reset bus ${formatBusID(busId)}?`)) {
        let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        // Reset ALL data for this bus
        fleet[busId] = { active: false, from: null, to: null, eta: null, currentCoords: null, destinationCoords: null, routeGeo: null };
        localStorage.setItem("fleet_data", JSON.stringify(fleet));

        // Clear local state
        if (liveBusState[busId]) {
            liveBusState[busId] = { active: false };
        }

        // If it's the current active bus, clear map
        if (busId === activeBusID) {
            if (currentMarker) currentMarker.remove();
            if (destinationMarker) destinationMarker.remove();
            if (map && map.getLayer("route")) map.removeLayer("route");
            if (map && map.getSource("route")) map.removeSource("route");
            currentCoords = null;
            destinationCoords = null;
        }

        showToast(`Bus ${formatBusID(busId)} reset`);
        syncData();
    }

    setTimeout(() => {
        isResetting = false;
        isUserInteracting = false;
    }, 500);
}

// Removed redundant resetBus and closeConfirmModal placeholders


// Sync data
function syncData(shouldFitBounds = false) {
    if (isResetting) return;
    const role = sessionStorage.getItem("active_role") || localStorage.getItem("saved_user_role");
    if (role === 'driver' && isUserInteracting && (Date.now() - lastUserActionTime) < INTERACTION_COOLDOWN) return;

    const fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};

    // Sync all bus states to liveBusState for UI consistency
    Object.keys(fleet).forEach(busId => {
        if (!liveBusState[busId]) liveBusState[busId] = {};
        liveBusState[busId] = { ...liveBusState[busId], ...fleet[busId] };
    });

    // Update active buses count in header
    const activeCount = Object.values(fleet).filter(b => b.active).length;
    const countEl = document.getElementById('active-buses-count');
    if (countEl) countEl.innerText = activeCount;

    // Refresh fleet list UI
    filterBusForUser(role === "admin" ? "all" : activeBusID);

    // Update active bus data
    if (!fleet[activeBusID]) return;
    const d = fleet[activeBusID];

    // Update Dashboard Data based on role
    if (role === 'driver') {
        const dEtaText = document.getElementById('d-eta-text');
        const dEtaBox = document.getElementById('driver-eta-box');
        const dBusId = document.getElementById('d-bus-id');

        if (d && d.active) {
            if (dEtaText) dEtaText.innerText = d.eta || "--";
            if (dEtaBox) dEtaBox.style.display = 'block';
            if (dBusId) dBusId.innerText = activeBusID.toUpperCase();
        }
    } else {
        updateParentPanel(activeBusID);
    }

    // Update Map UI if route data exists
    if (d.currentCoords && d.destinationCoords && map) {
        renderSyncRoute(d, shouldFitBounds);
    }
}

function renderSyncRoute(d, shouldFitBounds = false) {
    if (!map) return;

    // Update Markers
    if (currentMarker) currentMarker.remove();
    currentMarker = new tt.Marker({ color: '#2563eb' })
        .setLngLat(d.currentCoords)
        .addTo(map)
        .setPopup(new tt.Popup({ offset: 35 }).setHTML(`<strong>Current Location</strong><br>${d.from}`));

    if (destinationMarker) destinationMarker.remove();
    destinationMarker = new tt.Marker({ color: '#ef4444' })
        .setLngLat(d.destinationCoords)
        .addTo(map)
        .setPopup(new tt.Popup({ offset: 35 }).setHTML(`<strong>Destination</strong><br>${d.to}`));

    // Update Polyline
    if (d.routeGeo) {
        if (map.getLayer("route")) map.removeLayer("route");
        if (map.getSource("route")) map.removeSource("route");

        map.addSource("route", { type: "geojson", data: d.routeGeo });
        map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": "#2563eb",
                "line-width": 5,
                "line-opacity": 0.85,
                "line-blur": 0.5
            }
        });

        if (shouldFitBounds) {
            const bounds = new tt.LngLatBounds();
            d.routeGeo.geometry.coordinates.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 100, duration: 1000 });
        }
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

        // Start background sync every 5 seconds
        if (!window.syncInterval) {
            window.syncInterval = setInterval(() => {
                syncData();
            }, 5000);
        }
    });

    window.addEventListener('resize', () => {
        if (map) {
            map.resize();
        }
    });
}

// Removed redundant loadAdminBuses




function getUserLocation() {
    showToast("GPS location feature coming soon!");
}

function publishTrip() {
    isUserInteracting = true;
    lastUserActionTime = Date.now();

    let f = JSON.parse(localStorage.getItem("fleet_data")) || {};
    if (!f[activeBusID]) f[activeBusID] = {};

    f[activeBusID].active = true;
    localStorage.setItem("fleet_data", JSON.stringify(f));

    // Update local state immediately
    if (!liveBusState[activeBusID]) liveBusState[activeBusID] = {};
    liveBusState[activeBusID].active = true;

    showToast(`Bus ${formatBusID(activeBusID)} is LIVE!`);

    // Refresh all UI components immediately
    syncData();

    setTimeout(() => {
        isUserInteracting = false;
    }, 1000);
}

function mapZoomIn() {
    if (map) {
        map.setZoom(map.getZoom() + 1);
    }
}

function mapZoomOut() {
    if (map) {
        map.setZoom(map.getZoom() - 1);
    }
}

function mapFitAll() {
    if (map) {
        const fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        const d = fleet[activeBusID];
        if (d && d.routeGeo) {
            const bounds = new tt.LngLatBounds();
            d.routeGeo.geometry.coordinates.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 100, duration: 1000 });
        } else {
            map.setView([72.8557, 19.2813], 14);
        }
    }
}

// Removed redundant loadAdminBuses


function filterBusForUser(busId) {
    const fleetContainer = document.querySelector(".fleet-list");
    if (!fleetContainer) return;

    const role = sessionStorage.getItem("active_role") || localStorage.getItem("saved_user_role");
    const buses = ["bus01", "bus02", "bus03", "bus04", "bus05", "bus06"];

    fleetContainer.innerHTML = "";

    // Show only assigned bus for Parent/Driver, or all for Admin
    const targetBuses = (role === "admin") ? buses : [activeBusID];

    targetBuses.forEach(bus => {
        const data = liveBusState[bus] || {};
        const status = data.active ? "LIVE" : "OFFLINE";
        const statusClass = data.active ? "live" : "offline";
        const display = bus.replace("bus", "B-").toUpperCase();
        const dInfo = getDriverInfo(bus);

        const card = document.createElement("div");
        card.className = "admin-bus-card";
        if (bus === activeBusID) card.classList.add("active");

        if (role === "parent") {
            // Parent: Simplified card, NO RESET BUTTON
            card.innerHTML = `
                <div class="bus-card-header">
                    <div class="bus-id-badge">${display}</div>
                    <div class="status-badge ${statusClass}">${status}</div>
                </div>
                <div class="bus-card-details">
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${status}</span>
                    </div>
                </div>
            `;
        } else if (role === "driver") {
            // Driver: Minimal card with Reset
            card.innerHTML = `
                <div class="bus-card-header">
                    <div class="bus-id-badge">${display}</div>
                    <div class="status-badge ${statusClass}">${status}</div>
                </div>
                <div class="bus-card-details">
                    <button class="reset-bus-btn" onclick="event.stopPropagation(); resetBus('${bus}')">
                        Reset Bus
                    </button>
                </div>
            `;
        } else {
            // Admin: Detailed card with Reset, expansion on click
            const isSelected = bus === activeBusID;
            card.innerHTML = `
                <div class="bus-card-header">
                    <div class="bus-id-badge">${display}</div>
                    <div class="status-badge ${statusClass}">${status}</div>
                </div>
                <div id="details-${bus}" class="bus-card-details" style="display: ${isSelected ? 'block' : 'none'};">
                    <div class="detail-row">
                        <span class="detail-label">From</span>
                        <span class="detail-value text-truncate">${data.from || "--"}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">To</span>
                        <span class="detail-value text-truncate">${data.to || "--"}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">ETA</span>
                        <span class="detail-value">${data.eta ? data.eta + " mins" : "--"}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Driver</span>
                        <span class="detail-value">${dInfo.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Contact</span>
                        <span class="detail-value">${dInfo.contact}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Students</span>
                        <span class="detail-value">${dInfo.students}</span>
                    </div>
                    <button class="reset-bus-btn" onclick="event.stopPropagation(); resetBus('${bus}')">
                        Reset Bus
                    </button>
                </div>
            `;

            card.onclick = () => {
                const details = document.getElementById(`details-${bus}`);
                const alreadyOpen = details.style.display === "block";

                if (!alreadyOpen) {
                    document.querySelectorAll('.bus-card-details').forEach(el => el.style.display = 'none');
                    details.style.display = "block";
                    changeBus(bus);
                } else {
                    details.style.display = "none";
                }
            };
        }

        fleetContainer.appendChild(card);
    });
}

let currentCoords = null;
let destinationCoords = null;
let currentMarker = null;
let destinationMarker = null;

// ===============================
// QUERY NORMALIZATION & AUTO-CORRECTION
// ===============================

function normalizeQuery(query) {
    if (!query) return "";
    
    // Trim and lowercase
    let normalized = query.trim().toLowerCase();

    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ');

    // Precise Mumbai station & area mapping
    const stationMappings = {
        'thane': 'Thane Railway Station',
        'borivali': 'Borivali Railway Station',
        'mira road': 'Mira Road Railway Station',
        'andheri': 'Andheri Railway Station',
        'dadar': 'Dadar Railway Station',
        'bandra': 'Bandra Railway Station',
        'malad': 'Malad Railway Station',
        'kandivali': 'Kandivali Railway Station',
        'dahisar': 'Dahisar Railway Station',
        'bhayandar': 'Bhayandar Railway Station'
    };

    // Replace shorthand
    normalized = normalized.replace(/\bstn\b/g, 'station');
    normalized = normalized.replace(/\brly\b/g, 'railway');

    // Apply strict station mapping if found
    Object.keys(stationMappings).forEach(key => {
        if (normalized.includes(key) && !normalized.includes('railway')) {
            normalized = normalized.replace(key, stationMappings[key]);
        }
    });

    // Handle East/West strictly
    const hasEast = normalized.includes('east');
    const hasWest = normalized.includes('west');

    // Build MMR Context intelligently
    let context = "Maharashtra, India";
    if (normalized.includes('mira') || normalized.includes('bhayandar')) {
        context = "Mira Bhayandar, " + context;
    } else if (normalized.includes('thane')) {
        context = "Thane, " + context;
    } else {
        context = "Mumbai, " + context;
    }

    if (!normalized.includes('India')) {
        normalized = `${normalized}, ${context}`;
    }

    // Capitalize for professional display
    normalized = normalized.replace(/\b\w/g, char => char.toUpperCase());

    console.log('Final Search Query:', normalized);
    return normalized;
}

// ===============================
// SEARCH LOCATION (TomTom Fuzzy Search)
// ===============================

async function searchAndMove(type) {
    console.log('\n========== SEARCH START ==========');
    
    isUserInteracting = true;
    lastUserActionTime = Date.now();

    if (!map) {
        showCustomAlert('Map not loaded. Please refresh the page.');
        isUserInteracting = false;
        return;
    }

    const inputId = type === 'current' ? 'search-src' : 'search-dest';
    const inputEl = document.getElementById(inputId);

    if (!inputEl) {
        isUserInteracting = false;
        return;
    }

    let rawQuery = inputEl.value;
    if (!rawQuery || rawQuery.trim() === '') {
        showCustomAlert('Please enter a location');
        isUserInteracting = false;
        return;
    }

    const normalizedQuery = normalizeQuery(rawQuery);
    const queryLower = rawQuery.toLowerCase();

    try {
        const baseUrl = 'https://api.tomtom.com/search/2/search';
        const encodedQuery = encodeURIComponent(normalizedQuery);
        
        // Extended limit to 20 for better selection among POI/Addr/Geo
        const url = `${baseUrl}/${encodedQuery}.json?key=${TOMTOM_KEY}&limit=20&idxSet=POI,Geo,Addr,PAD&countrySet=IN&lat=19.2813&lon=72.8557&radius=50000`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Strict Regional Filter
        const mmrResults = data.results.filter(r => {
            const addr = (r.address?.freeformAddress || "").toLowerCase();
            return addr.includes("mumbai") || addr.includes("maharashtra") || addr.includes("thane") || addr.includes("mira bhayandar");
        });

        const finalResults = mmrResults.length > 0 ? mmrResults : data.results;

        if (finalResults.length === 0) {
            showCustomAlert(`Location not found: "${rawQuery}". Try adding "East" or "West".`);
            isUserInteracting = false;
            return;
        }

        // Advanced Selection Logic (Station side match)
        let bestResult = finalResults[0];
        let maxScore = -1;

        const isStationQuery = queryLower.includes('station') || queryLower.includes('stn') || queryLower.includes('rly');
        const isEast = queryLower.includes('east');
        const isWest = queryLower.includes('west');

        finalResults.forEach(result => {
            let score = 0;
            const addr = (result.address?.freeformAddress || "").toLowerCase();
            const poiName = (result.poi?.name || "").toLowerCase();
            const combined = `${poiName} ${addr}`;

            // 1. Keyword match (Base Score)
            if (combined.includes(queryLower)) score += 50;

            // 2. Station Type Match (High Priority)
            if (result.type === 'POI') {
                score += 20;
                if (combined.includes('railway station')) score += 40;
            }

            // 3. Strict Directional Match (East/West)
            if (isEast && combined.includes('east')) score += 60;
            if (isWest && combined.includes('west')) score += 60;

            // 4. Exact Station Side Match (The "Holy Grail" match)
            if (isStationQuery && isEast && combined.includes('railway station') && combined.includes('east')) score += 100;
            if (isStationQuery && isWest && combined.includes('railway station') && combined.includes('west')) score += 100;

            if (score > maxScore) {
                maxScore = score;
                bestResult = result;
            }
        });

        // Final Confidence Check
        if (maxScore < 20 && !bestResult.address?.freeformAddress?.toLowerCase().includes("mumbai")) {
             showCustomAlert("Low confidence match. Please provide a more specific location.");
             isUserInteracting = false;
             return;
        }

        const coords = [bestResult.position.lon, bestResult.position.lat];
        const displayName = bestResult.address?.freeformAddress || normalizedQuery;

        if (type === 'current') {
            if (currentMarker) currentMarker.remove();
            currentCoords = coords;
            currentMarker = new tt.Marker({ color: '#2563eb' })
                .setLngLat(coords)
                .addTo(map)
                .setPopup(new tt.Popup({ offset: 35 }).setHTML(`<strong>Start Point:</strong><br>${displayName}`));
        } else {
            if (destinationMarker) destinationMarker.remove();
            destinationCoords = coords;
            destinationMarker = new tt.Marker({ color: '#ef4444' })
                .setLngLat(coords)
                .addTo(map)
                .setPopup(new tt.Popup({ offset: 35 }).setHTML(`<strong>Destination:</strong><br>${displayName}`));
        }

        // Local Persistence
        let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        if (!fleet[currentBus]) fleet[currentBus] = {};
        
        if (type === 'current') {
            fleet[currentBus].from = displayName;
            fleet[currentBus].currentCoords = coords;
        } else {
            fleet[currentBus].to = displayName;
            fleet[currentBus].destinationCoords = coords;
        }
        localStorage.setItem("fleet_data", JSON.stringify(fleet));

        // Refined Map Focusing
        if (currentCoords && destinationCoords) {
            const bounds = new tt.LngLatBounds();
            bounds.extend(currentCoords);
            bounds.extend(destinationCoords);
            map.fitBounds(bounds, { padding: 100, duration: 1500 });
        } else {
            // High zoom (16) for specific station/point searches
            map.flyTo({ center: coords, zoom: 16, duration: 1500 });
        }

    } catch (error) {
        console.error('Search Accuracy Error:', error);
        showCustomAlert("Search failed. Please enter a more complete address.");
    } finally {
        isUserInteracting = false;
    }
}

// ===============================
// DRAW ROUTE (TomTom Routing API)
// ===============================

async function drawRoute() {
    console.log('\n========== ROUTE DRAW START ==========');

    // Validate map instance
    if (!map) {
        console.error('ERROR: Map instance is undefined');
        showCustomAlert('Map not loaded. Please refresh the page.');
        return;
    }

    // Validate coordinates
    if (!currentCoords || !destinationCoords) {
        console.log('WARNING: Missing coordinates');
        console.log('Current coords:', currentCoords);
        console.log('Destination coords:', destinationCoords);
        console.log('Waiting for both locations...');
        return;
    }

    console.log('Current coords:', currentCoords);
    console.log('Destination coords:', destinationCoords);

    // Validate coordinate format [lon, lat]
    if (!Array.isArray(currentCoords) || currentCoords.length !== 2) {
        console.error('ERROR: Invalid currentCoords format', currentCoords);
        showCustomAlert('Invalid current location data');
        return;
    }

    if (!Array.isArray(destinationCoords) || destinationCoords.length !== 2) {
        console.error('ERROR: Invalid destinationCoords format', destinationCoords);
        showCustomAlert('Invalid destination location data');
        return;
    }

    try {
        // TomTom Routing API - format: lat,lon:lat,lon
        const currentLat = currentCoords[1];
        const currentLon = currentCoords[0];
        const destLat = destinationCoords[1];
        const destLon = destinationCoords[0];

        console.log('Route coordinates:', {
            from: { lat: currentLat, lon: currentLon },
            to: { lat: destLat, lon: destLon }
        });

        const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${currentLat},${currentLon}:${destLat},${destLon}/json?key=${TOMTOM_KEY}&travelMode=car&traffic=true`;

        console.log('Route request URL:', routeUrl);
        console.log('Sending route request...');

        const response = await fetch(routeUrl);

        console.log('Route response status:', response.status);
        console.log('Route response OK:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Raw route API response:', JSON.stringify(data, null, 2));

        if (!data.routes || data.routes.length === 0) {
            console.log('WARNING: No routes found');
            showCustomAlert('Route not found. Please select different locations.');
            return;
        }

        const route = data.routes[0];
        const summary = route.summary;

        console.log('Route summary:', {
            travelTime: summary.travelTimeInSeconds + 's',
            distance: summary.lengthInMeters + 'm',
            eta: Math.ceil(summary.travelTimeInSeconds / 60) + 'mins'
        });

        // Extract route coordinates
        const routeCoords = route.legs[0].points.map(p => [p.longitude, p.latitude]);

        console.log('Route points count:', routeCoords.length);
        console.log('First point:', routeCoords[0]);
        console.log('Last point:', routeCoords[routeCoords.length - 1]);

        // Create GeoJSON
        const geojson = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: routeCoords
            }
        };

        console.log('GeoJSON created successfully');

        // Remove existing route layer and source (clear stale state)
        console.log('Removing old route layer/source if exists...');

        if (map.getLayer("route")) {
            console.log('Removing old route layer');
            map.removeLayer("route");
        } else {
            console.log('No existing route layer found');
        }

        if (map.getSource("route")) {
            console.log('Removing old route source');
            map.removeSource("route");
        } else {
            console.log('No existing route source found');
        }

        // Add route source
        console.log('Adding new route source...');
        map.addSource("route", {
            type: "geojson",
            data: geojson
        });
        console.log('Route source added');

        // Add route layer with gradient effect
        console.log('Adding new route layer...');
        map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": "#2563eb",
                "line-width": 5,
                "line-opacity": 0.85,
                "line-blur": 0.5
            }
        });
        console.log('Route layer added');

        // Fit map to route bounds with padding
        console.log('Calculating route bounds...');
        const bounds = new tt.LngLatBounds();
        routeCoords.forEach(coord => {
            bounds.extend(coord);
        });

        console.log('Route bounds:', bounds);
        console.log('Fitting map to bounds...');

        map.fitBounds(bounds, {
            padding: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100
            },
            duration: 1500,
            maxZoom: 14
        });

        // Update live bus state and PERSIST for sync
        let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        if (!fleet[currentBus]) fleet[currentBus] = {};

        fleet[currentBus].active = true;
        fleet[currentBus].routeGeo = geojson;
        fleet[currentBus].eta = Math.ceil(summary.travelTimeInSeconds / 60);
        fleet[currentBus].distance = (summary.lengthInMeters / 1000).toFixed(1);

        localStorage.setItem("fleet_data", JSON.stringify(fleet));

        // Update UI panels
        updateParentPanel(currentBus);
        const activeRole = sessionStorage.getItem("active_role") || localStorage.getItem("saved_user_role");
        filterBusForUser(activeRole === "admin" ? "all" : currentBus);

        console.log('========== ROUTE DRAW COMPLETE ==========\n');
    } catch (err) {
        console.error('ROUTE DRAW ERROR:', err.message);
        showCustomAlert(`Sync failed: ${err.message}`);
    }
}

// ===============================
// CLEAR ROUTE AND MARKERS
// ===============================

function clearRouteAndMarkers() {
    // Clear markers
    if (currentMarker) {
        currentMarker.remove();
        currentMarker = null;
    }

    if (destinationMarker) {
        destinationMarker.remove();
        destinationMarker = null;
    }

    // Clear route
    if (map.getLayer("route")) {
        map.removeLayer("route");
    }

    if (map.getSource("route")) {
        map.removeSource("route");
    }

    // Reset coordinates
    currentCoords = null;
    destinationCoords = null;
}

// EXPORT ALL FUNCTIONS TO GLOBAL SCOPE
// REQUIRED for inline onclick handlers
// ============================================
window.selectRole = selectRole;
window.processLogin = processLogin;
window.togglePasswordVisibility = togglePasswordVisibility;
window.resetLogin = resetLogin;
window.logout = logout;
window.changeRole = changeRole;
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
console.log('✅ selectRole:', typeof window.selectRole);
console.log('✅ Login system ready!');

// Custom Alert Functions
function showCustomAlert(message) {
    const alertBox = document.getElementById("custom-alert");
    const msg = document.getElementById("custom-alert-message");
    msg.innerText = message;
    alertBox.classList.remove("hidden");
}

function closeCustomAlert() {
    document.getElementById("custom-alert").classList.add("hidden");
}

function resetBus(busId) {
    const role = sessionStorage.getItem("active_role") || currentRole;

    if (role === "parent") {
        showCustomAlert("Parents do not have permission to reset buses.");
        return;
    }

    if (role !== "admin" && activeBusID !== busId) {
        return;
    }

    // Reset bus state
    liveBusState[busId] = {
        active: false,
        current: null,
        destination: null,
        eta: null,
        routeGeo: null
    };

    // Update LocalStorage
    let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
    fleet[busId] = { active: false };
    localStorage.setItem("fleet_data", JSON.stringify(fleet));

    // Clear route and markers for this bus
    if (busId === activeBusID) {
        clearRouteAndMarkers();
    }

    // Update UI
    filterBusForUser(role === "admin" ? "all" : activeBusID);
    updateParentPanel(busId);

    showCustomAlert(busId.toUpperCase() + " reset successfully");
}

// Initialize on load
window.onload = () => {
    initializeFleetData();

    const savedRole = localStorage.getItem("saved_user_role");
    const isLoggedInSession = sessionStorage.getItem("is_logged_in");

    if (isLoggedInSession === "true" || savedRole) {
        launchDashboard();
    }

    // Add Enter key support for search inputs
    const searchSrc = document.getElementById("search-src");
    if (searchSrc) {
        searchSrc.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                searchAndMove("current");
            }
        });
    }

    const searchDest = document.getElementById("search-dest");
    if (searchDest) {
        searchDest.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                searchAndMove("destination");
            }
        });
    }

    // Sidebar Resize Implementation
    const sidebar = document.querySelector('.pro-sidebar');
    const resizeHandle = document.getElementById('sidebar-resize');
    let isResizing = false;

    if (resizeHandle && sidebar) {
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.classList.add('resizing');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 300 && newWidth <= 600) {
                sidebar.style.width = newWidth + 'px';
                if (map) map.resize();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.classList.remove('resizing');
                if (map) map.resize();
            }
        });
    }
};
