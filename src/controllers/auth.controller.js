const authService = require('../services/auth.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const registerTeacher = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  const result = await authService.registerTeacher(email, password, firstName, lastName);
  
  res.status(201).json({
    status: 'success',
    message: 'Teacher registered successfully',
    data: result
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  const result = await authService.login(email, password);
  
  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: result
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  const { googleId, email, firstName, lastName } = req.body;
  
  const result = await authService.googleLogin(googleId, email, firstName, lastName);
  
  res.status(200).json({
    status: 'success',
    message: 'Google login successful',
    data: result
  });
});

const microsoftLogin = asyncHandler(async (req, res) => {
  const { microsoftId, email, firstName, lastName } = req.body;
  
  const result = await authService.microsoftLogin(microsoftId, email, firstName, lastName);
  
  res.status(200).json({
    status: 'success',
    message: 'Microsoft login successful',
    data: result
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role
      }
    }
  });
});

module.exports = {
  registerTeacher,
  login,
  googleLogin,
  microsoftLogin,
  getCurrentUser
};