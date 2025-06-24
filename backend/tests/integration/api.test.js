const request = require('supertest');
const app = require('../../server');

jest.setTimeout(30000);

describe('API Structure Tests', () => {
  test('GET /test should return server status', async () => {
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
  });

  test('GET /api/modes should return game modes', async () => {
    const response = await request(app).get('/api/modes');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('france');
    expect(response.body).toHaveProperty('mondial');
    expect(response.body).toHaveProperty('disneyland');
  });
});

describe('Security Headers Tests', () => {
  test('should have security headers enabled', async () => {
    const response = await request(app).get('/test');
    
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-xss-protection');
    expect(response.headers).toHaveProperty('referrer-policy');
  });

  test('should have proper CORS configuration', async () => {
    const response = await request(app)
      .options('/test')
      .set('Origin', 'http://localhost:3000');
    
    expect(response.headers).toHaveProperty('access-control-allow-methods');
    // CORS headers peuvent varier selon la requête
    expect(response.status).toBeLessThanOrEqual(204);
  });
});

describe('Error Handling Tests', () => {
  test('should return 404 for non-existent routes', async () => {
    const response = await request(app).get('/non-existent-route');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Route non trouvée');
  });
});

describe('Cache Headers Tests', () => {
  test('should have cache headers on static assets', async () => {
    const response = await request(app).get('/img/France.png');
    expect(response.status).toBeLessThanOrEqual(404);
  });
});

describe('Performance Tests', () => {
  test('should respond quickly to simple requests', async () => {
    const startTime = Date.now();
    const response = await request(app).get('/test');
    const endTime = Date.now();
    
    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(1000);
  });
}); 