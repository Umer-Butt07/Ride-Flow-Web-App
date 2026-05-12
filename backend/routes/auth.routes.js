const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { register, login, me } = require('../controllers/auth.controller');
const multer  = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/'); },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop();
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext);
  }
});
const upload = multer({ storage: storage });

router.post('/register', upload.single('profilePicture'), register);
router.post('/login',    login);
router.get('/me',        auth, me);

module.exports = router;
