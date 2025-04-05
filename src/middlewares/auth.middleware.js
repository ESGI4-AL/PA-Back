const jwt = require('jsonwebtoken');
const { User } = require('../models');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    //user still exists ?
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found or inactive'
      });
    }
    
    req.user = user;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const isTeacher = (req, res, next) => {
  if (req.user && req.user.role === 'teacher') {
    next();
  } else {
    res.status(403).json({
      status: 'error',
      message: 'Access denied. Teachers only'
    });
  }
};

const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    next();
  } else {
    res.status(403).json({
      status: 'error',
      message: 'Access denied. Students only'
    });
  }
};

const isOwnerOrTeacher = (model, paramIdField) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramIdField];
      const resource = await model.findByPk(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          status: 'error',
          message: 'Resource not found'
        });
      }
      
      //if user is teacher
      if (req.user.role === 'teacher') {
        return next();
      }
      
      // if user is owner
      if (resource.userId === req.user.id) {
        return next();
      }
      
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Not the owner'
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  };
};

module.exports = {
  verifyToken,
  isTeacher,
  isStudent,
  isOwnerOrTeacher
};