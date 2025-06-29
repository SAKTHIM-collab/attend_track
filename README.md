Attendance Tracker App
A progressive web application designed to help users track their attendance based on their geographical location and a predefined academic schedule. This app ensures you're where you need to be, when you need to be there, and keeps a clear record of your presence.

Features
User Authentication: Secure sign-up and login using email and password, powered by Firebase Authentication.

Flexible Schedule Setup:

Define an overall academic span (start and end dates).

Set a custom minimum attendance percentage target to maintain.

Manage a list of subjects.

Create daily time slots (Monday to Friday) with specific start/end times, associated subjects, and a designated physical location (chosen via Google Maps).

Automated Attendance Marking: The app intelligently checks your live location at the halfway point of each scheduled slot. Attendance is automatically marked "Yes" if you are within a predefined radius of the designated location, and "No" otherwise.

Comprehensive Attendance View:

View daily schedules with real-time attendance status updates.

Access a full attendance history in a clear, tabular format, color-coded (green for attended, red for not attended).

Manual Modification & Exclusion:

Users can manually override attendance marks (e.g., change "No" to "Yes"). These modifications are clearly marked in the history.

Option to mark specific slots as "Do Not Consider" to exclude them from percentage calculations (e.g., for holidays or cancelled classes).

Smart Notifications:

Late Arrival Reminders: Receive a notification if you are not in the specified location within the first 10 minutes of a scheduled slot.

Low Attendance Alerts: Get notified if your attendance percentage (both with and without modifications) falls below your set minimum threshold for the month.

Technologies Used
Frontend:

HTML5 for structure.

CSS3 for styling (including responsive design).

Vanilla JavaScript for application logic and dynamic content.

Backend:

Firebase Authentication: Handles user registration, login, and session management.

Cloud Firestore: A NoSQL cloud database used for storing all user-specific data, including settings, subjects, schedules, and attendance records.

APIs & Libraries:

Google Maps JavaScript API: Integrated for visually selecting and saving geographical locations for schedule slots.

Browser Geolocation API: Used to retrieve the user's current location for attendance checks.

Browser Notification API: Delivers timely reminders and alerts to the user.

Firebase SDK (Compatibility versions for direct script inclusion).

Project Structure
attend_track/
├── .gitignore          
├── README.md           
├── firebase.json       
├── .firebaserc         
└── public/            
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js      
    │   ├── auth.js    
    │   ├── firestore.js
    │   ├── schedule.js
    │   ├── attendance.js 
    │   └── utils.js    
    └── index.html      

Setup Instructions
Follow these steps to get the Attendance Tracker app running on your local machine.

1. Clone the Repository
First, clone this GitHub repository to your local machine:

git clone [https://github.com/SAKTHIM-collab/attend_track.git](https://github.com/SAKTHIM-collab/attend_track.git)
cd attend_track

2. Firebase Project Setup
This application relies heavily on Firebase for authentication and data storage.

Create a Firebase Project:

Go to the Firebase Console.

Click "Add project" or "Create a project" and follow the prompts to create a new project (e.g., attend-tracker-app).

Register a Web App:

Inside your Firebase project, click the "Web" icon (</>) to add a new web app.

Follow the setup steps. Crucially, when prompted, copy the firebaseConfig object. You will need this in a later step.

You can skip the firebase deploy step for now.

Enable Firebase Authentication (Email/Password):

In the Firebase Console, navigate to "Build" > "Authentication".

Go to the "Sign-in method" tab.

Enable the Email/Password provider.

Set up Cloud Firestore Database:

In the Firebase Console, navigate to "Build" > "Firestore Database".

Click "Create database". Choose "Start in production mode" (we'll set security rules next). Select your desired data location.

Go to the "Rules" tab and replace the default rules with the following to allow authenticated users to read and write their own data:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write their own specific data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

Click "Publish" to apply these rules.

3. Google Maps API Key Setup
The application uses Google Maps for location selection in the schedule.

Get an API Key:

Go to the Google Cloud Console and select the Google Cloud project associated with your Firebase project.

Navigate to "APIs & Services" > "Credentials".

Click "CREATE CREDENTIALS" > "API key". Copy the generated API key.

Enable Required APIs:

In the "APIs & Services" > "Dashboard", ensure the following APIs are enabled for your project:

Maps JavaScript API

Places API

Restrict Your API Key (Recommended for Security!):

Back in "Credentials", click on the API key you just created.

Under "Application restrictions", select "HTTP referrers (web sites)".

Add your deployment domain (e.g., *.your-firebase-project-id.web.app/*) and your local development server (http://localhost:5000/*).

Under "API restrictions", select "Restrict key" and choose Maps JavaScript API and Places API from the dropdown list.

Click "Save".

4. Configure Your Application Files
Now, update the cloned project files with your new API keys and Firebase configuration.

public/js/app.js:

Open public/js/app.js.

Replace the firebaseConfig object with the exact one you copied from the Firebase Console (Step 2.2):

// public/js/app.js
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY", // <-- Replace this
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // <-- Replace this
    projectId: "YOUR_PROJECT_ID", // <-- Replace this
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

public/index.html:

Open public/index.html.

Replace AIzaSyDDHow9gfzMYRa27-9tL53KXFucnIEn1sA in the Google Maps script URL with your actual Google Maps API Key (Step 3.1):

<!-- public/index.html -->
<script async defer src="[https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap](https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap)"></script>

5. Install Firebase CLI
If you haven't already, install the Firebase Command Line Interface globally and log in:

npm install -g firebase-tools
firebase login

6. Initialize Firebase Hosting (Local)
From the root of your attend_track project directory:

firebase init hosting

Follow the prompts:

"Are you ready to proceed? (Y/n)" Y

"Please select a Firebase project:" Choose the project you created.

"What do you want to use as your public directory? (public)" public (Press Enter)

"Configure as a single-page app (rewrite all urls to /index.html)? (y/N)" N

"Set up automatic builds and deploys with GitHub? (y/N)" N

This will create firebase.json and .firebaserc files in your project root.

Running the Application Locally
Once all setup and configuration steps are complete, you can run the app locally:

firebase serve --only hosting

Open your web browser and navigate to the local URL provided by the Firebase CLI (typically http://localhost:5000).

Deployment
To deploy your application to Firebase Hosting for public access:

firebase deploy --only hosting

Firebase will deploy your application, and you can access it via a URL like https://YOUR_PROJECT_ID.web.app.

Important Notes on Web Geolocation & Notifications
Browser Limitations for Background Location: Due to browser security and privacy restrictions, continuous background geolocation tracking in web applications is severely limited, especially when the browser tab is not active or the device's screen is off. This application is designed to check location primarily when the tab is in the foreground. For true, persistent background tracking, a native mobile application would be required.

Notification Permissions: Browser notifications require explicit user permission. The app will prompt for this permission on first load. If permissions are denied, notifications will fall back to displaying messages within the application's UI.

Feel free to contribute
