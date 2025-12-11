import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// Внешний IP кластера
const BASE_URL = 'http://77.105.182.79';
const HOST_HEADER = 'student-7.local';

export default function () {
  const params = {
    headers: {
      'Host': HOST_HEADER,
      'Content-Type': 'application/json',
    },
    tags: { name: 'api' },
  };

  // 20% Write
  if (Math.random() < 0.2) {
    const payload = JSON.stringify({
      name: `City-${randomString(8)}`,
      description: "External Load Test"
    });

    // POST
    const resPost = http.post(`${BASE_URL}/Cities`, payload, params);
    check(resPost, { 'status is 200/201': (r) => r.status === 200 || r.status === 201 });
  }
  // 80% Read
  else {
    const resGet = http.get(`${BASE_URL}/Cities`, params);
    check(resGet, { 'status is 200': (r) => r.status === 200 });
  }

  sleep(1);
}
