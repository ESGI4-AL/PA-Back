/**
 * Utility functions for file operations
 */

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Unknown size';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${value} ${sizes[i]}`;
};

/**
 * Sanitize filename to be safe for storage
 * @param {string} name - Original filename
 * @returns {string} Sanitized filename
 */
const sanitizeFileName = (name) => {
  return name
    .replace(/[^a-zA-Z0-9.\-_\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

module.exports = {
  formatFileSize,
  sanitizeFileName
};
