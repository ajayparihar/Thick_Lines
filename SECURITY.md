# Security Guide for Thick Lines

This document outlines the security features implemented in Thick Lines and provides recommendations for secure deployment.

## Implemented Security Features

### Input Sanitization

1. **HTML Sanitization**: All user inputs are sanitized to prevent XSS attacks
   - Function: `sanitizeHTML(input)`
   - Used for: Toast messages, tooltips, and any user-generated content

2. **Color Validation**: All color inputs are validated against safe patterns
   - Function: `validateColor(color)`
   - Supports: Hex colors (#RGB, #RRGGBB), named colors, rgba/rgb values
   - Falls back to safe default if invalid

3. **Numeric Input Validation**: All numeric inputs are validated within safe ranges
   - Function: `validateNumericInput(value, min, max, defaultValue)`
   - Used for: Pen/eraser sizes, zoom levels, coordinates

4. **Filename Sanitization**: Export filenames are sanitized to prevent path traversal
   - Function: `sanitizeFilename(filename)`
   - Removes: Path traversal characters, invalid filename characters
   - Limits: Filename length to 255 characters

5. **URL Validation**: URLs are validated to prevent malicious redirects
   - Function: `validateURL(url)`
   - Allows only: HTTP and HTTPS protocols

### Canvas Security

1. **Data URL Validation**: Canvas data is validated before saving/loading
2. **Memory Management**: Automatic cleanup prevents memory exhaustion attacks
3. **State Management**: Limited undo/redo stack size prevents memory attacks

### Client-Side Security

1. **CORS Protection**: Canvas operations respect same-origin policy
2. **CSP Compliance**: Code is designed to work with strict Content Security Policy
3. **No eval()**: No dynamic code execution or eval() usage

## Deployment Security Recommendations

### Content Security Policy (CSP)

Add the following CSP header to your web server configuration:

```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; 
  font-src 'self' https://cdnjs.cloudflare.com; 
  img-src 'self' data: blob:; 
  connect-src 'self';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
```

### HTTP Security Headers

Add these additional security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### HTTPS Configuration

- Always serve over HTTPS in production
- Use HTTP Strict Transport Security (HSTS)
- Implement proper certificate validation

### File Upload Security (Future Feature)

If implementing file upload features:

1. Validate file types and sizes
2. Scan uploaded files for malware
3. Store uploads outside web root
4. Use signed URLs for file access
5. Implement rate limiting

### Privacy Considerations

1. **Local Storage**: Only user preferences stored locally
2. **No Tracking**: No external analytics or tracking scripts
3. **Offline First**: Can work without internet connection
4. **Data Retention**: Canvas data only stored in memory/localStorage

### Rate Limiting Recommendations

For production deployment, implement:

1. Canvas save operations: 10 requests per minute
2. Export operations: 5 requests per minute
3. Overall API calls: 100 requests per minute per IP

### Monitoring and Logging

Monitor for:

1. Unusual canvas data patterns
2. Excessive memory usage
3. Failed validation attempts
4. Large file export attempts

### Browser Compatibility Security

- Tested on modern browsers with security features enabled
- Uses standard Canvas API without experimental features
- No dependency on deprecated browser APIs

## Security Testing

### Automated Testing

1. Input validation tests for all sanitization functions
2. XSS prevention tests
3. Canvas data integrity tests
4. Memory leak detection tests

### Manual Testing

1. Attempt to inject scripts through color inputs
2. Test path traversal in export filenames
3. Verify CSP compliance
4. Test with browser security extensions enabled

## Reporting Security Issues

If you discover a security vulnerability:

1. Do not create a public issue
2. Send details privately to the maintainer
3. Include steps to reproduce
4. Allow time for patches before disclosure

## Security Changelog

### Version 1.2.0
- Added comprehensive input sanitization
- Implemented filename sanitization
- Added color and numeric validation
- Enhanced memory management security

### Version 1.1.0
- Added basic XSS protection
- Implemented canvas data validation

### Version 1.0.0
- Initial security baseline
- Basic input validation
