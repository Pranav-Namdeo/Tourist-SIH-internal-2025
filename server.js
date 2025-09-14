// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const API_BASE_URL = `http://localhost:${PORT}/api`;

// Create 'uploads' directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.fieldname}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(__dirname)); // Serve static files (like your HTML) from the current directory

// In-memory "database"
let tourists = []; // Stores registered tourist data
let departmentAlerts = []; // Stores alerts sent by department, visible in department history
let efirReports = []; // Stores E-FIR and SOS reports

// --- Initial Mock Data for Department Dashboard (Static for demonstration) ---
// Standardize time to Date objects for easier sorting and filtering
const initialDepartmentAlerts = [
    { id: 'ALERT-D001', time: new Date('2025-09-12T10:23:00').toISOString(), tourist: 'Iron Man', location: '25.3456, 82.3452', type: 'Geo-fence Breach', status: 'Urgent', title: 'Geo-fence Breach', message: 'Iron Man breached geo-fence near Sector 10.' },
    { id: 'ALERT-D002', time: new Date('2025-09-12T10:15:00').toISOString(), tourist: 'Hulk', location: '26.8456, 80.9467', type: 'Panic Button', status: 'Responded', title: 'Panic Button Activated', message: 'Hulk activated panic button in Gomti Nagar.' },
    { id: 'ALERT-D003', time: new Date('2025-09-12T09:58:00').toISOString(), tourist: 'Wanda', location: '25.7890, 81.2345', type: 'Red Zone Alert', status: 'Monitoring', title: 'Red Zone Entry', message: 'Wanda entered a restricted red zone.' },
    { id: 'ALERT-D004', time: new Date('2025-09-11T09:42:00').toISOString(), tourist: 'Thor', location: '26.9234, 81.9876', type: 'Route Deviation', status: 'Resolved', title: 'Route Deviation Alert', message: 'Thor deviated from planned route.' },
    { id: 'ALERT-D005', time: new Date('2025-09-11T09:30:00').toISOString(), tourist: 'Thanos', location: '25.1234, 82.5432', type: 'Automatic E-FIR', status: 'In Progress', title: 'Automatic E-FIR Filed', message: 'Thanos filed an automatic E-FIR due to an incident.' },
];

const initialDigitalIdVerifications = [
    { id: 'VER-001', touristName: 'Dr Strange', idType: 'Aadhaar', verificationTime: new Date('2025-09-12T10:40:00').toLocaleString(), location: 'Hotel Grand', status: 'Verified' },
    { id: 'VER-002', touristName: 'Black Widow', idType: 'Passport', verificationTime: new Date('2025-09-12T10:22:00').toLocaleString(), location: 'Airport', status: 'Verified' },
    { id: 'VER-003', touristName: 'Spiderman', idType: 'Aadhaar', verificationTime: new Date('2025-09-11T09:55:00').toLocaleString(), location: 'Railway Station', status: 'Pending' },
    { id: 'VER-004', touristName: 'Ant Man', idType: 'Passport', verificationTime: new Date('2025-09-11T09:30:00').toLocaleString(), location: 'Hotel Plaza', status: 'Verified' },
];

const initialEfirReports = [
    { id: '#SOS-1245', touristId: 'T001', touristName: 'Tony Stark', type: 'SOS Emergency', time: new Date('2025-09-12T10:23:00').toISOString(), location: { lat: 25.3456, lng: 82.3452 }, priority: 'Critical', status: 'Pending', description: 'Tourist reported being followed by suspicious individuals near the market area. Feels unsafe and requested immediate assistance.', officerNotes: 'Patrol unit dispatched to location. Tourist is currently safe at a nearby cafe until officers arrive.' },
    { id: '#EFIR-7890', touristId: 'T002', touristName: 'Natasha Romanoff', type: 'Theft', time: new Date('2025-09-12T09:45:00').toISOString(), location: { lat: 26.8456, lng: 80.9467 }, priority: 'Medium', status: 'In Progress', description: 'Wallet stolen from handbag at local market.', officerNotes: 'Report filed, suspect description taken. CCTV footage being reviewed.' },
    { id: '#SOS-1246', touristId: 'T003', touristName: 'Thor Odinson', type: 'SOS Emergency', time: new Date('2025-09-12T09:30:00').toISOString(), location: { lat: 25.7890, lng: 81.2345 }, priority: 'Critical', status: 'In Progress', description: 'Tourist fell and injured leg during hiking. Cannot move.', officerNotes: 'Rescue team dispatched. Medical assistance en route.' },
    { id: '#EFIR-7891', touristId: 'T004', touristName: 'Bruce Banner', type: 'Harassment', time: new Date('2025-09-11T16:15:00').toISOString(), location: { lat: 26.9234, lng: 81.9876 }, priority: 'Medium', status: 'Resolved', description: 'Verbal harassment by street vendor.', officerNotes: 'Vendor identified and warned. Tourist provided counseling.' },
    { id: '#EFIR-7892', touristId: 'T005', touristName: 'Wanda Maximoff', type: 'Lost Item', time: new Date('2025-09-11T14:30:00').toISOString(), location: { lat: 25.1234, lng: 82.5432 }, priority: 'Low', status: 'Resolved', description: 'Lost backpack with personal belongings at tourist attraction.', officerNotes: 'Backpack found and returned to tourist.' },
];
// Merge initial data into dynamic arrays where appropriate
departmentAlerts.push(...initialDepartmentAlerts);
efirReports.push(...initialEfirReports);

// Initial mock tourists for the department profiles and map
tourists.push(
    {
        id: 'T001', digitalID: 'TRV-TS1234-5678', fullName: 'Tony Stark', password: 'password', idType: 'Passport', idNumber: 'C78945612', documentPath: null,
        emergencyContacts: [{ id: 'EC1', name: 'Pepper Potts', number: '+91 9876543210', relation: 'Spouse' }],
        locationSharing: true, sharedWith: [], currentLocation: { lat: 25.3456, lng: 82.3452 },
        alerts: [{ id: `A${Date.now()}-1`, type: 'info', title: 'Welcome', message: 'Hi Tony!', time: new Date(Date.now() - 3600000).toISOString(), unread: true }],
        nationality: 'United States', arrivalDate: '12 Oct 2023', status: 'Active'
    },
    {
        id: 'T002', digitalID: 'TRV-NR5678-9012', fullName: 'Natasha Romanoff', password: 'password', idType: 'Passport', idNumber: 'R65478932', documentPath: null,
        emergencyContacts: [{ id: 'EC2', name: 'Nick Fury', number: '+91 9876543213', relation: 'Colleague' }],
        locationSharing: false, sharedWith: [], currentLocation: { lat: 26.8456, lng: 80.9467 },
        alerts: [{ id: `A${Date.now()}-2`, type: 'info', title: 'Welcome', message: 'Hi Natasha!', time: new Date(Date.now() - 7200000).toISOString(), unread: false }],
        nationality: 'Russia', arrivalDate: '14 Oct 2023', status: 'Active'
    },
    {
        id: 'T003', digitalID: 'TRV-TO3456-1234', fullName: 'Thor Odinson', password: 'password', idType: 'Aadhaar', idNumber: '789456123456', documentPath: null,
        emergencyContacts: [{ id: 'EC3', name: 'Loki', number: '+91 9876543214', relation: 'Brother' }],
        locationSharing: true, sharedWith: [], currentLocation: { lat: 25.7890, lng: 81.2345 },
        alerts: [{ id: `A${Date.now()}-3`, type: 'info', title: 'Welcome', message: 'Hi Thor!', time: new Date(Date.now() - 10800000).toISOString(), unread: true }],
        nationality: 'Norway', arrivalDate: '10 Oct 2023', status: 'Restricted'
    },
    {
        id: 'T004', digitalID: 'TRV-BB7890-5432', fullName: 'Bruce Banner', password: 'password', idType: 'Passport', idNumber: 'A12345678', documentPath: null,
        emergencyContacts: [{ id: 'EC4', name: 'Betty Ross', number: '+91 9876543215', relation: 'Friend' }],
        locationSharing: true, sharedWith: [], currentLocation: { lat: 26.9234, lng: 81.9876 },
        alerts: [{ id: `A${Date.now()}-4`, type: 'info', title: 'Welcome', message: 'Hi Bruce!', time: new Date(Date.now() - 14400000).toISOString(), unread: false }],
        nationality: 'United States', arrivalDate: '11 Oct 2023', status: 'Active'
    },
    {
        id: 'T005', digitalID: 'TRV-WM9012-8765', fullName: 'Wanda Maximoff', password: 'password', idType: 'Visa', idNumber: 'V98765432', documentPath: null,
        emergencyContacts: [{ id: 'EC5', name: 'Vision', number: '+91 9876543216', relation: 'Partner' }],
        locationSharing: false, sharedWith: [], currentLocation: { lat: 25.1234, lng: 82.5432 },
        alerts: [{ id: `A${Date.now()}-5`, type: 'info', title: 'Welcome', message: 'Hi Wanda!', time: new Date(Date.now() - 18000000).toISOString(), unread: true }],
        nationality: 'Sokovia', arrivalDate: '13 Oct 2023', status: 'Inactive'
    },
    {
        id: 'T006', digitalID: 'TRV-JS4321-9876', fullName: 'Jane Smith', password: 'password', idType: 'Passport', idNumber: 'P10293847', documentPath: null,
        emergencyContacts: [{ id: 'EC6', name: 'John Doe', number: '+91 9988776655', relation: 'Friend' }],
        locationSharing: true, sharedWith: [], currentLocation: { lat: 27.1751, lng: 78.0421 }, // Agra
        alerts: [{ id: `A${Date.now()}-6`, type: 'info', title: 'Hello', message: 'Welcome to India!', time: new Date(Date.now() - 2400000).toISOString(), unread: true }],
        nationality: 'Canada', arrivalDate: '01 Nov 2023', status: 'Active'
    },
    {
        id: 'T007', digitalID: 'TRV-AK9876-5432', fullName: 'Alice King', password: 'password', idType: 'Aadhaar', idNumber: '112233445566', documentPath: null,
        emergencyContacts: [],
        locationSharing: false, sharedWith: [], currentLocation: null,
        alerts: [{ id: `A${Date.now()}-7`, type: 'info', title: 'Alert', message: 'Check your profile.', time: new Date(Date.now() - 1200000).toISOString(), unread: false }],
        nationality: 'Australia', arrivalDate: '05 Sep 2023', status: 'Inactive'
    },
    {
        id: 'T008', digitalID: 'TRV-PM8765-4321', fullName: 'Peter Miller', password: 'password', idType: 'Passport', idNumber: 'F09876543', documentPath: null,
        emergencyContacts: [{ id: 'EC7', name: 'Mary Jane', number: '+91 7778889990', relation: 'Family' }],
        locationSharing: true, sharedWith: [], currentLocation: { lat: 28.6139, lng: 77.2090 }, // Delhi
        alerts: [{ id: `A${Date.now()}-8`, type: 'warning', title: 'Advisory', message: 'Heavy rain expected.', time: new Date(Date.now() - 600000).toISOString(), unread: true }],
        nationality: 'United Kingdom', arrivalDate: '20 Oct 2023', status: 'Active'
    }
);


// --- Utility Functions ---
function generateDigitalID(name) {
    const nameParts = name.trim().toUpperCase().split(' ');
    let initials = '';
    if (nameParts.length === 1) {
        initials = nameParts[0].substring(0, 2);
    } else {
        initials = nameParts[0].substring(0, 1) + nameParts[nameParts.length - 1].substring(0, 1);
    }
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
    return `TRV-${initials}${randomNum}-${timestamp}`;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

let latestOTP = ''; // Simulated OTP storage

// --- API Endpoints for Tourist (App) ---

// Tourist Signup
app.post('/api/auth/signup', upload.single('document'), (req, res) => {
    const { idNumber, fullName, password, verificationMethod } = req.body; // verificationMethod is actually idType
    const documentPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!idNumber || !fullName || !password || !verificationMethod) {
        return res.status(400).json({ message: 'All required fields are missing.' });
    }

    if (tourists.some(t => t.idNumber === idNumber && t.idType === verificationMethod)) {
        return res.status(409).json({ message: 'Tourist with this ID and verification method already exists.' });
    }

    const digitalID = generateDigitalID(fullName);
    const newTourist = {
        id: `T${Date.now()}-${Math.floor(Math.random() * 1E5)}`, // More unique ID
        digitalID,
        idNumber,
        fullName,
        password,
        idType: verificationMethod, // Store as idType
        documentPath,
        emergencyContacts: [],
        locationSharing: false,
        sharedWith: [],
        currentLocation: null,
        alerts: [{ id: `A${Date.now()}`, type: 'info', title: 'Welcome to TRAVIQ', message: 'Your TRAVIQ Digital Identity has been successfully verified and activated. Stay safe!', time: new Date().toISOString(), unread: true }],
        nationality: 'Unknown', // Can be updated later
        arrivalDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: 'Active'
    };
    tourists.push(newTourist);

    res.status(201).json({ message: 'Tourist registered successfully!', id: newTourist.id, digitalID: newTourist.digitalID });
});

// Send OTP
app.post('/api/auth/send-otp', (req, res) => {
    // In a real app, you'd send an actual SMS/email.
    // For this demo, we just log it.
    latestOTP = generateOTP();
    console.log(`Simulated OTP for ${req.body.idNumber}: ${latestOTP}`);
    res.status(200).json({ message: 'OTP sent successfully (simulated).' });
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    const { otp } = req.body;
    // Simple check, in real app would use a session or timestamp for OTP expiry
    if (otp === latestOTP) {
        res.status(200).json({ message: 'OTP verified successfully.' });
        latestOTP = ''; // Clear OTP after successful verification (for this simple demo)
    } else {
        res.status(400).json({ message: 'Invalid OTP.' });
    }
});

// Tourist Login
app.post('/api/auth/login', (req, res) => {
    const { digitalID, password } = req.body;

    const tourist = tourists.find(t => t.digitalID === digitalID && t.password === password);
    if (tourist) {
        res.status(200).json({ message: 'Login successful!', tourist: { id: tourist.id, fullName: tourist.fullName, digitalID: tourist.digitalID, currentLocation: tourist.currentLocation, locationSharing: tourist.locationSharing } });
    } else {
        res.status(401).json({ message: 'Invalid Digital ID or password.' });
    }
});

// SOS Emergency
app.post('/api/tourist/:id/sos', (req, res) => {
    const { id } = req.params;
    const { location } = req.body;
    const tourist = tourists.find(t => t.id === id);

    if (tourist) {
        const sosReport = {
            id: `#SOS-${Date.now()}-${Math.floor(Math.random() * 1E5)}`,
            touristId: tourist.id,
            touristName: tourist.fullName,
            type: 'SOS Emergency',
            time: new Date().toISOString(),
            location: location || tourist.currentLocation || { lat: 0, lng: 0 },
            priority: 'Critical',
            status: 'Pending',
            description: 'Tourist initiated SOS. Immediate assistance required.',
            officerNotes: 'Automatic SOS received. Awaiting response.'
        };
        efirReports.unshift(sosReport); // Add to the beginning of the list

        departmentAlerts.unshift({
            id: `DEPT-ALERT-${Date.now()}-${Math.floor(Math.random() * 1E5)}`,
            time: new Date().toISOString(),
            tourist: tourist.fullName,
            location: typeof location === 'object' ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : (tourist.currentLocation ? `${tourist.currentLocation.lat.toFixed(4)}, ${tourist.currentLocation.lng.toFixed(4)}` : 'Unknown'),
            type: 'SOS Emergency',
            status: 'Urgent',
            title: 'SOS Emergency Activated',
            message: `Tourist ${tourist.fullName} activated SOS at ${typeof location === 'object' ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : (tourist.currentLocation ? `${tourist.currentLocation.lat.toFixed(4)}, ${tourist.currentLocation.lng.toFixed(4)}` : 'Unknown')}. Immediate attention needed.`
        });

        // Add an alert to the tourist's personal alert list
        tourist.alerts.unshift({
            id: `A${Date.now()}-${Math.floor(Math.random() * 1E5)}`,
            type: 'emergency',
            title: 'SOS Activated',
            message: 'Your SOS signal has been sent. Emergency services and your contacts have been notified.',
            time: new Date().toISOString(),
            unread: true
        });

        res.status(200).json({ message: 'SOS activated. Emergency services and contacts notified.' });
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Update Tourist Location
app.post('/api/tourist/:id/location', (req, res) => {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const tourist = tourists.find(t => t.id === id);

    if (tourist) {
        tourist.currentLocation = { lat, lng };
        res.status(200).json({ message: 'Location updated.' });
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Get Tourist Location
app.get('/api/tourist/:id/location', (req, res) => {
    const { id } = req.params;
    const tourist = tourists.find(t => t.id === id);
    if (tourist) {
        res.status(200).json({ location: tourist.currentLocation, locationSharing: tourist.locationSharing });
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Toggle location sharing
app.post('/api/tourist/:id/toggle-location-sharing', (req, res) => {
    const { id } = req.params;
    const { sharingActive } = req.body;
    const tourist = tourists.find(t => t.id === id);

    if (tourist) {
        tourist.locationSharing = sharingActive;
        res.status(200).json({ message: `Location sharing ${sharingActive ? 'enabled' : 'disabled'}.`, locationSharing: tourist.locationSharing });
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Get Emergency Contacts
app.get('/api/tourist/:id/contacts', (req, res) => {
    const { id } = req.params;
    const tourist = tourists.find(t => t.id === id);
    if (tourist) {
        res.status(200).json(tourist.emergencyContacts);
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Add Emergency Contact
app.post('/api/tourist/:id/contacts', (req, res) => {
    const { id } = req.params;
    const { name, number, relation } = req.body;
    const tourist = tourists.find(t => t.id === id);

    if (tourist) {
        if (!name || !number) {
            return res.status(400).json({ message: 'Name and number are required for a contact.' });
        }
        const newContact = { id: `EC${Date.now()}-${Math.floor(Math.random() * 1E5)}`, name, number, relation };
        tourist.emergencyContacts.push(newContact);
        res.status(201).json({ message: 'Contact added successfully!', contact: newContact });
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Get Tourist Alerts
app.get('/api/tourist/:id/alerts', (req, res) => {
    const { id } = req.params;
    const tourist = tourists.find(t => t.id === id);
    if (tourist) {
        // Sort alerts by time, newest first
        res.status(200).json(tourist.alerts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    } else {
        res.status(404).json({ message: 'Tourist not found.' });
    }
});

// Mark tourist alert as read
app.put('/api/tourist/:touristId/alerts/:alertId/read', (req, res) => {
    const { touristId, alertId } = req.params;
    const tourist = tourists.find(t => t.id === touristId);

    if (tourist) {
        const alert = tourist.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.unread = false;
            return res.status(200).json({ message: 'Alert marked as read.' });
        }
    }
    res.status(404).json({ message: 'Tourist or Alert not found.' });
});

// --- API Endpoints for Department (Dashboard) ---

// Department Dashboard Stats
app.get('/api/department/dashboard/stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const activeTourists = tourists.filter(t => t.currentLocation !== null && t.status === 'Active').length;
    const alertsToday = departmentAlerts.filter(a => a.time.startsWith(today)).length;
    const efirToday = efirReports.filter(r => r.time.startsWith(today)).length;

    res.status(200).json({
        activeTourists: activeTourists,
        alertsToday: alertsToday,
        efirReports: efirToday,
    });
});

// Department Map Data
app.get('/api/department/dashboard/map-data', (req, res) => {
    const touristLocations = tourists.filter(t => t.currentLocation && t.locationSharing).map(t => ({
        id: t.id,
        name: t.fullName,
        lat: t.currentLocation.lat,
        lng: t.currentLocation.lng,
        type: 'tourist'
    }));

    const highRiskZones = [
        { id: 'HRZ1', name: 'Market Square', lat: 25.4, lng: 82.2, radius: 500, type: 'high-risk' },
        { id: 'HRZ2', name: 'Old Town', lat: 26.9, lng: 81.0, radius: 700, type: 'high-risk' },
    ];

    const restrictedAreas = [
        { id: 'RA1', name: 'Military Base', lat: 25.1, lng: 82.5, type: 'restricted' },
    ];

    res.status(200).json({
        touristLocations,
        highRiskZones,
        restrictedAreas,
    });
});

// Department Chart Data
app.get('/api/department/dashboard/charts-data', (req, res) => {
    // This mock data does not dynamically change based on date range for this demo.
    res.status(200).json({
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        touristCounts: [150, 200, 180, 220, 190, 250, 210],
        incidentCounts: [5, 8, 4, 7, 6, 9, 3]
    });
});

// Department Recent Alerts Table (last 5)
app.get('/api/department/dashboard/recent-alerts', (req, res) => {
    // Filter alerts to only include those with a 'message' property or specifically from the department
    const relevantAlerts = departmentAlerts.filter(alert => alert.message);
    const allRecentAlerts = [...relevantAlerts].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
    res.status(200).json(allRecentAlerts.map(alert => ({
        ...alert,
        time: new Date(alert.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) // Format time for display
    })));
});

// Department Digital ID Verifications
app.get('/api/department/dashboard/digital-id-verifications', (req, res) => {
    // This is static mock data. In a real app, this would be dynamic.
    res.status(200).json(initialDigitalIdVerifications);
});

// Send Manual Alert to Tourists
app.post('/api/department/send-alert', (req, res) => {
    const { alertType, recipientType, touristDigitalIDs, area, alertMessage, priority } = req.body;

    let recipients = [];
    if (recipientType === 'single' && touristDigitalIDs && touristDigitalIDs.length > 0) {
        recipients = tourists.filter(t => touristDigitalIDs.includes(t.digitalID));
    } else if (recipientType === 'multiple' && touristDigitalIDs && touristDigitalIDs.length > 0) {
        recipients = tourists.filter(t => touristDigitalIDs.includes(t.digitalID));
    } else if (recipientType === 'area' && area) {
        // Simple mock: for 'area', we'll just send to all active tourists for demonstration
        // A real implementation would involve geo-spatial queries
        recipients = tourists.filter(t => t.currentLocation && t.status === 'Active'); // send to all active tourists with known location for demo
    } else { // Fallback to all if no specific recipient type or IDs provided
        recipients = tourists.filter(t => t.status === 'Active'); // only active tourists
    }

    const newDeptAlert = {
        id: `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1E5)}`,
        time: new Date().toISOString(),
        type: alertType,
        message: alertMessage,
        priority: priority,
        recipientsCount: recipients.length,
        status: 'Sent',
        title: alertType.charAt(0).toUpperCase() + alertType.slice(1) + ' Alert'
    };
    departmentAlerts.unshift(newDeptAlert); // Add to the beginning of the list

    recipients.forEach(t => {
        t.alerts.unshift({
            id: `A${Date.now()}-${Math.floor(Math.random() * 1E5)}`,
            type: alertType,
            title: newDeptAlert.title,
            message: alertMessage,
            time: new Date().toISOString(),
            unread: true
        });
    });

    res.status(200).json({ message: 'Alert sent successfully!', alert: newDeptAlert });
});

// Get Alert History for Department
app.get('/api/department/alert-history', (req, res) => {
    const history = [...departmentAlerts].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    res.status(200).json(history.map(alert => ({
        ...alert,
        time: new Date(alert.time).toLocaleString() // Format time for display
    })));
});

// Get all Tourist Profiles with pagination and filtering
app.get('/api/department/tourists', (req, res) => {
    const { search, status, nationality, page = 1, limit = 10 } = req.query;

    let filteredTourists = [...tourists];

    if (search) {
        const searchTerm = search.toLowerCase();
        filteredTourists = filteredTourists.filter(t =>
            t.fullName.toLowerCase().includes(searchTerm) ||
            t.digitalID.toLowerCase().includes(searchTerm) ||
            (t.idNumber && t.idNumber.toLowerCase().includes(searchTerm))
        );
    }
    if (status && status !== 'all') {
        filteredTourists = filteredTourists.filter(t => t.status.toLowerCase() === status.toLowerCase());
    }
    if (nationality && nationality !== 'all') {
        filteredTourists = filteredTourists.filter(t => t.nationality.toLowerCase() === nationality.toLowerCase());
    }

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTourists = filteredTourists.slice(startIndex, endIndex);

    res.status(200).json({
        total: filteredTourists.length,
        page: parseInt(page),
        limit: parseInt(limit),
        data: paginatedTourists
    });
});

// Get E-FIR Reports (SOS included) with pagination and filtering
app.get('/api/department/efir', (req, res) => {
    const { status, date, type, page = 1, limit = 10 } = req.query;

    let filteredReports = [...efirReports];

    if (status && status !== 'all') {
        filteredReports = filteredReports.filter(r => r.status.toLowerCase() === status.toLowerCase());
    }
    if (type && type !== 'all') {
        filteredReports = filteredReports.filter(r => r.type.toLowerCase().includes(type.toLowerCase()));
    }
    if (date && date !== 'all') {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (date === 'today') {
            filteredReports = filteredReports.filter(r => r.time.startsWith(today));
        } else if (date === 'yesterday') {
            filteredReports = filteredReports.filter(r => r.time.startsWith(yesterday));
        } else if (date === 'week') {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            filteredReports = filteredReports.filter(r => new Date(r.time) >= oneWeekAgo);
        } else if (date === 'month') {
            const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Approximate month
            filteredReports = filteredReports.filter(r => new Date(r.time) >= oneMonthAgo);
        }
    }

    // Sort reports by time, newest first
    filteredReports.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedReports = filteredReports.slice(startIndex, endIndex);

    res.status(200).json({
        total: filteredReports.length,
        page: parseInt(page),
        limit: parseInt(limit),
        data: paginatedReports.map(report => ({
            ...report,
            time: new Date(report.time).toLocaleString() // Format time for display
        }))
    });
});

// Get specific E-FIR Report
app.get('/api/department/efir/:id', (req, res) => {
    const { id } = req.params;
    const report = efirReports.find(r => r.id === id);
    if (report) {
        res.status(200).json({
            ...report,
            time: new Date(report.time).toLocaleString() // Format time for display
        });
    } else {
        res.status(404).json({ message: 'Report not found.' });
    }
});

// Update E-FIR Report
app.put('/api/department/efir/:id', (req, res) => {
    const { id } = req.params;
    const { status, officerNotes } = req.body;

    const reportIndex = efirReports.findIndex(r => r.id === id);

    if (reportIndex !== -1) {
        const report = efirReports[reportIndex];
        report.status = status || report.status;
        report.officerNotes = officerNotes || report.officerNotes;
        res.status(200).json({ message: 'Report updated successfully!', report: {
            ...report,
            time: new Date(report.time).toLocaleString() // Format time for display
        } });
    } else {
        res.status(404).json({ message: 'Report not found.' });
    }
});


// Serve static HTML files (already handled by express.static(__dirname))
// app.get('/tourist.html', (req, res) => {
//     res.sendFile(path.join(__dirname, 'Tourist.html'));
// });

// app.get('/department.html', (req, res) => {
//     res.sendFile(path.join(__dirname, 'Department.html'));
// });

// Default route
app.get('/', (req, res) => {
    res.send('Welcome to TRAVIQ Backend! Please navigate to <a href="/Tourist.html">Tourist App</a> or <a href="/Department.html">Department Portal</a>');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Tourist App: http://localhost:${PORT}/Tourist.html`);
    console.log(`Department Portal: http://localhost:${PORT}/Department.html`);
});