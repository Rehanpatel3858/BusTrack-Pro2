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
        password: "admin123"
    },
    drivers: {
        driver01: "driver123",
        driver02: "driver123",
        driver03: "driver123",
        driver04: "driver123",
        driver05: "driver123",
        driver06: "driver123"
    },
    parents: {
        student01: "student123",
        student02: "student123",
        student03: "student123",
        student04: "student123",
        student05: "student123",
        student06: "student123"
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

function processLogin() {
    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        showCustomAlert("Enter login details");
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
            showCustomAlert("Invalid driver ID");
            return;
        }

        if (authUsers.drivers[username] !== password) {
            showCustomAlert("Wrong password");
            return;
        }

        const assignedBus = driverBusMap[username];
        currentBus = assignedBus;

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
            showCustomAlert("Invalid student ID");
            return;
        }

        if (authUsers.parents[username] !== password) {
            showCustomAlert("Wrong password");
            return;
        }

        const assignedBus = parentBusMap[username];
        currentBus = assignedBus;

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
            showCustomAlert("Invalid admin ID");
            return;
        }

        if (password !== authUsers.admin.password) {
            showCustomAlert("Wrong password");
            return;
        }

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
    const busLabel = document.getElementById("m-bus-id");

    if (busLabel) {
        busLabel.innerText = busId.toUpperCase();
    }

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

                ${currentRole !== "parent" ? `
                <button class="reset-bus-btn" onclick="resetBus('${bus}')">
                    Reset Bus
                </button>
                ` : ""}
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
let currentMarker = null;
let destinationMarker = null;

// ===============================
// SEARCH LOCATION (TomTom Fuzzy Search)
// ===============================

async function searchAndMove(type) {
    console.log("SEARCH RUNNING:", type);
    
    const inputId = type === "current" ? "search-src" : "search-dest";
    const inputEl = document.getElementById(inputId);
    
    if (!inputEl) {
        console.error("Input element not found:", inputId);
        return;
    }
    
    let query = inputEl.value.trim();

    if (!query) {
        showCustomAlert("Enter location");
        return;
    }

    // Add India context for better accuracy
    if (!query.toLowerCase().includes("india") && 
        !query.toLowerCase().includes("mumbai") &&
        !query.toLowerCase().includes("maharashtra")) {
        query += ", Mumbai, Maharashtra, India";
    }

    try {
        // Use TomTom Fuzzy Search API
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&limit=5&idxSet=POI,Geo&countrySet=IN&language=en-IN`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            showCustomAlert("Location not found. Try a different search term.");
            return;
        }

        // Smart result selection - prioritize exact matches
        let bestResult = data.results[0];
        
        // If searching for station, prioritize results with "station" in name
        if (query.toLowerCase().includes("station")) {
            for (const result of data.results) {
                const poiName = (result.poi?.name || "").toLowerCase();
                const address = (result.address?.freeformAddress || "").toLowerCase();
                
                if (poiName.includes("station") || address.includes("station")) {
                    bestResult = result;
                    break;
                }
            }
        }

        const coords = [bestResult.position.lon, bestResult.position.lat];
        const displayName = bestResult.address?.freeformAddress || query;

        // Update coordinates
        if (type === "current") {
            currentCoords = coords;
            
            // Update live bus state
            if (liveBusState[currentBus]) {
                liveBusState[currentBus].current = {
                    name: displayName,
                    coords: coords
                };
            }

            // Remove old marker
            if (currentMarker) {
                currentMarker.remove();
            }

            // Add new marker
            currentMarker = new tt.Marker({
                color: "#2563eb",
                draggable: false
            })
            .setLngLat(coords)
            .addTo(map)
            .setPopup(new tt.Popup({ offset: 35 })
                .setHTML(`<strong>Current Location</strong><br>${displayName}`));

        } else {
            destinationCoords = coords;
            
            // Update live bus state
            if (liveBusState[currentBus]) {
                liveBusState[currentBus].destination = {
                    name: displayName,
                    coords: coords
                };
            }

            // Remove old marker
            if (destinationMarker) {
                destinationMarker.remove();
            }

            // Add new marker
            destinationMarker = new tt.Marker({
                color: "#ef4444",
                draggable: false
            })
            .setLngLat(coords)
            .addTo(map)
            .setPopup(new tt.Popup({ offset: 35 })
                .setHTML(`<strong>Destination</strong><br>${displayName}`));
        }

        // Smooth map movement to new location
        map.flyTo({
            center: coords,
            zoom: 15,
            duration: 1500,
            essential: true
        });

        // Draw route if both locations are set
        if (currentCoords && destinationCoords) {
            setTimeout(() => drawRoute(), 500);
        }

    } catch(error) {
        console.error("Search error:", error);
        showCustomAlert("Search failed. Please try again.");
    }
}

// ===============================
// DRAW ROUTE (TomTom Routing API)
// ===============================

async function drawRoute() {
    if (!currentCoords || !destinationCoords) {
        console.log("Waiting for both locations...");
        return;
    }

    try {
        // TomTom Routing API - format: lat,lon:lat,lon
        const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${currentCoords[1]},${currentCoords[0]}:${destinationCoords[1]},${destinationCoords[0]}/json?key=${TOMTOM_KEY}&travelMode=car&traffic=true`;
        
        const response = await fetch(routeUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            showCustomAlert("Route not found. Please select different locations.");
            return;
        }

        const route = data.routes[0];
        const summary = route.summary;
        
        // Extract route coordinates
        const routeCoords = route.legs[0].points.map(p => [p.longitude, p.latitude]);

        // Create GeoJSON
        const geojson = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: routeCoords
            }
        };

        // Remove existing route layer and source
        if (map.getLayer("route")) {
            map.removeLayer("route");
        }

        if (map.getSource("route")) {
            map.removeSource("route");
        }

        // Add route source
        map.addSource("route", {
            type: "geojson",
            data: geojson
        });

        // Add route layer with gradient effect
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
                "line-width": 8,
                "line-opacity": 0.9
            }
        });

        // Fit map to route bounds with padding
        const bounds = new tt.LngLatBounds();
        routeCoords.forEach(coord => {
            bounds.extend(coord);
        });

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

        // Update live bus state
        if (liveBusState[currentBus]) {
            liveBusState[currentBus].active = true;
            liveBusState[currentBus].routeGeo = geojson;
            liveBusState[currentBus].eta = Math.ceil(summary.travelTimeInSeconds / 60);
            liveBusState[currentBus].distance = (summary.lengthInMeters / 1000).toFixed(1);
        }

        // Update UI panels
        updateParentPanel(currentBus);
        filterBusForUser(currentRole === "admin" ? "all" : currentBus);

        console.log("Route drawn successfully. ETA:", liveBusState[currentBus]?.eta, "mins");

    } catch(err) {
        console.error("Route error:", err);
        showCustomAlert("Route generation failed. Please try again.");
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
    if (currentRole !== "admin" && currentBus !== busId) {
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

    // Clear route and markers for this bus
    if (busId === currentBus) {
        clearRouteAndMarkers();
    }

    // Update UI
    filterBusForUser(currentRole === "admin" ? "all" : currentBus);
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
        searchSrc.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                searchAndMove("current");
            }
        });
    }
    
    const searchDest = document.getElementById("search-dest");
    if (searchDest) {
        searchDest.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                searchAndMove("destination");
            }
        });
    }
};
