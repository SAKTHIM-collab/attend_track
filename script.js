// --- Global Variables and Constants ---
let app; // Declare app globally (will be assigned in initializeFirebase)
let auth;
let db;
let currentUser;
let googleMap;
let googlePlacesService;
let googleAutocomplete;
let analytics; // Declare analytics globally (will be assigned in initializeFirebase)

const LOCATION_CHECK_RADIUS_METERS = 100; // Radius for attendance check (100 meters)
const NOTIFICATION_EARLY_WARNING_MINUTES = 10; // Notify if not in location after 10 mins of slot start
const ATTENDANCE_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute (adjust as needed for actual deployment)

let attendanceCheckInterval; // To store the interval ID for clearing

// --- Utility Functions ---

/**
 * Displays a custom message box instead of alert().
 * @param {string} message The message to display.
 */
function showMessageBox(message) {
    const overlay = document.getElementById('message-box-overlay');
    const messageText = document.getElementById('message-box-text');
    messageText.textContent = message;
    overlay.style.display = 'flex';
    document.getElementById('message-box-ok-btn').onclick = () => {
        overlay.style.display = 'none';
    };
}

/**
 * Calculates the distance between two geographical coordinates using the Haversine formula.
 * @param {object} latlng1 - {lat, lng} of first point.
 * @param {object} latlng2 - {lat, lng} of second point.
 * @returns {number} Distance in meters.
 */
function calculateDistance(latlng1, latlng2) {
    const R = 6371e3; // metres
    const φ1 = latlng1.lat * Math.PI / 180; // φ, λ in radians
    const φ2 = latlng2.lat * Math.PI / 180;
    const Δφ = (latlng2.lat - latlng1.lat) * Math.PI / 180;
    const Δλ = (latlng2.lng - latlng1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}

/**
 * Requests and returns the current geographical position of the user.
 * @returns {Promise<GeolocationPosition>} A promise that resolves with the position.
 */
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('Geolocation is not supported by your browser.'));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    });
}

/**
 * Sends a desktop notification.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body text of the notification.
 */
function sendNotification(title, body) {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission === "granted") {
        new Notification(title, { body: body });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body: body });
            }
        });
    }
}

/**
 * Formats a Date object into 'YYYY-MM-DD' string.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formats a time string 'HH:MM' into a Date object for today.
 * @param {string} timeString 'HH:MM'
 * @returns {Date}
 */
function createDateFromTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const now = new Date();
    now.setHours(hours, minutes, 0, 0);
    return now;
}

// --- Firebase Initialization ---
function initializeFirebase() {
    // Your web app's Firebase configuration - Using your actual config here
    const firebaseConfig = {
        apiKey: "AIzaSyCc5C_QlaP0zb1nvh1W2VYvfXgPmXMuHoQ",
        authDomain: "workingmap-98dde.firebaseapp.com",
        projectId: "workingmap-98dde",
        storageBucket: "workingmap-98dde.firebasestorage.app",
        messagingSenderId: "815223099902",
        appId: "1:815223099902:web:60b68d410d5d68c8a7b0af",
        measurementId: "G-8FRP0P83SF"
    };

    // ONLY initialize Firebase if it hasn't been initialized already
    if (!firebase.apps.length) {
        try {
            console.log("Attempting to initialize Firebase App...");
            app = firebase.initializeApp(firebaseConfig); // Assign to the global 'app' variable
            analytics = firebase.analytics(app); // Assign to the global 'analytics' variable
            console.log("Firebase App and Analytics initialized successfully.");
        } catch (error) {
            console.error("Error during Firebase initialization:", error);
            showMessageBox(`Failed to initialize Firebase: ${error.message}. Please check your Firebase config.`);
            return; // Stop if initialization fails
        }
    } else {
        console.log("Firebase App already initialized. Re-using existing instance.");
        // If already initialized, get the existing app and services
        app = firebase.app();
        analytics = firebase.analytics(app); // Get analytics from the existing app
    }

    // Initialize Auth and Firestore services
    auth = firebase.auth(app); // Pass the app instance
    db = firebase.firestore(app); // Pass the app instance

    // Set up auth state observer
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('app-section').style.display = 'block';
            document.getElementById('user-email-display').textContent = `Logged in as: ${user.email}`;
            loadUserData();
            startAttendanceChecking();
            // Initialize Google Maps Autocomplete once Firebase and elements are ready
            if (typeof google !== 'undefined' && google.maps && !googleAutocomplete) {
                initializeGoogleMapsAutocomplete();
            }
        } else {
            currentUser = null;
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('app-section').style.display = 'none';
            stopAttendanceChecking();
        }
    });
}

// --- Authentication Functions ---

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    if (email && password) {
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            showMessageBox('Account created successfully!');
        } catch (error) {
            showMessageBox(`Error signing up: ${error.message}`);
        }
    } else {
        showMessageBox('Please enter email and password for signup.');
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (email && password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            showMessageBox('Logged in successfully!');
        } catch (error) {
            showMessageBox(`Error logging in: ${error.message}`);
        }
    } else {
        showMessageBox('Please enter email and password for login.');
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showMessageBox('Logged out successfully!');
    } catch (error) {
        showMessageBox(`Error logging out: ${error.message}`);
    }
}

// --- User Data Management (Firestore) ---

async function loadUserData() {
    if (!currentUser) return;

    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();

        if (doc.exists) {
            const data = doc.data();
            document.getElementById('min-attendance-percent').value = data.minAttendancePercent || '';
            renderSubjects(data.subjects || []);
            renderSchedule(data.schedule || []);
            // Set current month for attendance view
            const today = new Date();
            const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('attendance-month-select').value = yearMonth;
            renderAttendanceHistory(yearMonth); // Load attendance for current month
            updateDashboard();
        } else {
            // New user, set default data
            await userDocRef.set({
                minAttendancePercent: 75,
                subjects: [],
                schedule: []
            });
            document.getElementById('min-attendance-percent').value = 75;
            renderSubjects([]);
            renderSchedule([]);
            // Set current month for attendance view
            const today = new Date();
            const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('attendance-month-select').value = yearMonth;
            renderAttendanceHistory(yearMonth);
            updateDashboard();
        }
    } catch (error) {
        showMessageBox(`Error loading user data: ${error.message}`);
    }
}

async function saveMinAttendancePercent() {
    if (!currentUser) return;
    const percent = parseInt(document.getElementById('min-attendance-percent').value);
    if (isNaN(percent) || percent < 0 || percent > 100) {
        showMessageBox('Please enter a valid percentage between 0 and 100.');
        return;
    }
    try {
        await db.collection('users').doc(currentUser.uid).update({
            minAttendancePercent: percent
        });
        showMessageBox('Minimum attendance percentage saved.');
        updateDashboard(); // Recalculate and update dashboard after settings change
    } catch (error) {
        showMessageBox(`Error saving minimum attendance percentage: ${error.message}`);
    }
}

async function addSubject() {
    if (!currentUser) return;
    const subjectName = document.getElementById('new-subject-name').value.trim();
    if (!subjectName) {
        showMessageBox('Subject name cannot be empty.');
        return;
    }
    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();
        const subjects = doc.exists && doc.data().subjects ? doc.data().subjects : [];
        if (!subjects.includes(subjectName)) {
            subjects.push(subjectName);
            await userDocRef.update({ subjects: subjects });
            renderSubjects(subjects);
            populateSubjectDropdowns(subjects);
            document.getElementById('new-subject-name').value = '';
            showMessageBox('Subject added successfully.');
        } else {
            showMessageBox('Subject already exists.');
        }
    } catch (error) {
        showMessageBox(`Error adding subject: ${error.message}`);
    }
}

async function deleteSubject(subjectToDelete) {
    if (!currentUser) return;
    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();
        const subjects = doc.exists && doc.data().subjects ? doc.data().subjects : [];
        const updatedSubjects = subjects.filter(subject => subject !== subjectToDelete);
        await userDocRef.update({ subjects: updatedSubjects });
        renderSubjects(updatedSubjects);
        populateSubjectDropdowns(updatedSubjects);
        showMessageBox('Subject deleted successfully.');
    } catch (error) {
        showMessageBox(`Error deleting subject: ${error.message}`);
    }
}

function renderSubjects(subjects) {
    const subjectsList = document.getElementById('subjects-list');
    subjectsList.innerHTML = '';
    if (subjects.length === 0) {
        subjectsList.innerHTML = '<li>No subjects added yet.</li>';
        return;
    }
    subjects.forEach(subject => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${subject}</span>
            <button class="delete-btn" data-subject="${subject}">Delete</button>
        `;
        subjectsList.appendChild(li);
    });
    // Add event listeners for delete buttons
    subjectsList.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = (event) => deleteSubject(event.target.dataset.subject);
    });
}

function populateSubjectDropdowns(subjects) {
    const slotSubjectDropdown = document.getElementById('slot-subject');
    slotSubjectDropdown.innerHTML = '<option value="">Select Subject</option>';
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        slotSubjectDropdown.appendChild(option);
    });
}

async function addScheduleSlot(event) {
    event.preventDefault();
    if (!currentUser) return;

    const day = document.getElementById('slot-day').value;
    const subject = document.getElementById('slot-subject').value;
    const fromTime = document.getElementById('slot-from').value;
    const toTime = document.getElementById('slot-to').value;
    const locationName = document.getElementById('slot-location-name').value;
    const lat = parseFloat(document.getElementById('slot-lat').value);
    const lng = parseFloat(document.getElementById('slot-lng').value);
    // NEW: Get the place ID if stored by Autocomplete
    const placeId = document.getElementById('slot-place-id') ? document.getElementById('slot-place-id').value : ''; // Assuming you add a hidden input for this


    if (!day || !subject || !fromTime || !toTime || !locationName || isNaN(lat) || isNaN(lng)) {
        showMessageBox('Please fill all schedule slot details and select a location.');
        return;
    }

    if (new Date(`2000/01/01 ${fromTime}`) >= new Date(`2000/01/01 ${toTime}`)) {
        showMessageBox('End time must be after start time.');
        return;
    }

    const newSlot = {
        id: Date.now().toString(), // Unique ID for the slot
        day,
        subject,
        fromTime,
        toTime,
        location: {
            name: locationName,
            lat,
            lng,
            placeId: placeId // Save the place ID here
        }
    };

    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();
        const schedule = doc.exists && doc.data().schedule ? doc.data().schedule : [];
        schedule.push(newSlot);
        await userDocRef.update({ schedule: schedule });
        renderSchedule(schedule);
        document.getElementById('add-slot-form').reset();
        document.getElementById('slot-map').style.display = 'none'; // Hide map after adding
        // Also clear the hidden place ID input if you add one
        if (document.getElementById('slot-place-id')) {
            document.getElementById('slot-place-id').value = '';
        }
        showMessageBox('Schedule slot added successfully.');
    } catch (error) {
        showMessageBox(`Error adding schedule slot: ${error.message}`);
    }
}

async function deleteScheduleSlot(slotId) {
    if (!currentUser) return;
    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();
        const schedule = doc.exists && doc.data().schedule ? doc.data().schedule : [];
        const updatedSchedule = schedule.filter(slot => slot.id !== slotId);
        await userDocRef.update({ schedule: updatedSchedule });
        renderSchedule(updatedSchedule);
        showMessageBox('Schedule slot deleted successfully.');
    } catch (error) {
        showMessageBox(`Error deleting schedule slot: ${error.message}`);
    }
}

function renderSchedule(schedule) {
    const scheduleList = document.getElementById('schedule-list');
    scheduleList.innerHTML = '';
    if (schedule.length === 0) {
        scheduleList.innerHTML = '<li>No schedule slots added yet.</li>';
        return;
    }
    // Sort schedule by day of week and then by time
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    schedule.sort((a, b) => {
        const dayA = daysOrder.indexOf(a.day);
        const dayB = daysOrder.indexOf(b.day);
        if (dayA !== dayB) return dayA - dayB;
        return a.fromTime.localeCompare(b.fromTime);
    });

    schedule.forEach(slot => {
        const li = document.createElement('li');
        // Create a Google Maps URL using the location coordinates and name
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${slot.location.lat},${slot.location.lng}&query_place_id=${slot.location.placeId || ''}`;

        li.innerHTML = `
            <span>${slot.day}, ${slot.fromTime}-${slot.toTime}: ${slot.subject} at
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${slot.location.name}</a>
            </span>
            <button class="delete-btn" data-slot-id="${slot.id}">Delete</button>
        `;
        scheduleList.appendChild(li);
    });
    scheduleList.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = (event) => deleteScheduleSlot(event.target.dataset.slotId);
    });
}

// --- Google Maps / Location Integration ---

function initializeGoogleMapsAutocomplete() {
    const locationSearchInput = document.getElementById('slot-location-search');
    const latInput = document.getElementById('slot-lat');
    const lngInput = document.getElementById('slot-lng');
    const locationNameInput = document.getElementById('slot-location-name');
    const mapDiv = document.getElementById('slot-map');
    const placeIdInput = document.getElementById('slot-place-id'); // Get the new input

    if (!google.maps.places) {
        console.error("Google Places library not loaded. Check your Google Maps API script tag.");
        return;
    }

    googleAutocomplete = new google.maps.places.Autocomplete(locationSearchInput, {
        types: ['establishment', 'geocode'], // Limit to places that are establishments or geocoded addresses
    });

    googleAutocomplete.addListener('place_changed', () => {
        const place = googleAutocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
            showMessageBox("No details available for input: '" + place.name + "'");
            return;
        }

        latInput.value = place.geometry.location.lat();
        lngInput.value = place.geometry.location.lng();
        locationNameInput.value = place.name;
        placeIdInput.value = place.place_id || ''; // Save the place ID here

        // Display a small map
        mapDiv.style.display = 'block';
        googleMap = new google.maps.Map(mapDiv, {
            center: place.geometry.location,
            zoom: 15,
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            zoomControl: false
        });
        new google.maps.Marker({
            map: googleMap,
            position: place.geometry.location,
            title: place.name
        });
    });
}

// --- Attendance Tracking Logic ---

/**
 * Starts the interval for checking attendance based on the schedule.
 */
function startAttendanceChecking() {
    // Clear any existing interval to prevent duplicates
    if (attendanceCheckInterval) {
        clearInterval(attendanceCheckInterval);
    }

    attendanceCheckInterval = setInterval(async () => {
        if (!currentUser) {
            stopAttendanceChecking();
            return;
        }
        const now = new Date();
        const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM

        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (!userDoc.exists) return;
            const userData = userDoc.data();
            const schedule = userData.schedule || [];

            // Get attendance records for today to avoid duplicate entries
            const todayDate = formatDate(now);
            const attendanceDocRef = db.collection('users').doc(currentUser.uid)
                                       .collection('attendance').doc(todayDate);
            const attendanceDoc = await attendanceDocRef.get();
            const todayAttendance = attendanceDoc.exists ? attendanceDoc.data().records || [] : [];

            for (const slot of schedule) {
                if (slot.day === currentDay) {
                    const slotStart = createDateFromTime(slot.fromTime);
                    const slotEnd = createDateFromTime(slot.toTime);
                    const slotMidpointFirstHalf = new Date(slotStart.getTime() + (slotEnd.getTime() - slotStart.getTime()) / 4); // Quarter mark of the slot duration
                    const tenMinutesIntoSlot = new Date(slotStart.getTime() + NOTIFICATION_EARLY_WARNING_MINUTES * 60 * 1000);

                    const isSlotActive = now >= slotStart && now <= slotEnd;
                    const hasAttendanceBeenMarked = todayAttendance.some(
                        rec => rec.slotId === slot.id && rec.originalStatus !== undefined
                    );

                    if (isSlotActive && !hasAttendanceBeenMarked) {
                        // Check for early warning notification
                        if (now >= tenMinutesIntoSlot && now < slotMidpointFirstHalf) {
                            const hasEarlyNotificationSent = todayAttendance.some(
                                rec => rec.slotId === slot.id && rec.earlyNotificationSent
                            );
                            if (!hasEarlyNotificationSent) {
                                getCurrentLocation().then(position => {
                                    const userLat = position.coords.latitude;
                                    const userLng = position.coords.longitude;
                                    const distance = calculateDistance(
                                        { lat: userLat, lng: userLng },
                                        slot.location
                                    );
                                    if (distance > LOCATION_CHECK_RADIUS_METERS) {
                                        sendNotification(
                                            'Attendance Reminder!',
                                            `You are not at ${slot.location.name} for ${slot.subject} class (${slot.fromTime}-${slot.toTime}).`
                                        );
                                        // Mark notification sent to avoid repeating
                                        todayAttendance.push({ slotId: slot.id, earlyNotificationSent: true });
                                        attendanceDocRef.set({ records: todayAttendance }, { merge: true });
                                    }
                                }).catch(err => {
                                    console.warn("Could not get location for early warning:", err.message);
                                });
                            }
                        }

                        // Main attendance check at the midpoint of the first half
                        if (now >= slotMidpointFirstHalf && now < new Date(slotMidpointFirstHalf.getTime() + ATTENDANCE_CHECK_INTERVAL_MS)) {
                            // Ensure this check runs only once around the midpoint
                            const isAlreadyCheckedAtMidpoint = todayAttendance.some(
                                rec => rec.slotId === slot.id && rec.midpointChecked
                            );
                            if (!isAlreadyCheckedAtMidpoint) {
                                console.log(`Checking attendance for ${slot.subject} at ${currentTime}`);
                                try {
                                    const position = await getCurrentLocation();
                                    const userLat = position.coords.latitude;
                                    const userLng = position.coords.longitude;
                                    const distance = calculateDistance(
                                        { lat: userLat, lng: userLng },
                                        slot.location
                                    );
                                    const status = distance <= LOCATION_CHECK_RADIUS_METERS ? 'Yes' : 'No';

                                    const attendanceRecord = {
                                        slotId: slot.id,
                                        subject: slot.subject,
                                        fromTime: slot.fromTime,
                                        toTime: slot.toTime,
                                        locationName: slot.location.name,
                                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                        originalStatus: status,
                                        status: status, // Initially, modified status is same as original
                                        isModified: false,
                                        doNotConsider: false,
                                        midpointChecked: true, // Mark as checked
                                        earlyNotificationSent: true // Assume if attendance checked, notification also implicitly handled
                                    };

                                    todayAttendance.push(attendanceRecord);
                                    await attendanceDocRef.set({ records: todayAttendance }, { merge: true });
                                    console.log(`Attendance for ${slot.subject} marked: ${status}`);
                                    updateDashboard(); // Update dashboard
                                    renderAttendanceHistory(todayDate.slice(0, 7)); // Refresh current month's attendance
                                } catch (locError) {
                                    console.error("Error getting location for attendance check:", locError.message);
                                    // If location not available, mark as 'No' or handle as specific error
                                    const attendanceRecord = {
                                        slotId: slot.id,
                                        subject: slot.subject,
                                        fromTime: slot.fromTime,
                                        toTime: slot.toTime,
                                        locationName: slot.location.name,
                                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                        originalStatus: 'No', // Default to 'No' if location access fails
                                        status: 'No',
                                        isModified: false,
                                        doNotConsider: false,
                                        midpointChecked: true,
                                        earlyNotificationSent: true
                                    };
                                    todayAttendance.push(attendanceRecord);
                                    await attendanceDocRef.set({ records: todayAttendance }, { merge: true });
                                    showMessageBox(`Could not get your location for ${slot.subject}. Attendance marked 'No'. Please ensure location permissions are enabled.`);
                                    updateDashboard();
                                    renderAttendanceHistory(todayDate.slice(0, 7));
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error during attendance check:", error);
        }
    }, ATTENDANCE_CHECK_INTERVAL_MS); // Check every minute
}

/**
 * Stops the attendance checking interval.
 */
function stopAttendanceChecking() {
    if (attendanceCheckInterval) {
        clearInterval(attendanceCheckInterval);
        attendanceCheckInterval = null;
    }
}

// --- Reporting and Dashboard ---

async function updateDashboard() {
    if (!currentUser) return;

    const today = new Date();
    const todayDateStr = formatDate(today);
    const currentMonth = todayDateStr.slice(0, 7); // YYYY-MM

    // Fetch user's min attendance percent
    const userDocRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userDocRef.get();
    const minAttendancePercent = userDoc.exists ? (userDoc.data().minAttendancePercent || 0) : 0;

    // Update Today's Attendance Table
    const todayAttendanceTableBody = document.getElementById('today-attendance-table').querySelector('tbody');
    todayAttendanceTableBody.innerHTML = ''; // Clear previous entries

    try {
        const attendanceDocRef = db.collection('users').doc(currentUser.uid)
                                   .collection('attendance').doc(todayDateStr);
        const doc = await attendanceDocRef.get();

        const todayRecords = doc.exists ? doc.data().records || [] : [];
        if (todayRecords.length === 0) {
            todayAttendanceTableBody.innerHTML = '<tr><td colspan="4">No attendance recorded for today.</td></tr>';
        } else {
            // Sort records by time
            todayRecords.sort((a, b) => a.fromTime.localeCompare(b.fromTime));

            todayRecords.forEach(record => {
                const tr = document.createElement('tr');
                const statusClass = record.status === 'Yes' ? 'status-yes' : 'status-no';
                const modifiedText = record.isModified ? '<span class="status-modified">(Modified)</span>' : '';
                tr.innerHTML = `
                    <td>${record.fromTime}-${record.toTime}</td>
                    <td>${record.subject}</td>
                    <td class="${statusClass}">${record.status} ${modifiedText}</td>
                    <td>${record.originalStatus}</td>
                `;
                todayAttendanceTableBody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Error fetching today's attendance:", error);
        todayAttendanceTableBody.innerHTML = '<tr><td colspan="4">Error loading today\'s attendance.</td></tr>';
    }

    // Calculate Monthly Attendance Percentages
    let totalConsideredSlotsModified = 0;
    let attendedSlotsModified = 0;
    let totalConsideredSlotsOriginal = 0;
    let attendedSlotsOriginal = 0;

    const attendanceCollectionRef = db.collection('users').doc(currentUser.uid).collection('attendance');
    const attendanceSnap = await attendanceCollectionRef.get();

    attendanceSnap.docs.forEach(doc => {
        if (doc.id.startsWith(currentMonth)) {
            const records = doc.data().records || [];
            records.forEach(record => {
                if (!record.doNotConsider) {
                    // Modified calculation
                    totalConsideredSlotsModified++;
                    if (record.status === 'Yes') {
                        attendedSlotsModified++;
                    }

                    // Original calculation
                    totalConsideredSlotsOriginal++;
                    if (record.originalStatus === 'Yes') {
                        attendedSlotsOriginal++;
                    }
                }
            });
        }
    });

    const modifiedPercent = totalConsideredSlotsModified > 0 ? ((attendedSlotsModified / totalConsideredSlotsModified) * 100).toFixed(2) : 0;
    const originalPercent = totalConsideredSlotsOriginal > 0 ? ((attendedSlotsOriginal / totalConsideredSlotsOriginal) * 100).toFixed(2) : 0;

    document.getElementById('monthly-modified-percent').textContent = `${modifiedPercent}%`;
    document.getElementById('monthly-original-percent').textContent = `${originalPercent}%`;

    // Check for notification if percentage drops below minimum
    if (minAttendancePercent > 0) {
        if (modifiedPercent < minAttendancePercent) {
            sendNotification(
                'Attendance Warning (Modified)!',
                `Your modified attendance is ${modifiedPercent}%, which is below your minimum required ${minAttendancePercent}%.`
            );
        }
        if (originalPercent < minAttendancePercent) {
            sendNotification(
                'Attendance Warning (Original)!',
                `Your original attendance is ${originalPercent}%, which is below your minimum required ${minAttendancePercent}%.`
            );
        }
    }
}


async function renderAttendanceHistory(monthYear) {
    if (!currentUser) return;
    const attendanceHistoryTableBody = document.getElementById('attendance-history-table').querySelector('tbody');
    attendanceHistoryTableBody.innerHTML = ''; // Clear previous entries

    try {
        const attendanceCollectionRef = db.collection('users').doc(currentUser.uid).collection('attendance');
        const querySnapshot = await attendanceCollectionRef.get(); // Get all documents, then filter client-side

        let recordsToDisplay = [];
        querySnapshot.docs.forEach(doc => {
            if (doc.id.startsWith(monthYear)) {
                const date = doc.id; // YYYY-MM-DD
                const dayRecords = doc.data().records || [];
                dayRecords.forEach(record => {
                    recordsToDisplay.push({ date, ...record });
                });
            }
        });

        if (recordsToDisplay.length === 0) {
            attendanceHistoryTableBody.innerHTML = '<tr><td colspan="6">No attendance recorded for this month.</td></tr>';
            return;
        }

        // Sort records by date then by time
        recordsToDisplay.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.fromTime}`);
            const dateB = new Date(`${b.date}T${b.fromTime}`);
            return dateA - dateB;
        });

        recordsToDisplay.forEach(record => {
            const tr = document.createElement('tr');
            const statusClass = record.status === 'Yes' ? 'status-yes' : 'status-no';
            const modifiedIndicator = record.isModified ? '<span class="status-modified"> (Modified)</span>' : '';
            const doNotConsiderText = record.doNotConsider ? '<br><span class="status-modified">(Not Considered)</span>' : '';

            tr.innerHTML = `
                <td>${record.date}</td>
                <td>${record.fromTime}-${record.toTime}</td>
                <td>${record.subject}</td>
                <td class="${statusClass}">${record.status}${modifiedIndicator}${doNotConsiderText}</td>
                <td>${record.originalStatus}</td>
                <td>
                    <button class="action-btn toggle-status-btn" data-date="${record.date}" data-slot-id="${record.slotId}" data-current-status="${record.status}">Toggle Status</button>
                    <button class="action-btn not-consider-btn" data-date="${record.date}" data-slot-id="${record.slotId}" data-do-not-consider="${record.doNotConsider}">Toggle Consider</button>
                </td>
            `;
            attendanceHistoryTableBody.appendChild(tr);
        });

        // Attach event listeners to action buttons
        attendanceHistoryTableBody.querySelectorAll('.toggle-status-btn').forEach(button => {
            button.onclick = (event) => toggleAttendanceStatus(event.target.dataset.date, event.target.dataset.slotId);
        });
        attendanceHistoryTableBody.querySelectorAll('.not-consider-btn').forEach(button => {
            button.onclick = (event) => toggleDoNotConsider(event.target.dataset.date, event.target.dataset.slotId);
        });

    } catch (error) {
        console.error("Error fetching attendance history:", error);
        attendanceHistoryTableBody.innerHTML = '<tr><td colspan="6">Error loading attendance history.</td></tr>';
    }
}


async function toggleAttendanceStatus(date, slotId) {
    if (!currentUser) return;
    try {
        const attendanceDocRef = db.collection('users').doc(currentUser.uid)
                                   .collection('attendance').doc(date);
        const doc = await attendanceDocRef.get();
        if (doc.exists) {
            let records = doc.data().records || [];
            const recordIndex = records.findIndex(r => r.slotId === slotId);

            if (recordIndex !== -1) {
                const currentRecord = records[recordIndex];
                currentRecord.status = currentRecord.status === 'Yes' ? 'No' : 'Yes';
                currentRecord.isModified = true; // Mark as modified
                await attendanceDocRef.update({ records: records });
                showMessageBox('Attendance status updated.');
                updateDashboard();
                renderAttendanceHistory(date.slice(0, 7)); // Refresh the view
            }
        }
    } catch (error) {
        showMessageBox(`Error updating attendance status: ${error.message}`);
    }
}

async function toggleDoNotConsider(date, slotId) {
    if (!currentUser) return;
    try {
        const attendanceDocRef = db.collection('users').doc(currentUser.uid)
                                   .collection('attendance').doc(date);
        const doc = await attendanceDocRef.get();
        if (doc.exists) {
            let records = doc.data().records || [];
            const recordIndex = records.findIndex(r => r.slotId === slotId);

            if (recordIndex !== -1) {
                const currentRecord = records[recordIndex];
                currentRecord.doNotConsider = !currentRecord.doNotConsider; // Toggle the flag
                await attendanceDocRef.update({ records: records });
                showMessageBox('Slot consideration status updated.');
                updateDashboard();
                renderAttendanceHistory(date.slice(0, 7)); // Refresh the view
            }
        }
    } catch (error) {
        showMessageBox(`Error updating 'do not consider' status: ${error.message}`);
    }
}


// --- Event Listeners and Initial Setup ---

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase(); // Initialize Firebase on DOM load

    // Auth Section
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Tab Navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}-tab`).style.display = 'block';

            // Refresh specific tabs when activated
            if (button.dataset.tab === 'dashboard') {
                updateDashboard();
            } else if (button.dataset.tab === 'settings' && currentUser) {
                loadUserData(); // Reload subjects for settings tab
            } else if (button.dataset.tab === 'schedule' && currentUser) {
                loadUserData(); // Reload subjects and schedule for schedule tab
            } else if (button.dataset.tab === 'attendance-view' && currentUser) {
                const today = new Date();
                const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                document.getElementById('attendance-month-select').value = yearMonth;
                renderAttendanceHistory(yearMonth);
            }
        });
    });

    // Settings Tab
    document.getElementById('save-min-percent-btn').addEventListener('click', saveMinAttendancePercent);
    document.getElementById('add-subject-btn').addEventListener('click', addSubject);

    // Schedule Tab
    document.getElementById('add-slot-form').addEventListener('submit', addScheduleSlot);

    // Attendance View Tab
    document.getElementById('attendance-month-select').addEventListener('change', (event) => {
        renderAttendanceHistory(event.target.value);
    });
});

// Request Notification permission as early as possible
if ("Notification" in window) {
    Notification.requestPermission();
}