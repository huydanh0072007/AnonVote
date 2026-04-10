/**
 * Shared Utilities for AnonVote
 */

window.utils = {
    /**
     * Escapes HTML special characters to prevent XSS attacks.
     * @param {string} str - The string to escape.
     * @returns {string} - The escaped string.
     */
    escapeHTML: function(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }
};

// Also export as a global helper for convenience
window.escapeHTML = window.utils.escapeHTML;
