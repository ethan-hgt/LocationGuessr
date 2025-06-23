const crypto = require('crypto');

jest.setTimeout(30000);

describe('Security Validation Tests', () => {
  describe('XSS Protection', () => {
    test('should detect XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '<svg onload="alert(\'xss\')">',
        '"><script>alert("xss")</script>'
      ];

      xssAttempts.forEach(attempt => {
        const xssPatterns = [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi
        ];

        const containsXSS = xssPatterns.some(pattern => pattern.test(attempt));
        expect(containsXSS).toBe(true);
      });
    });
  });

  describe('CSRF Protection', () => {
    test('should validate CSRF token format', () => {
      const validTokens = [
        crypto.randomBytes(32).toString('hex'),
        crypto.randomBytes(64).toString('hex')
      ];

      const invalidTokens = [
        '',
        'invalid-token',
        '123',
        'token-with-spaces'
      ];

      validTokens.forEach(token => {
        expect(token).toMatch(/^[a-f0-9]{64,128}$/);
      });

      invalidTokens.forEach(token => {
        expect(token).not.toMatch(/^[a-f0-9]{64,128}$/);
      });
    });
  });
});

describe('Input Sanitization Tests', () => {
  test('should sanitize HTML content', () => {
    const dirtyInputs = [
      '<p>Hello <script>alert("xss")</script> World</p>',
      '<div>Content <img src="x" onerror="alert(\'xss\')"></div>',
      '<a href="javascript:alert(\'xss\')">Click me</a>'
    ];

    const cleanInputs = dirtyInputs.map(input => {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '');
    });

    cleanInputs.forEach((clean, index) => {
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror=');
      expect(clean).not.toContain('javascript:');
    });
  });

  test('should validate file uploads', () => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    const validFiles = [
      { name: 'image.jpg', type: 'image/jpeg' },
      { name: 'photo.png', type: 'image/png' },
      { name: 'avatar.webp', type: 'image/webp' }
    ];

    const invalidFiles = [
      { name: 'script.js', type: 'application/javascript' },
      { name: 'virus.exe', type: 'application/x-msdownload' },
      { name: 'document.php', type: 'application/x-httpd-php' }
    ];

    validFiles.forEach(file => {
      const hasValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      const hasValidMimeType = allowedMimeTypes.includes(file.type);
      
      expect(hasValidExtension).toBe(true);
      expect(hasValidMimeType).toBe(true);
    });

    invalidFiles.forEach(file => {
      const hasValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      const hasValidMimeType = allowedMimeTypes.includes(file.type);
      
      expect(hasValidExtension).toBe(false);
      expect(hasValidMimeType).toBe(false);
    });
  });
});

describe('Password Policy Tests', () => {
  test('should enforce strong password requirements', () => {
    const strongPasswords = [
      'MySecurePass123!',
      'ComplexP@ssw0rd2024',
      'Str0ng#P@ss!'
    ];

    const weakPasswords = [
      'password',
      '123456',
      'abc123',
      'Password',
      'pass123'
    ];

    const passwordPolicy = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    };

    const validatePassword = (password) => {
      return (
        password.length >= passwordPolicy.minLength &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        /[@$!%*?&]/.test(password)
      );
    };

    strongPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(true);
    });

    weakPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(false);
    });
  });
});

describe('Session Security Tests', () => {
  test('should generate secure session IDs', () => {
    const sessionIds = Array(10).fill().map(() => 
      crypto.randomBytes(32).toString('hex')
    );

    sessionIds.forEach(sessionId => {
      expect(sessionId).toHaveLength(64);
      expect(sessionId).toMatch(/^[a-f0-9]{64}$/);
    });

    const uniqueIds = new Set(sessionIds);
    expect(uniqueIds.size).toBe(sessionIds.length);
  });

  test('should validate session expiration', () => {
    const now = Date.now();
    const validSessions = [
      { createdAt: now - 1000 * 60 * 30, maxAge: 1000 * 60 * 60 },
      { createdAt: now - 1000 * 60 * 15, maxAge: 1000 * 60 * 60 }
    ];

    const expiredSessions = [
      { createdAt: now - 1000 * 60 * 90, maxAge: 1000 * 60 * 60 },
      { createdAt: now - 1000 * 60 * 120, maxAge: 1000 * 60 * 60 }
    ];

    const isSessionValid = (session) => {
      return (now - session.createdAt) < session.maxAge;
    };

    validSessions.forEach(session => {
      expect(isSessionValid(session)).toBe(true);
    });

    expiredSessions.forEach(session => {
      expect(isSessionValid(session)).toBe(false);
    });
  });
}); 