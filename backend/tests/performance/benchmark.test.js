const request = require('supertest');
const app = require('../../server');

jest.setTimeout(60000);

describe('Performance Benchmark Tests', () => {
  let performanceResults = {};

  afterAll(() => {
    console.log('\n=== PERFORMANCE RESULTS ===');
    console.log(JSON.stringify(performanceResults, null, 2));
  });

  describe('Response Time Tests', () => {
    test('GET /test - Response time measurement', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const response = await request(app).get('/test');
        const endTime = Date.now();
        
        expect(response.status).toBe(200);
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      performanceResults['GET /test'] = {
        average: avgTime,
        min: minTime,
        max: maxTime,
        iterations
      };

      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(500);
    });

    test('GET /api/modes - Response time measurement', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const response = await request(app).get('/api/modes');
        const endTime = Date.now();
        
        expect(response.status).toBe(200);
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      performanceResults['GET /api/modes'] = {
        average: avgTime,
        min: minTime,
        max: maxTime,
        iterations
      };

      expect(avgTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(200);
    });
  });

  describe('Concurrent Load Tests', () => {
    test('Concurrent requests to /api/modes', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill().map(() => 
        request(app).get('/api/modes')
      );
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      performanceResults['Concurrent /api/modes'] = {
        totalTime,
        avgTimePerRequest,
        concurrentRequests,
        requestsPerSecond: (concurrentRequests / (totalTime / 1000))
      };

      expect(avgTimePerRequest).toBeLessThan(100);
      expect(totalTime).toBeLessThan(2000);
    });

    test('Concurrent requests to /test', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill().map(() => 
        request(app).get('/test')
      );
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      performanceResults['Concurrent /test'] = {
        totalTime,
        avgTimePerRequest,
        concurrentRequests,
        requestsPerSecond: (concurrentRequests / (totalTime / 1000))
      };

      expect(avgTimePerRequest).toBeLessThan(200);
      expect(totalTime).toBeLessThan(3000);
    });
  });

  describe('Memory Usage Tests', () => {
    test('Memory usage after multiple requests', async () => {
      const initialMemory = process.memoryUsage();
      
      const requests = Array(50).fill().map(() => 
        request(app).get('/api/modes')
      );
      
      await Promise.all(requests);
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external
      };

      performanceResults['Memory Usage'] = {
        initial: {
          heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(initialMemory.heapTotal / 1024 / 1024 * 100) / 100
        },
        final: {
          heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(finalMemory.heapTotal / 1024 / 1024 * 100) / 100
        },
        increase: {
          heapUsed: Math.round(memoryIncrease.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(memoryIncrease.heapTotal / 1024 / 1024 * 100) / 100
        }
      };

      expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Cache Performance Tests', () => {
    test('Cache effectiveness for /api/modes', async () => {
      const startTime1 = Date.now();
      const response1 = await request(app).get('/api/modes');
      const endTime1 = Date.now();
      const time1 = endTime1 - startTime1;
      
      expect(response1.status).toBe(200);
      
      const startTime2 = Date.now();
      const response2 = await request(app).get('/api/modes');
      const endTime2 = Date.now();
      const time2 = endTime2 - startTime2;
      
      expect(response2.status).toBe(200);
      
      performanceResults['Cache Performance'] = {
        firstRequest: time1,
        secondRequest: time2,
        improvement: ((time1 - time2) / time1 * 100).toFixed(2) + '%'
      };

      expect(time2).toBeLessThan(50); // Plus tolérant
      expect(time1 + time2).toBeLessThan(100); // Les deux requêtes ensemble
    });
  });

  describe('Error Handling Performance', () => {
    test('Performance under error conditions', async () => {
      const startTime = Date.now();
      
      const requests = Array(10).fill().map(() => 
        request(app).get('/non-existent-route-' + Math.random())
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      responses.forEach(response => {
        expect(response.status).toBe(404);
      });

      const totalTime = endTime - startTime;
      const avgTime = totalTime / 10;

      performanceResults['Error Handling'] = {
        totalTime,
        avgTime,
        requests: 10
      };

      expect(avgTime).toBeLessThan(100);
    });
  });
}); 