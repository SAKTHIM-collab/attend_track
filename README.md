Attendance Tracker App
A straightforward web application to help you track your attendance based on your location and a predefined schedule.

Features
User Accounts: Easy sign-up and login using email and password.

Customizable Schedule:

Set overall schedule dates.

Define a minimum attendance percentage.

Manage your subjects.

Create daily time slots (Mon-Fri) with specific times, subjects, and a designated location (using Google Maps).

Automatic Attendance: The app checks your location at the halfway point of each slot to mark attendance automatically.

Attendance Overview: View daily schedules and a full attendance history, clearly showing attended/not attended.

Manual Adjustments: Option to manually change attendance status (marked as "Modified") or exclude specific slots from calculations.

Alerts: Get notifications for late arrivals or if your attendance falls below your set target.

Technologies
Frontend: HTML, CSS, JavaScript (Vanilla JS)

Backend: Firebase (Authentication, Cloud Firestore)

APIs: Google Maps, Browser Geolocation, Browser Notifications



Setup & Running
Clone: git clone https://github.com/SAKTHIM-collab/attend_track.git

Firebase:

Create a Firebase project.

Register a web app and copy your firebaseConfig.

Enable Email/Password Auth and set up Firestore with appropriate security rules (/users/{userId}/{document=**}).

Google Maps API: Get an API key from Google Cloud Console and enable Maps JavaScript API and Places API. Restrict your key for security.

Configure Files:

In public/js/app.js, replace firebaseConfig with your actual Firebase details.

In public/index.html, replace YOUR_GOOGLE_MAPS_API_KEY in the script URL.

Install CLI: npm install -g firebase-tools then firebase login.

Initialize Hosting: From project root, firebase init hosting (use public as directory).

Run Locally: firebase serve --only hosting (usually http://localhost:5000).

Deploy: firebase deploy --only hosting

Important Notes
Location Tracking: Browser limitations mean continuous background location tracking is not feasible for web apps. The app works best when the tab is active.

Notifications: Browser notifications require user permission.
