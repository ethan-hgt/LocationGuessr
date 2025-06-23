const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.setTimeout(30000);

describe('JWT Token Validation', () => {
  const testUserId = '507f1f77bcf86cd799439011';

  test('should create valid JWT token', async () => {
    const token = jwt.sign({ userId: testUserId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    expect(decoded).toHaveProperty('userId');
    expect(decoded.userId).toBe(testUserId);
  });

  test('should reject expired token', async () => {
    const token = jwt.sign({ userId: testUserId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1ms' });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(() => {
      jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    }).toThrow('jwt expired');
  });

  test('should reject token with invalid signature', () => {
    const token = jwt.sign({ userId: testUserId }, 'wrong-secret', { expiresIn: '24h' });
    expect(() => {
      jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    }).toThrow('invalid signature');
  });

  test('should reject malformed token', () => {
    expect(() => {
      jwt.verify('invalid.token.here', process.env.JWT_SECRET || 'test-secret');
    }).toThrow('invalid token');
  });

  test('should create token with custom claims', () => {
    const claims = { userId: testUserId, role: 'user', permissions: ['read', 'write'] };
    const token = jwt.sign(claims, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    expect(decoded).toHaveProperty('role', 'user');
    expect(decoded).toHaveProperty('permissions');
    expect(decoded.permissions).toContain('read');
  });
});

describe('Password Security', () => {
  test('should hash password correctly', async () => {
    const password = 'testPassword123';
    const hashedPassword = await bcrypt.hash(password, 10);
    expect(hashedPassword).not.toBe(password);
    expect(hashedPassword).toHaveLength(60);
  });

  test('should verify password correctly', async () => {
    const password = 'testPassword123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  test('should reject wrong password', async () => {
    const password = 'testPassword123';
    const wrongPassword = 'wrongPassword123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(wrongPassword, hashedPassword);
    expect(isValid).toBe(false);
  });

  test('should generate different hashes for same password', async () => {
    const password = 'testPassword123';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    expect(hash1).not.toBe(hash2);
  });
});

describe('Input Validation', () => {
  test('should validate password strength', () => {
    const strongPasswords = [
      'Password123!',
      'MySecurePass1@',
      'ComplexP@ssw0rd'
    ];
    const weakPasswords = [
      '123',
      'password',
      'abc123',
      'Password'
    ];

    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    strongPasswords.forEach(password => {
      expect(passwordStrengthRegex.test(password)).toBe(true);
    });

    weakPasswords.forEach(password => {
      expect(passwordStrengthRegex.test(password)).toBe(false);
    });
  });
}); 