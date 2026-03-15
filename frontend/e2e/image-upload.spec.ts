import {test, expect} from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('image upload', () => {
  let mapId: number;

  test.beforeAll(async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    const res = await request.post('/api/maps', {
      headers: {Authorization: `Bearer ${token}`},
      data: {name: 'Image Upload E2E Map', gridType: 'square', gridSize: 40},
    });
    expect(res.ok()).toBeTruthy();
    mapId = (await res.json()).id;
  });

  test.afterAll(async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    await request.delete(`/api/maps/${mapId}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
  });

  test('upload a representative large map image via API', async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    const size = 5 * 1024 * 1024;
    const tmpFile = path.join(os.tmpdir(), 'test-map.jpg');
    fs.writeFileSync(tmpFile, Buffer.alloc(size, 0xff));

    const form = new FormData();
    const blob = new Blob([fs.readFileSync(tmpFile)], {type: 'image/jpeg'});
    form.append('file', blob, 'test-map.jpg');

    const res = await request.post('/api/upload/image', {
      headers: {Authorization: `Bearer ${token}`},
      multipart: {
        file: {
          name: 'test-map.jpg',
          mimeType: 'image/jpeg',
          buffer: fs.readFileSync(tmpFile),
        },
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.imageUrl).toBeTruthy();
    expect(typeof body.imageUrl).toBe('string');

    fs.unlinkSync(tmpFile);
  });

  test('uploaded image is retrievable within acceptable latency', async ({request}) => {
    const token = process.env['TEST_AUTH_TOKEN']!;
    const buffer = Buffer.alloc(512 * 1024, 0xab);

    const uploadRes = await request.post('/api/upload/image', {
      headers: {Authorization: `Bearer ${token}`},
      multipart: {
        file: {
          name: 'latency-test.png',
          mimeType: 'image/png',
          buffer,
        },
      },
    });

    expect(uploadRes.ok()).toBeTruthy();
    const {imageUrl} = await uploadRes.json();

    const start = Date.now();
    const getRes = await request.get(`/api/upload/image/${imageUrl}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    const latency = Date.now() - start;

    expect(getRes.ok()).toBeTruthy();
    expect(latency).toBeLessThan(5000);
  });
});
