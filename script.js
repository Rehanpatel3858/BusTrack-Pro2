const TOMTOM_KEY = 'RlUjrRnVgicCym6rNTEWTDxJa7URNexi';
let map, busMarker, destMarker, routeLayer;
let activeBusID = "bus01";
let startCoords = null;
let endCoords = null;

// --- NOTIFICATION SYSTEM ---
let notifications = [];
let unreadCount = 0;
let journeySimulationInterval = null;

// --- CENTRALIZED STATE MANAGEMENT (Single Source of Truth) ---
const AppState = {
    currentUser: null,
    userRole: null,
    assignedBusId: null,  // For parents: their assigned bus; for drivers: their bus; for admin: null (all)
    activeBusId: 'bus01',  // Currently selected bus in UI
    fleetData: {},
    journeyState: {},
    
    // Initialize state from localStorage/sessionStorage
    init() {
        this.currentUser = sessionStorage.getItem('active_user') || localStorage.getItem('active_user');
        this.userRole = sessionStorage.getItem('active_role') || localStorage.getItem('saved_user_role');
        this.assignedBusId = this.getUserAssignedBus();
        this.activeBusId = sessionStorage.getItem('active_bus') || 'bus01';
        this.fleetData = JSON.parse(localStorage.getItem('fleet_data') || '{}');
        this.journeyState = JSON.parse(localStorage.getItem('journey_state') || '{}');
        
        console.log('AppState initialized:', {
            user: this.currentUser,
            role: this.userRole,
            assignedBus: this.assignedBusId,
            activeBus: this.activeBusId
        });
    },
    
    // Get user's assigned bus from USERS config
    getUserAssignedBus() {
        if (!this.currentUser || !USERS[this.currentUser]) return null;
        return USERS[this.currentUser].busId || null;
    },
    
    // Check if user should see a specific bus
    canViewBus(busId) {
        // Admin can see all buses
        if (this.userRole === 'admin') return true;
        // Driver can only see their assigned bus
        if (this.userRole === 'driver') return busId === this.assignedBusId;
        // Parent can only see their assigned bus
        if (this.userRole === 'parent') return busId === this.assignedBusId;
        // Default: allow (fallback)
        return true;
    },
    
    // Check if user should see a notification for a bus
    shouldShowNotification(notificationBusId) {
        // Admin sees all notifications
        if (this.userRole === 'admin') return true;
        // Driver and Parent only see notifications for their assigned bus
        return notificationBusId === this.assignedBusId;
    },
    
    // Update fleet data (single source of truth)
    updateFleetData(busId, updates) {
        if (!this.fleetData[busId]) {
            this.fleetData[busId] = { active: false };
        }
        
        // Merge updates
        this.fleetData[busId] = { ...this.fleetData[busId], ...updates };
        
        // Persist to localStorage
        localStorage.setItem('fleet_data', JSON.stringify(this.fleetData));
        
        console.log(`Fleet data updated for ${busId}:`, this.fleetData[busId]);
    },
    
    // Update journey state
    updateJourneyState(busId, updates) {
        if (!this.journeyState[busId]) {
            this.journeyState[busId] = { status: 'idle' };
        }
        
        this.journeyState[busId] = { ...this.journeyState[busId], ...updates };
        localStorage.setItem('journey_state', JSON.stringify(this.journeyState));
        
        console.log(`Journey state updated for ${busId}:`, this.journeyState[busId]);
    },
    
    // Get bus status (LIVE/OFFLINE)
    getBusStatus(busId) {
        const busData = this.fleetData[busId];
        if (!busData) return 'offline';
        return busData.active ? 'live' : 'offline';
    },
    
    // Sync state from localStorage (for cross-tab updates)
    sync() {
        this.fleetData = JSON.parse(localStorage.getItem('fleet_data') || '{}');
        this.journeyState = JSON.parse(localStorage.getItem('journey_state') || '{}');
    }
};

// --- RESIZABLE SIDEBAR ---
function initResizableSidebar() {
    const sidebar = document.querySelector('.pro-sidebar');
    if (!sidebar) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'sidebar-resize-handle';
    resizeHandle.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        width: 6px;
        height: 100%;
        cursor: col-resize;
        z-index: 100;
        transition: background 0.2s ease;
    `;
    
    sidebar.style.position = 'relative';
    sidebar.appendChild(resizeHandle);
    
    // Hover effect
    sidebar.addEventListener('mouseenter', () => {
        resizeHandle.style.background = 'rgba(59, 130, 246, 0.3)';
    });
    
    sidebar.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.background = 'transparent';
        }
    });
    
    // Mouse down - start resizing
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.pageX;
        startWidth = sidebar.offsetWidth;
        
        // Add resizing class
        sidebar.classList.add('resizing');
        resizeHandle.style.background = 'rgba(59, 130, 246, 0.6)';
        
        // Prevent text selection
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    // Mouse move - resize
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const newWidth = startWidth + (e.pageX - startX);
        const minWidth = 220;
        const maxWidth = 400;
        
        // Constrain width
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        sidebar.style.width = constrainedWidth + 'px';
        
        // Trigger map resize
        if (map) {
            setTimeout(() => {
                map.resize();
            }, 10);
        }
    });
    
    // Mouse up - stop resizing
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            sidebar.classList.remove('resizing');
            resizeHandle.style.background = 'transparent';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Final map resize
            if (map) {
                setTimeout(() => {
                    map.resize();
                }, 100);
            }
        }
    });
    
    console.log('Resizable sidebar initialized');
}

// --- HARDCODED USER CREDENTIALS (Client-side only) ---
const USERS = {
    'admin': { password: 'schooladmin789', role: 'admin', busId: null },
    // Student accounts - each assigned to a specific bus
    'student01': { password: 'pass01', role: 'parent', busId: 'bus01' },
    'student02': { password: 'pass02', role: 'parent', busId: 'bus02' },
    'student03': { password: 'pass03', role: 'parent', busId: 'bus03' },
    'student04': { password: 'pass04', role: 'parent', busId: 'bus04' },
    'student05': { password: 'pass05', role: 'parent', busId: 'bus05' },
    // Legacy parent account (sees all buses)
    'stu1703': { password: '1703', role: 'parent', busId: null },
    // Driver accounts
    'bus01': { password: 'drive123', role: 'driver', busId: 'bus01' },
    'bus02': { password: 'drive123', role: 'driver', busId: 'bus02' },
    'bus03': { password: 'drive123', role: 'driver', busId: 'bus03' },
    'bus04': { password: 'drive123', role: 'driver', busId: 'bus04' },
    'bus05': { password: 'drive123', role: 'driver', busId: 'bus05' },
    'bus06': { password: 'drive123', role: 'driver', busId: 'bus06' }
};

// Initialize fleet data in localStorage if not exists
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

// Cross-tab communication for real-time notifications
window.addEventListener('storage', (e) => {
    if (e.key === 'journey_state' || e.key === 'fleet_data') {
        // State changed in another tab - sync and refresh
        console.log('State updated from another tab:', e.key);
        
        // Sync centralized state
        AppState.sync();
        
        // If journey_state changed, check for new notifications
        if (e.key === 'journey_state') {
            const newState = JSON.parse(e.newValue || '{}');
            const oldState = JSON.parse(e.oldValue || '{}');
            
            // Check for new journey starts (only for user's assigned bus)
            Object.keys(newState).forEach(busId => {
                // Filter: Only show notifications for user's assigned bus
                if (AppState.shouldShowNotification(busId)) {
                    if (!oldState[busId] && newState[busId].status === 'started') {
                        addNotification('🚌', `Bus ${formatBusID(busId)} started journey`, 'info', busId);
                    }
                }
            });
        }
        
        // Refresh UI to reflect changes
        refreshUI();
    }
});

// --- 1. AUTH LOGIC (Pure Client-Side) ---
function setTempRole(role) {
    localStorage.setItem("temp_role", role);
    document.getElementById('role-selection-v3').style.display = 'none';
    document.getElementById('auth-form-v3').style.display = 'block';
}

function processLogin() {
    const role = localStorage.getItem("temp_role");
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        showToast("Please enter both username and password");
        return;
    }
    
    // Client-side authentication against hardcoded users
    const user = USERS[username];
    
    if (user && user.password === password && user.role === role) {
        // Store session info
        if (role !== 'driver') localStorage.setItem("saved_user_role", role);
        sessionStorage.setItem("active_role", role);
        sessionStorage.setItem("active_user", username);
        localStorage.setItem("active_user", username);
        
        // Set active bus ID based on user's assignment
        if (user.busId) {
            activeBusID = user.busId;
        } else {
            activeBusID = "bus01";
        }
        sessionStorage.setItem("active_bus", activeBusID);
        
        // Mark as logged in
        sessionStorage.setItem("is_logged_in", "true");
        
        // Initialize centralized state
        AppState.init();
        
        console.log('User logged in:', {
            username: username,
            role: role,
            assignedBus: user.busId,
            activeBus: activeBusID
        });
        
        showToast("Login successful!");
        launchDashboard();
    } else {
        showToast("Access Denied: Invalid Credentials");
    }
}

// Check if user is logged in
function isLoggedIn() {
    return sessionStorage.getItem("is_logged_in") === "true";
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
    
    // Apply role-specific theme
    applyRoleTheme(role);
    
    // Update live stats for admin
    if (role === 'admin') {
        updateAdminStats();
    }
    
    // Get user's assigned bus if any
    const user = USERS[username];
    const userBusId = user ? user.busId : null;
    
    // Driver-specific view: show only their assigned bus
    if (role === 'driver') {
        renderDriverFleetList(activeBusID);
    } 
    // Parent with assigned bus: show only their child's bus
    else if (role === 'parent' && userBusId) {
        renderParentFleetList(userBusId);
        // Set active bus to parent's assigned bus
        activeBusID = userBusId;
        sessionStorage.setItem("active_bus", userBusId);
    }
    // Admin or parent without specific bus assignment: show all buses
    else {
        renderFullFleetList();
    }
    
    updateChipUI(activeBusID);
    initMap();
    
    // Load route data for active bus after map initializes
    setTimeout(() => {
        loadBusRoute(activeBusID);
    }, 500);
}

// Load bus route from localStorage
function loadBusRoute(busId) {
    const fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
    const busData = fleet[busId];
    
    if (!busData) {
        console.warn('No data for bus:', busId);
        return;
    }
    
    // Restore coordinates with validation
    if (busData.lat && busData.lng && !isNaN(busData.lat) && !isNaN(busData.lng)) {
        startCoords = { 
            lat: busData.lat, 
            lng: busData.lng, 
            name: busData.from || 'Start' 
        };
        console.log('Loaded startCoords:', startCoords);
    } else {
        console.warn('Invalid or missing start coordinates for', busId);
        startCoords = null;
    }
    
    if (busData.dLat && busData.dLng && !isNaN(busData.dLat) && !isNaN(busData.dLng)) {
        endCoords = { 
            lat: busData.dLat, 
            lng: busData.dLng, 
            name: busData.to || 'Destination' 
        };
        console.log('Loaded endCoords:', endCoords);
    } else {
        console.warn('Invalid or missing end coordinates for', busId);
        endCoords = null;
    }
    
    // Update markers and route only if we have valid coordinates
    if (startCoords || endCoords) {
        console.log('Updating markers with valid coordinates');
        updateMarkersAndRoute();
    } else {
        console.warn('No valid coordinates to display for', busId);
    }
    
    syncData();
}

// Apply role-specific theme
function applyRoleTheme(role) {
    const body = document.body;
    const dashboard = document.getElementById('app-container');
    
    // Remove existing theme classes
    body.classList.remove('admin-dashboard', 'driver-dashboard', 'parent-dashboard');
    dashboard.classList.remove('admin-dashboard', 'driver-dashboard', 'parent-dashboard');
    
    // Add new theme class
    body.classList.add(`${role}-dashboard`);
    dashboard.classList.add(`${role}-dashboard`);
}

// Update admin stats
function updateAdminStats() {
    const fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
    let activeCount = 0;
    
    Object.values(fleet).forEach(bus => {
        if (bus.active) activeCount++;
    });
    
    const activeBusesEl = document.getElementById('active-buses-count');
    if (activeBusesEl) {
        activeBusesEl.textContent = activeCount;
    }
}

// Render fleet list for drivers - only show their assigned bus
function renderDriverFleetList(driverBusId) {
    const fleetContainer = document.querySelector('.fleet-list');
    if (!fleetContainer) return;
    
    const busDisplayName = formatBusID(driverBusId);
    
    fleetContainer.innerHTML = `
        <div class="fleet-item driver-assigned">
            <div class="driver-bus-badge">🚌 Your Assigned Vehicle</div>
            <div class="chip active" onclick="changeBus('${driverBusId}')">${busDisplayName}</div>
            <button class="btn-reset-bus" onclick="event.stopPropagation(); showResetConfirm('${driverBusId}')" title="Reset ${busDisplayName}">↺</button>
        </div>
    `;
}

// Render fleet list for parents - only show their child's assigned bus (NO reset button)
function renderParentFleetList(parentBusId) {
    const fleetContainer = document.querySelector('.fleet-list');
    if (!fleetContainer) return;
    
    const busDisplayName = formatBusID(parentBusId);
    
    fleetContainer.innerHTML = `
        <div class="fleet-item parent-assigned">
            <div class="parent-bus-badge">🎒 Your Child's Bus</div>
            <div class="chip active" onclick="changeBus('${parentBusId}')">${busDisplayName}</div>
        </div>
    `;
}

// Render full fleet list for admin/parent
function renderFullFleetList() {
    const fleetContainer = document.querySelector('.fleet-list');
    if (!fleetContainer) return;
    
    // Sync state from localStorage
    AppState.sync();
    
    const buses = ['bus01', 'bus02', 'bus03', 'bus04', 'bus05', 'bus06'];
    let html = '';
    
    buses.forEach((busId) => {
        // ROLE-BASED FILTERING: Only show buses user can view
        if (!AppState.canViewBus(busId)) {
            return; // Skip this bus
        }
        
        const isActive = busId === activeBusID;
        const activeClass = isActive ? 'active' : '';
        
        // Get status from centralized state (single source of truth)
        const statusClass = AppState.getBusStatus(busId);
        const statusText = statusClass === 'live' ? 'LIVE' : 'OFFLINE';
        const busData = AppState.fleetData[busId] || {};
        const etaDisplay = busData.eta ? `<span class="eta-badge">${busData.eta} min</span>` : '';
        
        html += `
            <div class="fleet-item bus-card-minimal ${activeClass}" onclick="selectBusCard('${busId}')">
                <div class="bus-card-main">
                    <div class="bus-id-badge">${formatBusID(busId)}</div>
                    <div class="bus-status-row">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        ${etaDisplay}
                    </div>
                </div>
                <div class="bus-details-panel" id="details-${busId}" style="display:none;">
                    <div class="detail-item">
                        <span class="detail-label">Driver:</span>
                        <span class="detail-value">${getDriverName(busId)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Route:</span>
                        <span class="detail-value">${busData.from && busData.to ? `${busData.from} → ${busData.to}` : 'Not set'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Speed:</span>
                        <span class="detail-value">${statusClass === 'live' ? '45 km/h' : '0 km/h'}</span>
                    </div>
                    <button class="btn-reset-bus" onclick="event.stopPropagation(); showResetConfirm('${busId}')" title="Reset ${formatBusID(busId)}">↺</button>
                </div>
            </div>
        `;
    });
    
    if (!html) {
        html = '<div class="empty-state">No buses available for your account</div>';
    }
    
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
function getDriverName(busId) {
    const drivers = {
        'bus01': 'John Smith',
        'bus02': 'Sarah Johnson',
        'bus03': 'Mike Davis',
        'bus04': 'Emily Wilson',
        'bus05': 'David Brown',
        'bus06': 'Lisa Anderson'
    };
    return drivers[busId] || 'Not Assigned';
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

function searchAndMove(type) {
    const q = document.getElementById(type === 'current' ? 'search-src' : 'search-dest').value.trim();
    if (!q) return;
    
    // Check if it's a known location first
    const normalizedQuery = q.toLowerCase().trim();
    const knownLocation = KNOWN_LOCATIONS[normalizedQuery];
    
    if (knownLocation) {
        // Use known coordinates for better accuracy
        if (type === 'current') {
            startCoords = { lat: knownLocation.lat, lng: knownLocation.lng, name: knownLocation.name };
        } else {
            endCoords = { lat: knownLocation.lat, lng: knownLocation.lng, name: knownLocation.name };
        }
        
        // Update fleet data
        let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        if(!fleet[activeBusID]) fleet[activeBusID] = { active: false };

        if (type === 'current') {
            fleet[activeBusID].lat = knownLocation.lat;
            fleet[activeBusID].lng = knownLocation.lng;
            fleet[activeBusID].from = knownLocation.name;
        } else {
            fleet[activeBusID].dLat = knownLocation.lat;
            fleet[activeBusID].dLng = knownLocation.lng;
            fleet[activeBusID].to = knownLocation.name;
        }
        localStorage.setItem("fleet_data", JSON.stringify(fleet));

        // Update markers and route
        updateMarkersAndRoute();
        syncData();
        showToast(`Location set: ${knownLocation.name}`);
        return;
    }

    // Use TomTom Search API for other locations
    tt.services.fuzzySearch({
        key: TOMTOM_KEY,
        query: q,
        center: [72.8557, 19.2813],
        radius: 15000, // 15km radius for Mira Bhayandar area
        idxSet: 'POI,Str,Geo',
        limit: 5, // Get multiple results for better accuracy
        countrySet: 'IN',
        language: 'en-US' // Changed from 'en-GB' to 'en-US' to fix "Language tag 'en' not supported" error
    }).then((res) => {
        if (res.results && res.results.length > 0) {
            // Find the best match
            let bestMatch = res.results[0];
            
            // If multiple results, try to find the most relevant one
            if (res.results.length > 1) {
                for (const result of res.results) {
                    const poiName = result.poi ? result.poi.name : '';
                    const address = result.address ? result.address.freeformAddress : '';
                    const combined = (poiName + ' ' + address).toLowerCase();
                    
                    // Check if this result matches keywords from query
                    const queryWords = normalizedQuery.split(' ');
                    let matchScore = 0;
                    for (const word of queryWords) {
                        if (word.length > 2 && combined.includes(word)) {
                            matchScore++;
                        }
                    }
                    
                    if (matchScore >= queryWords.length * 0.5) {
                        bestMatch = result;
                        break;
                    }
                }
            }
            
            const pos = bestMatch.position;
            const placeName = bestMatch.poi ? bestMatch.poi.name : 
                             (bestMatch.address ? bestMatch.address.freeformAddress : q);
            
            // Store coordinates
            if (type === 'current') {
                startCoords = { lat: pos.lat, lng: pos.lng, name: placeName };
            } else {
                endCoords = { lat: pos.lat, lng: pos.lng, name: placeName };
            }

            // Update fleet data
            let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
            if(!fleet[activeBusID]) fleet[activeBusID] = { active: false };

            if (type === 'current') {
                fleet[activeBusID].lat = pos.lat;
                fleet[activeBusID].lng = pos.lng;
                fleet[activeBusID].from = placeName;
            } else {
                fleet[activeBusID].dLat = pos.lat;
                fleet[activeBusID].dLng = pos.lng;
                fleet[activeBusID].to = placeName;
            }
            localStorage.setItem("fleet_data", JSON.stringify(fleet));

            // Update markers and route
            updateMarkersAndRoute();
            syncData();
            showToast(`Location found: ${placeName}`);
        } else {
            showToast("Location not found. Please try a different search.");
        }
    }).catch(err => {
        console.error('========== SEARCH ERROR ==========');
        console.error('Error type:', err.constructor.name);
        console.error('Error message:', err.message);
        if (err.response) {
            console.error('HTTP Status:', err.response.status);
            console.error('Error Body:', err.response.data);
        }
        console.error('Error stack:', err.stack);
        showToast("Error searching location. Please check console for details.");
    });
}

// Update markers with blue (start) and red (end) colors, draw route, auto-zoom
function updateMarkersAndRoute() {
    // Clear existing markers
    if (busMarker) { busMarker.remove(); busMarker = null; }
    if (destMarker) { destMarker.remove(); destMarker = null; }
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (map.getSource('route-source')) { map.removeSource('route-source'); }

    const bounds = new tt.LngLatBounds();
    let hasMarkers = false;

    // Add BLUE marker at start location with enhanced visibility
    if (startCoords) {
        // Validate coordinates
        if (!startCoords.lat || !startCoords.lng || isNaN(startCoords.lat) || isNaN(startCoords.lng)) {
            console.error('Invalid startCoords:', startCoords);
            showToast('Invalid start location');
            return;
        }
        
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div style="
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
                border-radius: 50%;
                border: 4px solid white;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5), 0 0 0 4px rgba(37, 99, 235, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <span style="color: white; font-size: 14px;">A</span>
            </div>
        `;
        
        busMarker = new tt.Marker({ element: el })
            .setLngLat([startCoords.lng, startCoords.lat])
            .setPopup(new tt.Popup().setHTML('<b style="color:#2563eb;">Start:</b> ' + startCoords.name))
            .addTo(map);
        
        bounds.extend([startCoords.lng, startCoords.lat]);
        hasMarkers = true;
    }

    // Add RED marker at end location with enhanced visibility
    if (endCoords) {
        // Validate coordinates
        if (!endCoords.lat || !endCoords.lng || isNaN(endCoords.lat) || isNaN(endCoords.lng)) {
            console.error('Invalid endCoords:', endCoords);
            showToast('Invalid destination location');
            return;
        }
        
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div style="
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                border-radius: 50%;
                border: 4px solid white;
                box-shadow: 0 4px 12px rgba(220, 38, 38, 0.5), 0 0 0 4px rgba(220, 38, 38, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <span style="color: white; font-size: 14px;">B</span>
            </div>
        `;
        
        destMarker = new tt.Marker({ element: el })
            .setLngLat([endCoords.lng, endCoords.lat])
            .setPopup(new tt.Popup().setHTML('<b style="color:#dc2626;">Destination:</b> ' + endCoords.name))
            .addTo(map);
        
        bounds.extend([endCoords.lng, endCoords.lat]);
        hasMarkers = true;
    }

    // Auto-zoom to fit both markers
    if (hasMarkers) {
        map.fitBounds(bounds, { padding: 100, maxZoom: 16, duration: 1000 });
    }

    // Draw precise driving route if both points exist
    if (startCoords && endCoords) {
        drawPreciseRoute();
    }
}

// Draw precise driving route polyline
function drawPreciseRoute() {
    // CRITICAL: Validate coordinates before proceeding
    if (!startCoords || !endCoords) {
        console.warn('Missing coordinates:', { startCoords, endCoords });
        showToast('Missing start or destination coordinates');
        return;
    }
    
    // Validate coordinate values
    if (!startCoords.lat || !startCoords.lng || !endCoords.lat || !endCoords.lng) {
        console.error('Invalid coordinate values:', {
            startCoords: startCoords,
            endCoords: endCoords
        });
        showToast('Invalid coordinates. Please select valid locations.');
        return;
    }
    
    // Check for NaN
    if (isNaN(startCoords.lat) || isNaN(startCoords.lng) || 
        isNaN(endCoords.lat) || isNaN(endCoords.lng)) {
        console.error('Coordinates contain NaN:', {
            startCoords: startCoords,
            endCoords: endCoords
        });
        showToast('Invalid location data. Please try again.');
        return;
    }
    
    if (!map) {
        console.error('Map not initialized');
        showToast('Map not ready. Please refresh.');
        return;
    }

    console.log('Calculating route from:', startCoords, 'to:', endCoords);

    tt.services.calculateRoute({
        key: TOMTOM_KEY,
        locations: `${startCoords.lng},${startCoords.lat}:${endCoords.lng},${endCoords.lat}`,
        travelMode: 'bus',
        routeType: 'fastest',
        traffic: true
    }).then((res) => {
        console.log('Route API Response:', res);
        
        if (!res.routes || res.routes.length === 0) {
            console.error('No routes returned from API');
            showToast("Could not calculate route. Try different locations.");
            return;
        }
        
        const route = res.routes[0];
        
        // FIX: TomTom returns GeoJSON directly in the response, not via toGeoJson() method
        let geoJson;
        if (res.toGeoJson) {
            // Some versions have toGeoJson on the response object
            geoJson = res.toGeoJson();
        } else if (route.legs && route.legs[0] && route.legs[0].points) {
            // Convert route points to GeoJSON LineString
            const points = route.legs[0].points;
            
            // Validate points array
            if (!points || points.length === 0) {
                console.error('Route points array is empty');
                showToast("Route has no path data");
                return;
            }
            
            // Convert and validate each point
            const coordinates = points
                .filter(point => point && point.longitude !== undefined && point.latitude !== undefined)
                .map(point => [point.longitude, point.latitude]);
            
            if (coordinates.length === 0) {
                console.error('No valid coordinates in route points');
                showToast("Invalid route data");
                return;
            }
            
            geoJson = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {}
            };
        } else {
            console.error('Cannot extract route geometry');
            showToast("Route data format error");
            return;
        }
        
        console.log('Route GeoJSON:', geoJson);
        
        // Calculate ETA
        const travelTimeMinutes = Math.ceil(route.summary.travelTimeInSeconds / 60);
        
        // Update fleet data
        let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
        if(!fleet[activeBusID]) fleet[activeBusID] = { active: false };
        fleet[activeBusID].eta = travelTimeMinutes;
        fleet[activeBusID].from = startCoords.name;
        fleet[activeBusID].to = endCoords.name;
        fleet[activeBusID].active = true;
        localStorage.setItem("fleet_data", JSON.stringify(fleet));

        // CRITICAL FIX: Remove ALL existing route layers properly
        if (map.getLayer('route-inner')) map.removeLayer('route-inner');
        if (map.getLayer('route-path')) map.removeLayer('route-path');
        if (map.getLayer('route-glow')) map.removeLayer('route-glow');
        if (map.getSource('route-source')) map.removeSource('route-source');

        // Add route source
        map.addSource('route-source', {
            type: 'geojson',
            data: geoJson
        });
        
        // Layer 1: Glow effect (outer)
        map.addLayer({
            'id': 'route-glow',
            'type': 'line',
            'source': 'route-source',
            'paint': {
                'line-color': '#3b82f6',
                'line-width': 14,
                'line-opacity': 0.2,
                'line-blur': 6
            }
        });
        
        // Layer 2: Main route path
        map.addLayer({
            'id': 'route-path',
            'type': 'line',
            'source': 'route-source',
            'paint': {
                'line-color': '#2563eb',
                'line-width': 6,
                'line-opacity': 1,
                'line-cap': 'round',
                'line-join': 'round'
            }
        });
        
        // Layer 3: Inner highlight
        map.addLayer({
            'id': 'route-inner',
            'type': 'line',
            'source': 'route-source',
            'paint': {
                'line-color': '#60a5fa',
                'line-width': 2,
                'line-opacity': 0.9
            }
        });

        // Auto-zoom to fit route
        if (geoJson.geometry && geoJson.geometry.coordinates && geoJson.geometry.coordinates.length > 0) {
            const bounds = new tt.LngLatBounds();
            
            // Extend bounds with all route coordinates
            geoJson.geometry.coordinates.forEach(coord => {
                if (coord && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
                    bounds.extend(coord);
                }
            });
            
            // Only fitBounds if we have valid bounds
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, {
                    padding: { top: 80, bottom: 80, left: 80, right: 80 },
                    maxZoom: 16,
                    duration: 1000
                });
                console.log('Fitted bounds to route');
            } else {
                console.warn('Empty bounds after processing coordinates');
                showToast('Route calculated but could not fit to view');
            }
        } else {
            console.warn('No coordinates in route geometry');
            showToast('Route has no path data');
        }

        syncData();
        showToast(`Route set! ETA: ${travelTimeMinutes} mins`);
    }).catch(err => {
        console.error('Route calculation error:', err);
        showToast("Route error: " + err.message);
    });
}

// Helper function to remove all route layers
function removeRouteLayers() {
    if (map.getLayer('route-inner')) map.removeLayer('route-inner');
    if (map.getLayer('route-path')) map.removeLayer('route-path');
    if (map.getLayer('route-glow')) map.removeLayer('route-glow');
    if (map.getSource('route-source')) map.removeSource('route-source');
}

// --- 3. DATA SYNC & UI ---
function syncData() {
    // Sync centralized state from localStorage
    AppState.sync();
    
    const role = AppState.userRole;
    const busData = AppState.fleetData[activeBusID];
    
    if (!busData) {
        console.warn('No data for active bus:', activeBusID);
        return;
    }
    
    // Update the Bus ID display text (e.g., "Bus BUS01" -> "Bus B-01")
    updateBusDisplayText();
    
    // Update monitor portal (admin/parent view)
    if (role !== 'driver') {
        const busIdEl = document.getElementById('m-bus-id');
        const fromEl = document.getElementById('m-from');
        const toEl = document.getElementById('m-to');
        const etaEl = document.getElementById('m-eta');
        const progressEl = document.getElementById('m-progress');
        const busIconEl = document.getElementById('m-bus-icon');
        
        if (busIdEl) busIdEl.innerText = "VEHICLE: " + formatBusID(activeBusID);
        if (fromEl) fromEl.innerText = busData.from || "--";
        if (toEl) toEl.innerText = busData.to || "--";
        if (etaEl) etaEl.innerText = busData.eta || "--";
        
        if(busData.eta && progressEl && busIconEl) {
            const p = Math.min(100, Math.max(0, 100 - (busData.eta * 2.5)));
            progressEl.style.width = p + "%";
            busIconEl.style.left = p + "%";
        }
    } else {
        // Update driver portal
        const busIdEl = document.getElementById('d-bus-id');
        const etaTextEl = document.getElementById('d-eta-text');
        const etaBoxEl = document.getElementById('driver-eta-box');
        
        if (busIdEl) busIdEl.innerText = formatBusID(activeBusID);
        if (etaTextEl) etaTextEl.innerText = busData.eta || "--";
        if (etaBoxEl) etaBoxEl.style.display = busData.eta ? 'block' : 'none';
    }
    
    // Refresh fleet list to update status badges
    renderFullFleetList();
}

// Format bus ID for display (bus01 -> B-01)
function formatBusID(id) {
    return id.replace(/bus(\d+)/i, 'B-$1').toUpperCase();
}

// Refresh all UI components from centralized state
function refreshUI() {
    console.log('Refreshing UI from centralized state...');
    
    // Sync state
    AppState.sync();
    
    // Update fleet list
    renderFullFleetList();
    
    // Update monitor/driver portal
    syncData();
    
    // Update notification panel if open
    const panel = document.getElementById('notification-panel');
    if (panel && panel.classList.contains('active')) {
        renderNotifications();
    }
    
    console.log('UI refresh complete');
}

// Update the Bus display text below inputs
function updateBusDisplayText() {
    const monitorTitle = document.getElementById('m-bus-id');
    if (monitorTitle) {
        monitorTitle.innerText = "VEHICLE: " + formatBusID(activeBusID);
    }
}

// --- UTILS ---
function changeBus(id) {
    // ROLE-BASED CHECK: Only allow switching to allowed buses
    if (!AppState.canViewBus(id)) {
        showToast(`You don't have permission to view ${formatBusID(id)}`);
        console.warn(`User ${AppState.currentUser} (${AppState.userRole}) tried to access bus ${id} but is only assigned to ${AppState.assignedBusId}`);
        return;
    }
    
    // Add loading animation
    const monitorCard = document.querySelector('.glass-monitor-card');
    if (monitorCard) {
        monitorCard.classList.add('loading');
    }
    
    activeBusID = id;
    sessionStorage.setItem("active_bus", id);
    AppState.activeBusId = id;  // Update centralized state
    updateChipUI(id);
    
    // Clear existing route and markers
    removeRouteLayers();
    if (busMarker) { busMarker.remove(); busMarker = null; }
    if (destMarker) { destMarker.remove(); destMarker = null; }
    
    // Restore coordinates for new bus if exists
    let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
    if (fleet[id]) {
        if (fleet[id].lat && fleet[id].lng) {
            startCoords = { lat: fleet[id].lat, lng: fleet[id].lng, name: fleet[id].from || 'Start' };
        } else {
            startCoords = null;
        }
        if (fleet[id].dLat && fleet[id].dLng) {
            endCoords = { lat: fleet[id].dLat, lng: fleet[id].dLng, name: fleet[id].to || 'Destination' };
        } else {
            endCoords = null;
        }
        
        // Update markers and route for this bus
        updateMarkersAndRoute();
        
        // Calculate unique ETA for this bus if both coords exist
        if (startCoords && endCoords) {
            calculateBusETA(id);
        }
    } else {
        startCoords = null;
        endCoords = null;
    }
    
    // Update input fields with this bus's data
    updateInputFields(fleet[id]);
    
    syncData();
    
    // Remove loading after map updates
    setTimeout(() => {
        if (monitorCard) {
            monitorCard.classList.remove('loading');
        }
    }, 500);
    
    showToast(`Selected Bus ${formatBusID(id)}`);
}

// Calculate unique ETA for a specific bus
function calculateBusETA(busId) {
    if (!startCoords || !endCoords) return;
    
    tt.services.calculateRoute({
        key: TOMTOM_KEY,
        locations: `${startCoords.lng},${startCoords.lat}:${endCoords.lng},${endCoords.lat}`,
        travelMode: 'bus',
        routeType: 'fastest',
        traffic: true
    }).then((res) => {
        if (res.routes && res.routes.length > 0) {
            const route = res.routes[0];
            const travelTimeMinutes = Math.ceil(route.summary.travelTimeInSeconds / 60);
            
            // Store unique ETA for this specific bus
            let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
            if(!fleet[busId]) fleet[busId] = { active: false };
            fleet[busId].eta = travelTimeMinutes;
            localStorage.setItem("fleet_data", JSON.stringify(fleet));
            
            syncData();
            showToast(`${formatBusID(busId)} ETA: ${travelTimeMinutes} mins`);
        }
    }).catch(err => {
        console.error('ETA calculation error for', busId, err);
    });
}

// Update input fields with bus data
function updateInputFields(busData) {
    const srcInput = document.getElementById('search-src');
    const destInput = document.getElementById('search-dest');
    
    if (srcInput && busData && busData.from) {
        srcInput.value = busData.from;
    } else if (srcInput) {
        srcInput.value = '';
    }
    
    if (destInput && busData && busData.to) {
        destInput.value = busData.to;
    } else if (destInput) {
        destInput.value = '';
    }
}

// Custom Confirmation Modal State
let pendingResetBusId = null;

// Show custom confirmation modal
function showResetConfirm(busId) {
    pendingResetBusId = busId;
    const modal = document.getElementById('confirm-modal');
    const message = document.getElementById('modal-message');
    
    message.innerHTML = `Are you sure you want to reset <strong>${formatBusID(busId)}</strong>?<br>This will clear all trip data and route information.`;
    
    modal.classList.add('active');
}

// Close confirmation modal
function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('active');
    pendingResetBusId = null;
}

// Execute reset after confirmation
function executeReset() {
    if (pendingResetBusId) {
        performReset(pendingResetBusId);
        closeConfirmModal();
    }
}

// Perform the actual reset
function performReset(busId) {
    // Clear fleet data for this bus
    let fleet = JSON.parse(localStorage.getItem("fleet_data")) || {};
    fleet[busId] = { 
        active: false,
        eta: null,
        from: null,
        to: null,
        lat: null,
        lng: null,
        dLat: null,
        dLng: null
    };
    localStorage.setItem("fleet_data", JSON.stringify(fleet));
    
    // If this is the currently active bus, clear the map
    if (activeBusID === busId) {
        removeRouteLayers();
        if (busMarker) { busMarker.remove(); busMarker = null; }
        if (destMarker) { destMarker.remove(); destMarker = null; }
        startCoords = null;
        endCoords = null;
        
        // Clear input fields
        const srcInput = document.getElementById('search-src');
        const destInput = document.getElementById('search-dest');
        if (srcInput) srcInput.value = '';
        if (destInput) destInput.value = '';
        
        // Hide ETA box
        const etaBox = document.getElementById('driver-eta-box');
        if (etaBox) etaBox.style.display = 'none';
    }
    
    syncData();
    showToast(`Bus ${formatBusID(busId)} reset successfully`);
}

// Legacy reset function (redirects to modal)
function resetBus(busId) {
    showResetConfirm(busId);
}

function updateChipUI(id) {
    document.querySelectorAll('.chip').forEach(c => {
        // Match button text like "B-01" with id like "bus01"
        const chipId = c.innerText.toLowerCase().replace("-", "").replace("b", "bus");
        const isActive = chipId === id;
        c.classList.toggle('active', isActive);
        
        // Add visual active state styling
        if (isActive) {
            c.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
            c.style.borderColor = '#3b82f6';
            c.style.color = '#1d4ed8';
            c.style.boxShadow = '0 4px 15px rgba(59,130,246,0.2)';
        } else {
            c.style.background = '';
            c.style.borderColor = '';
            c.style.color = '';
            c.style.boxShadow = '';
        }
    });
    
    // Update reset button states
    document.querySelectorAll('.fleet-item').forEach(item => {
        const chip = item.querySelector('.chip');
        const resetBtn = item.querySelector('.btn-reset-bus');
        if (chip && resetBtn) {
            const chipId = chip.innerText.toLowerCase().replace("-", "").replace("b", "bus");
            if (chipId === id) {
                resetBtn.style.borderColor = '#3b82f6';
                resetBtn.style.color = '#3b82f6';
            } else {
                resetBtn.style.borderColor = '';
                resetBtn.style.color = '';
            }
        }
    });
}

function drawRoute(id) {
    const fleet = JSON.parse(localStorage.getItem("fleet_data"));
    const d = fleet[id];
    tt.services.calculateRoute({ key: TOMTOM_KEY, locations: `${d.lng},${d.lat}:${d.dLng},${d.dLat}`, travelMode: 'truck' })
    .then((res) => {
        d.eta = Math.floor(res.routes[0].summary.travelTimeInSeconds / 60) + 5;
        localStorage.setItem("fleet_data", JSON.stringify(fleet));
        const g = res.toGeoJson();
        if (map.getLayer('route-path')) { map.removeLayer('route-path'); map.removeSource('route-path'); }
        map.addLayer({ 'id': 'route-path', 'type': 'line', 'source': { 'type': 'geojson', 'data': g }, 'paint': { 'line-color': '#2563eb', 'line-width': 6 } });
        syncData();
    });
}

function initMap() { 
    if(map) map.remove(); 
    map = tt.map({ 
        key: TOMTOM_KEY, 
        container: 'map', 
        center: [72.8557, 19.2813], 
        zoom: 14 
    }); 
    
    map.on('load', () => { 
        map.resize(); 
        syncData();
        
        // Initialize resizable sidebar after map loads
        setTimeout(() => {
            initResizableSidebar();
        }, 500);
    }); 
    
    setInterval(syncData, 5000); 
}

// Map zoom controls - enhanced with smooth animations
function mapZoomIn() {
    if (!map) {
        console.error('Map not initialized');
        showToast('Map not ready yet');
        return;
    }
    try {
        map.zoomIn({
            duration: 400,
            easeLinearity: 0.3
        });
        console.log('Zoomed in, current level:', map.getZoom());
    } catch (err) {
        console.error('Zoom in error:', err);
    }
}

function mapZoomOut() {
    if (!map) {
        console.error('Map not initialized');
        showToast('Map not ready yet');
        return;
    }
    try {
        map.zoomOut({
            duration: 400,
            easeLinearity: 0.3
        });
        console.log('Zoomed out, current level:', map.getZoom());
    } catch (err) {
        console.error('Zoom out error:', err);
    }
}

function mapFitAll() {
    if (!map) return;
    
    const bounds = new tt.LngLatBounds();
    
    if (startCoords) bounds.extend([startCoords.lng, startCoords.lat]);
    if (endCoords) bounds.extend([endCoords.lng, endCoords.lat]);
    
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
            padding: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100
            },
            duration: 800,
            maxZoom: 16,
            easeLinearity: 0.5
        });
        console.log('Fitted bounds to show all markers');
    } else {
        // Default view
        map.flyTo({
            center: [72.8557, 19.2813],
            zoom: 14,
            duration: 800
        });
    }
}

// Make map globally accessible for debugging
window.getBusTrackMap = function() {
    return map;
};

// --- REAL-TIME NOTIFICATION SYSTEM ---
function addNotification(icon, title, type = 'info', busId = null) {
    const notification = {
        id: Date.now(),
        icon: icon,
        title: title,
        time: 'Just now',
        type: type,
        read: false,
        busId: busId  // Associate notification with specific bus
    };
    
    // Filter: Only add notification if user should see it
    if (busId && !AppState.shouldShowNotification(busId)) {
        console.log(`Notification filtered out for bus ${busId} (user assigned to ${AppState.assignedBusId})`);
        return;
    }
    
    notifications.unshift(notification);
    unreadCount++;
    
    // Update badge
    updateNotificationBadge();
    
    // Show toast
    showToast(title);
    
    // Update notification panel if visible
    const panel = document.getElementById('notification-panel');
    if (panel && panel.classList.contains('active')) {
        renderNotifications();
    }
    
    console.log('Notification added:', notification);
}

function updateNotificationBadge() {
    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            renderNotifications();
            // Mark all as read when opening
            unreadCount = 0;
            updateNotificationBadge();
        }
    }
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = '<div class="empty-notif">No notifications yet</div>';
        return;
    }
    
    let html = '';
    notifications.slice(0, 20).forEach(notif => {
        html += `
            <div class="notif-item ${notif.read ? 'read' : 'unread'}">
                <div class="notif-icon">${notif.icon}</div>
                <div class="notif-content">
                    <div class="notif-title">${notif.title}</div>
                    <div class="notif-time">${notif.time}</div>
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function clearNotifications() {
    notifications = [];
    unreadCount = 0;
    updateNotificationBadge();
    renderNotifications();
    showToast('Notifications cleared');
}

// --- JOURNEY NOTIFICATION EVENTS ---
function triggerJourneyStarted(busId) {
    addNotification('🚌', `Bus ${formatBusID(busId)} has started the journey`, 'success', busId);
    
    // Update centralized state
    AppState.updateFleetData(busId, { active: true });
    AppState.updateJourneyState(busId, {
        status: 'started',
        startTime: new Date().toISOString(),
        currentStop: 0,
        totalStops: 5
    });
}

function triggerApproachingStop(busId, stopName) {
    addNotification('📍', `Bus ${formatBusID(busId)} approaching: ${stopName}`, 'info', busId);
    
    // Update journey state
    AppState.updateJourneyState(busId, {
        currentStop: AppState.journeyState[busId]?.currentStop || 0,
        nextStop: stopName,
        status: 'approaching'
    });
}

function triggerReachedStop(busId, stopName) {
    addNotification('✅', `Bus ${formatBusID(busId)} reached: ${stopName}`, 'success', busId);
    
    // Update journey state
    AppState.updateJourneyState(busId, {
        status: 'at_stop',
        lastStop: stopName
    });
}

function triggerSmartArrivalAlert(busId, minutesAway) {
    addNotification('⏰', `Your bus will arrive in ${minutesAway} minutes!`, 'warning', busId);
    
    // Update journey state
    AppState.updateJourneyState(busId, {
        status: 'approaching_final',
        minutesAway: minutesAway
    });
}

// --- JOURNEY SIMULATION WITH STEP-BY-STEP NOTIFICATIONS ---
function startJourneySimulation(busId) {
    // Clear any existing simulation
    if (journeySimulationInterval) {
        clearInterval(journeySimulationInterval);
    }
    
    const stops = [
        'Main Gate',
        'City Center',
        'Market Road',
        'School Junction',
        'Final Destination'
    ];
    
    let currentStop = 0;
    let step = 0; // 0=approaching, 1=reached
    
    // Simulate journey progress every 30 seconds
    journeySimulationInterval = setInterval(() => {
        if (currentStop >= stops.length) {
            // Journey complete
            clearInterval(journeySimulationInterval);
            addNotification('🏁', `Bus ${formatBusID(busId)} has completed the journey`, 'success', busId);
            
            // Update journey state
            AppState.updateJourneyState(busId, {
                status: 'completed',
                endTime: new Date().toISOString()
            });
            return;
        }
        
        const stopName = stops[currentStop];
        
        if (step === 0) {
            // Approaching stop
            triggerApproachingStop(busId, stopName);
            step = 1;
            
            // Update journey state
            AppState.updateJourneyState(busId, {
                currentStop: currentStop,
                nextStop: stopName
            });
        } else {
            // Reached stop
            triggerReachedStop(busId, stopName);
            currentStop++;
            step = 0;
            
            // Trigger smart arrival alert when 2 stops away (simulating ~5-7 mins)
            if (currentStop === stops.length - 2) {
                triggerSmartArrivalAlert(busId, 5);
            }
        }
    }, 30000); // Every 30 seconds for demo (in production, use real GPS data)
    
    console.log('Journey simulation started for', busId);
}
function publishTrip() { 
    // Update centralized state (single source of truth)
    AppState.updateFleetData(activeBusID, { 
        active: true,
        lastUpdated: new Date().toISOString()
    });
    
    showToast(`Bus ${activeBusID.toUpperCase()} is LIVE!`);
    
    // Trigger journey started notification (will be filtered by AppState)
    triggerJourneyStarted(activeBusID);
    
    // Start journey simulation with route progress notifications
    startJourneySimulation(activeBusID);
    
    // Refresh UI to reflect state changes
    refreshUI();
}
function logout() { 
    localStorage.removeItem('saved_user_role');
    localStorage.removeItem('temp_role');
    sessionStorage.clear(); 
    location.reload(); 
}
function switchRole() { 
    document.getElementById('app-container').style.display='none'; 
    document.getElementById('login-screen').style.display='flex'; 
    sessionStorage.clear(); 
}
function showToast(m) { 
    const t = document.getElementById('toast'); 
    t.innerText = m; 
    t.style.display = 'block'; 
    setTimeout(()=>t.style.display='none',3000); 
}
function resetLogin() { 
    document.getElementById('role-selection-v3').style.display='block'; 
    document.getElementById('auth-form-v3').style.display='none'; 
}

// Notification system
const DUMMY_NOTIFICATIONS = [
    { id: 1, icon: '⚠️', title: 'Bus B-03 is delayed by 10 mins', time: '5 mins ago', type: 'warning' },
    { id: 2, icon: '🚌', title: 'Bus B-01 started trip', time: '15 mins ago', type: 'info' },
    { id: 3, icon: '✅', title: 'Bus B-05 completed route', time: '1 hour ago', type: 'success' },
    { id: 4, icon: '🔴', title: 'Bus B-02 is offline', time: '2 hours ago', type: 'danger' },
    { id: 5, icon: '📍', title: 'New route assigned to B-04', time: '3 hours ago', type: 'info' }
];

function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
        panel.classList.toggle('active');
        
        if (panel.classList.contains('active')) {
            renderNotifications();
        }
    }
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    
    list.innerHTML = DUMMY_NOTIFICATIONS.map(notif => `
        <div class="notif-item">
            <div class="notif-icon">${notif.icon}</div>
            <div class="notif-content">
                <div class="notif-title">${notif.title}</div>
                <div class="notif-time">${notif.time}</div>
            </div>
        </div>
    `).join('');
}

function clearNotifications() {
    DUMMY_NOTIFICATIONS.length = 0;
    renderNotifications();
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notification-wrapper');
    const panel = document.getElementById('notification-panel');
    
    if (wrapper && panel && !wrapper.contains(e.target)) {
        panel.classList.remove('active');
    }
});

// Initialize on page load
window.onload = () => { 
    // Initialize fleet data
    initializeFleetData();
    
    // Check if user is logged in
    const savedRole = localStorage.getItem("saved_user_role");
    const isLoggedInSession = sessionStorage.getItem("is_logged_in");
    
    if (isLoggedInSession === "true" || savedRole) {
        launchDashboard();
    }
};