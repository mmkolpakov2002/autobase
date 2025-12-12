import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js';
import { Rate } from 'k6/metrics';

const writeFailRate = new Rate('failed_write_requests');
const readFailRate = new Rate('failed_read_requests');

const TARGET_HOST = __ENV.TARGET_HOST || '192.168.1.100:80';
const HOST_HEADER = __ENV.HOST_HEADER || 'student-7.local';
const PROTOCOL = __ENV.PROTOCOL || 'http';

const BASE_URL = `${PROTOCOL}://${TARGET_HOST}`;

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],

  thresholds: {
    // Глобальные ошибки < 1%
    'http_req_failed': ['rate<0.01'],
    // Ошибки записи критичнее ошибок чтения
    'failed_write_requests': ['rate<0.05'],
    // p95 latency для всех запросов < 500ms
    'http_req_duration': ['p(95)<500'],
    // p99 latency специфично для POST запросов (тэги)
    'http_req_duration{type:write}': ['p(99)<1000'],
  },
};

export default function () {
  const params = {
    headers: {
      'Host': HOST_HEADER,
      'Content-Type': 'application/json',
    },
  };

  group('User Flow: Create & Read', function () {

    // Эмуляция создания ресурса
    const cityName = `City-${randomString(6)}`;
    const payload = JSON.stringify({
      name: cityName,
      description: "K6 Advanced Test"
    });

    // type: write для метрик
    const resPost = http.post(`${BASE_URL}/Cities`, payload, { ...params, tags: { type: 'write' } });

    const postSuccess = check(resPost, {
      'POST status is 201/200': (r) => r.status === 201 || r.status === 200,
      'POST duration < 1s': (r) => r.timings.duration < 1000,
    });

    // 1 если провал, 0 если успех
    writeFailRate.add(!postSuccess);

    // Если создание прошло успешно, прочитать список
    if (postSuccess) {
      // пользователь смотрит список городов
      const resGet = http.get(`${BASE_URL}/Cities`, { ...params, tags: { type: 'read' } });

      const getSuccess = check(resGet, {
        'GET status is 200': (r) => r.status === 200,
        'GET content type is json': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json'),
      });

      readFailRate.add(!getSuccess);
    }
  });

  // Random Think Time
  sleep(Math.random() + 0.5);
}
