const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/connection');

// ─── POST /api/auth/register ──────────────────────────────────────
const register = async (req, res) => {
  const { firstName, lastName, email, phone, password, role,
          licenseNo, cnic, vehicleMake, vehicleModel, vehicleType, licensePlate,
          vehicleYear, vehicleColor } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!['Rider', 'Driver'].includes(role)) {
    return res.status(400).json({ error: 'Role must be Rider or Driver.' });
  }
  
  let profilePicture = null;
  if (req.file) {
    profilePicture = '/uploads/' + req.file.filename;
  }

  if (role === 'Driver') {
    if (!licenseNo || !cnic) {
      return res.status(400).json({ error: 'Driver must provide LicenseNo and CNIC.' });
    }
    if (!profilePicture) {
      return res.status(400).json({ error: 'Driver must upload a profile picture.' });
    }
    if (!vehicleMake || !vehicleModel || !vehicleType || !licensePlate || !vehicleYear || !vehicleColor) {
      return res.status(400).json({ error: 'Driver must provide all vehicle details.' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);

    const [userResult] = await conn.execute(
      `INSERT INTO Users (FirstName, LastName, Email, Phone, PasswordHash, Role, AccountStatus, WalletBalance, RegDate, ProfilePicture)
       VALUES (?, ?, ?, ?, ?, ?, 'Active', 0, CURDATE(), ?)`,
      [firstName, lastName, email, phone, passwordHash, role, profilePicture]
    );
    const userId = userResult.insertId;

    if (role === 'Driver') {
      await conn.execute(
        `INSERT INTO Drivers (DriverID, LicenseNo, CNIC, VerificationStatus, AvailabilityStatus)
         VALUES (?, ?, ?, 'Pending', 'Offline')`,
        [userId, licenseNo, cnic]
      );
      await conn.execute(
        `INSERT INTO Vehicles (DriverID, VehicleType, Make, Model, LicensePlate, Year, Color, VerificationStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Verified')`,
        [userId, vehicleType, vehicleMake, vehicleModel, licensePlate, vehicleYear, vehicleColor]
      );
    }

    await conn.commit();

    const token = jwt.sign(
      { userId, role, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { userId, firstName, lastName, email, role },
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email, CNIC or License Plate already registered.' });
    }
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  } finally {
    conn.release();
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const [rows] = await pool.execute(
    `SELECT UserID, FirstName, LastName, Email, PasswordHash, Role, AccountStatus, ProfilePicture
     FROM Users WHERE Email = ? LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = rows[0];

  if (user.AccountStatus === 'Banned') {
    return res.status(403).json({ error: 'Your account has been banned.' });
  }
  if (user.AccountStatus === 'Suspended') {
    return res.status(403).json({ error: 'Your account is suspended. Contact support.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { userId: user.UserID, role: user.Role, email: user.Email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return res.json({
    message: 'Login successful.',
    token,
    user: {
      userId:    user.UserID,
      firstName: user.FirstName,
      lastName:  user.LastName,
      email:     user.Email,
      role:      user.Role,
      ProfilePicture: user.ProfilePicture
    },
  });
};

// ─── GET /api/auth/me ─────────────────────────────────────────────
const me = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT UserID, FirstName, LastName, Email, Phone, Role, AccountStatus, WalletBalance, RegDate, ProfilePicture
     FROM Users WHERE UserID = ?`,
    [req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  return res.json(rows[0]);
};

module.exports = { register, login, me };
