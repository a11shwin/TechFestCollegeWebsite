const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { User, Registration } = require('./models');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Explicitly serve login.html for the root route so it's the very first page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve static files from the 'public' directory but disable the default index.html behavior
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Connect to MongoDB with fallback
const mongoUrl = process.env.MONGODB_URI;
let isMongoConnected = false;

if (mongoUrl) {
  mongoose.connect(mongoUrl)
    .then(() => {
      console.log('Successfully connected to MongoDB.');
      isMongoConnected = true;
    })
    .catch(err => {
      console.error('MongoDB connection error. Falling back to local files:', err);
    });
} else {
  console.warn('===========================================================');
  console.warn('WARNING: MONGODB_URI not configured in .env.');
  console.warn('All users and registrations will be stored in local files.');
  console.warn('===========================================================');
}

const REGISTRATIONS_FILE = path.join(__dirname, 'registrations.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Preload default student account 'jincy' in users.json if not present
if (!fs.existsSync(USERS_FILE)) {
  const defaultUser = {
    id: require('crypto').randomUUID(),
    name: 'name',
    department: 'Computer Science & Engineering',
    email: 'jincy@ccet.ac.in',
    passwordHash: bcrypt.hashSync('9495159973', 10),
    created_at: new Date().toISOString()
  };
  fs.writeFileSync(USERS_FILE, JSON.stringify([defaultUser], null, 2));
  console.log('Initialized default student "jincy@ccet.ac.in" in users.json');
}

// Preload default student in MongoDB if connected
async function seedDefaultUserInMongo() {
  if (isMongoConnected) {
    try {
      const existing = await User.findOne({ email: 'jincy@ccet.ac.in' });
      if (!existing) {
        const hashedPassword = await bcrypt.hash('9495159973', 10);
        await User.create({
          name: 'Jincy',
          department: 'Computer Science & Engineering',
          email: 'jincy@ccet.ac.in',
          password: hashedPassword
        });
        console.log('Initialized default student "jincy@ccet.ac.in" in MongoDB');
      }
    } catch (err) {
      console.error('Failed to seed default student in MongoDB:', err);
    }
  }
}
// Run seeding slightly delayed to allow MongoDB connection to complete
setTimeout(seedDefaultUserInMongo, 2000);

if (!fs.existsSync(REGISTRATIONS_FILE)) {
  fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for memory storage (file upload handling)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limit files to 5MB
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Configure Nodemailer Microsoft Outlook SMTP Transporter
const emailHost = process.env.EMAIL_HOST;
const emailPort = parseInt(process.env.EMAIL_PORT) || 587;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const adminEmailRecipient = process.env.ADMIN_EMAIL;

let transporter = null;
if (emailUser && emailPass && emailPass !== 'your-outlook-email-password-or-app-password') {
  transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
  console.log('Nodemailer SMTP Transporter configured.');
}

// Helper function to send registration notification email to Admin
async function sendRegistrationEmail(regData) {
  const mailOptions = {
    from: emailUser || 'no-reply@ccetignitron.com',
    to: adminEmailRecipient || 'ashwinantonyjose28@gmail.com',
    subject: 'New Event Registration',
    text: `New user registered for an event.

Name: ${regData.name}
Department: ${regData.department}
Event: ${regData.event}
Student ID: ${regData.studentId}`
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log('SMTP email notification sent to admin.');
    } catch (err) {
      console.error('Failed to send SMTP email notification:', err);
    }
  } else {
    console.log('===========================================================');
    console.log('EMAIL NOTIFICATION (SMTP NOT CONFIG):');
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(mailOptions.text);
    console.log('===========================================================');
  }
}

// Middleware to verify user JWT token
const verifyUserJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Access token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_ignitron', (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Forbidden: Invalid or expired token' });
    }
    req.userId = decoded.userId;
    req.userName = decoded.name;
    req.userEmail = decoded.email;
    req.userDepartment = decoded.department;
    next();
  });
};

// Middleware to verify admin password
const verifyAdmin = (req, res, next) => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const providedPassword = req.headers['x-admin-password'] || req.query.password;

  if (!providedPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid admin credentials' });
  }
  next();
};

/**
 * Endpoint: POST /api/auth/signup
 * Description: Registers a new student account using Email and Password.
 */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, department, email, password } = req.body;

    if (!name || !department || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required!' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (isMongoConnected) {
      // Check MongoDB if user already exists
      const existingUser = await User.findOne({ email: trimmedEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
      }

      // Hash password and insert
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        name: name.trim(),
        department: department.trim(),
        email: trimmedEmail,
        password: hashedPassword
      });

      return res.status(200).json({
        success: true,
        message: 'Account created successfully! Please login.'
      });
    } else {
      // Local JSON File Fallback
      const rawData = fs.readFileSync(USERS_FILE, 'utf-8');
      const users = JSON.parse(rawData);

      // Check duplicates
      const isDuplicate = users.some(u => u.email === trimmedEmail);
      if (isDuplicate) {
        return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        id: require('crypto').randomUUID(),
        name: name.trim(),
        department: department.trim(),
        email: trimmedEmail,
        passwordHash: hashedPassword,
        created_at: new Date().toISOString()
      };

      users.push(newUser);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

      return res.status(200).json({
        success: true,
        message: 'Account created successfully! Please login.'
      });
    }
  } catch (error) {
    console.error('Auth Signup Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred during signup.' });
  }
});

/**
 * Endpoint: POST /api/auth/login
 * Description: Authenticates a student using Email and Password, and returns a JWT.
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required!' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    let user = null;
    let isPasswordCorrect = false;

    if (isMongoConnected) {
      user = await User.findOne({ email: trimmedEmail });
      if (user) {
        isPasswordCorrect = await bcrypt.compare(password, user.password);
      }
    } else {
      const rawData = fs.readFileSync(USERS_FILE, 'utf-8');
      const users = JSON.parse(rawData);
      user = users.find(u => u.email === trimmedEmail);
      if (user) {
        isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
      }
    }

    if (!user || !isPasswordCorrect) {
      return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
    }

    // Generate JWT session token
    const token = jwt.sign(
      {
        userId: user._id || user.id,
        name: user.name,
        email: user.email,
        department: user.department
      },
      process.env.JWT_SECRET || 'super_secret_jwt_key_ignitron',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        name: user.name,
        department: user.department,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Auth Login Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred during login.' });
  }
});

/**
 * Endpoint: POST /api/register
 * Description: Registers a student for an event. Gated by verifyUserJWT. Sends admin email notification.
 */
app.post('/api/register', verifyUserJWT, upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { name, department, email, studentId, event } = req.body;

    // 1. Basic Validation
    if (!name || !department || !email || !studentId || !event) {
      return res.status(400).json({ success: false, error: 'All fields are required!' });
    }

    // Note: Users are now allowed to register under a different email address.
    // The previous JWT email restriction has been removed.

    const freeEvents = ['Hackathon', 'UI/UX Design Challenge'];
    const isFree = freeEvents.includes(event);

    if (!isFree && !req.file) {
      return res.status(400).json({ success: false, error: 'Payment screenshot upload is required!' });
    }

    let publicUrl = 'Free Entry';

    if (isMongoConnected) {
      // 2. Perform duplicate check
      const existingReg = await Registration.findOne({
        email: email.trim().toLowerCase(),
        event: event.trim()
      });

      if (existingReg) {
        return res.status(400).json({
          success: false,
          error: `You have already registered for ${event}.`
        });
      }

      // Handle local upload fallback for screenshot URL (Supabase upload is disabled in MongoDB mode)
      if (!isFree) {
        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const localPath = path.join(UPLOADS_DIR, fileName);

        fs.writeFileSync(localPath, file.buffer);
        publicUrl = `/uploads/${fileName}`;
      }

      // 3. Create MongoDB Registration record
      const registration = await Registration.create({
        name: name.trim(),
        department: department.trim(),
        email: email.trim().toLowerCase(),
        studentId: studentId.trim(),
        event: event.trim(),
        payment_screenshot_url: publicUrl // stored for compatability/dashboard rendering
      });

      // 4. Send Email Notification
      await sendRegistrationEmail({
        name: name.trim(),
        department: department.trim(),
        event: event.trim(),
        studentId: studentId.trim()
      });

      return res.status(200).json({
        success: true,
        message: 'Registration successful! See you at the Tech Fest.',
        registration: {
          id: registration._id,
          name: registration.name,
          event: registration.event
        }
      });

    } else {
      // Local JSON File Database Fallback
      const rawData = fs.readFileSync(REGISTRATIONS_FILE, 'utf-8');
      const registrations = JSON.parse(rawData);

      const emailLower = email.trim().toLowerCase();

      // Check duplicates
      const isDuplicate = registrations.some(r => r.email === emailLower && r.event === event);
      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          error: `You have already registered for ${event}.`
        });
      }

      if (!isFree) {
        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const localPath = path.join(UPLOADS_DIR, fileName);

        fs.writeFileSync(localPath, file.buffer);
        publicUrl = `/uploads/${fileName}`;
      }

      const newRegistration = {
        id: require('crypto').randomUUID(),
        name: name.trim(),
        department: department.trim(),
        email: emailLower,
        studentId: studentId.trim(),
        event: event.trim(),
        payment_screenshot_url: publicUrl,
        created_at: new Date().toISOString()
      };

      registrations.push(newRegistration);
      fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 2));

      // Send Email Notification
      await sendRegistrationEmail({
        name: name.trim(),
        department: department.trim(),
        event: event.trim(),
        studentId: studentId.trim()
      });

      return res.status(200).json({
        success: true,
        message: 'Registration successful! See you at the Tech Fest.',
        registration: newRegistration
      });
    }

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
  }
});

/**
 * Endpoint: GET /api/user/registrations
 * Description: Fetches registrations for the logged-in student. Gated by verifyUserJWT.
 */
app.get('/api/user/registrations', verifyUserJWT, async (req, res) => {
  try {
    const userEmail = req.userEmail;

    if (isMongoConnected) {
      const list = await Registration.find({ email: userEmail }).sort({ createdAt: -1 });
      // Map for client-side compatibility (id mapping)
      const mapped = list.map(item => ({
        id: item._id,
        name: item.name,
        department: item.department,
        email: item.email,
        phone: item.studentId, // maps to phone/ID fields in details
        studentId: item.studentId,
        event: item.event,
        payment_screenshot_url: item.payment_screenshot_url || 'Free Entry',
        created_at: item.createdAt
      }));
      return res.status(200).json({ success: true, registrations: mapped });
    } else {
      const rawData = fs.readFileSync(REGISTRATIONS_FILE, 'utf-8');
      const registrations = JSON.parse(rawData);

      const filtered = registrations.filter(r => r.email === userEmail);
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.status(200).json({ success: true, registrations: filtered });
    }
  } catch (error) {
    console.error('Fetch User Registrations Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
  }
});

/**
 * Endpoint: POST /api/admin/login
 * Description: Verifies admin username + password credentials.
 * Accepts: { username, password } OR { password } for backward compatibility.
 */
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  // Trim inputs to handle accidental spaces
  const trimmedUsername = (username || '').trim();
  const trimmedPassword = (password || '').trim();

  // Admin credentials (from .env or hardcoded defaults)
  const adminUsername = (process.env.ADMIN_USERNAME || 'Ashwin').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();

  // Debug logs
  console.log('===========================================================');
  console.log('[ADMIN AUTH] Login attempt received');
  console.log(`[ADMIN AUTH] Username entered : "${trimmedUsername}"`);
  console.log(`[ADMIN AUTH] Password entered : "${trimmedPassword.replace(/./g, '*')}"`);
  console.log(`[ADMIN AUTH] Expected username: "${adminUsername}"`);

  // Check username. If no username was provided (e.g. from admin.js dashboard login), bypass username check for backward compatibility.
  const usernameMatch = (!username) ? true : (trimmedUsername === adminUsername);
  
  // Check password (exact match)
  const passwordMatch = trimmedPassword === adminPassword;

  console.log(`[ADMIN AUTH] Username match  : ${usernameMatch} (provided: ${!!username})`);
  console.log(`[ADMIN AUTH] Password match  : ${passwordMatch}`);

  if (usernameMatch && passwordMatch) {
    console.log('[ADMIN AUTH] ✅ Authentication SUCCESSFUL — redirecting to admin dashboard');
    console.log('===========================================================');
    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      adminPassword: adminPassword  // returned so frontend can store for API calls
    });
  } else {
    const reason = !passwordMatch ? 'wrong password' : 'wrong username';
    console.log(`[ADMIN AUTH] ❌ Authentication FAILED — ${reason}`);
    console.log('===========================================================');
    return res.status(401).json({
      success: false,
      error: 'Invalid admin credentials. Please check username and password.'
    });
  }
});

/**
 * Endpoint: GET /api/admin/registrations
 * Description: Fetches all registrations (admin only).
 */
app.get('/api/admin/registrations', verifyAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      const list = await Registration.find({}).sort({ createdAt: -1 });
      const mapped = list.map(item => ({
        id: item._id,
        name: item.name,
        department: item.department,
        email: item.email,
        phone: item.studentId, // fallback field mapping
        studentId: item.studentId,
        event: item.event,
        payment_screenshot_url: item.payment_screenshot_url || 'Free Entry',
        created_at: item.createdAt
      }));
      return res.status(200).json({ success: true, registrations: mapped });
    } else {
      const rawData = fs.readFileSync(REGISTRATIONS_FILE, 'utf-8');
      const registrations = JSON.parse(rawData);
      registrations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return res.status(200).json({ success: true, registrations });
    }
  } catch (error) {
    console.error('Admin Registrations Fetch Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
  }
});

/**
 * Endpoint: GET /api/admin/stats
 * Description: Fetches statistics summary (admin only).
 */
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  try {
    let data;
    if (isMongoConnected) {
      data = await Registration.find({}, 'event department');
    } else {
      const rawData = fs.readFileSync(REGISTRATIONS_FILE, 'utf-8');
      data = JSON.parse(rawData);
    }

    const totalCount = data.length;
    const eventCounts = {};
    const deptCounts = {};

    data.forEach(item => {
      if (item.event) {
        eventCounts[item.event] = (eventCounts[item.event] || 0) + 1;
      }
      if (item.department) {
        deptCounts[item.department] = (deptCounts[item.department] || 0) + 1;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        total: totalCount,
        eventCounts,
        deptCounts
      }
    });
  } catch (error) {
    console.error('Admin Stats Fetch Error:', error);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler for Multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File size limit exceeded (Max 5MB).' });
    }
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// Start the Server
app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(`  Carmel College Tech Fest Server is running on Port ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`===========================================================`);
});
