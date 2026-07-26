const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStorageBucket } = require('../routes/account');

test('creates or resolves an alternate avatar bucket when the primary bucket is missing', async () => {
  const calls = [];
  const supabase = {
    storage: {
      getBucket: async (bucketName) => {
        calls.push(`get:${bucketName}`);
        if (bucketName === 'user-avatars') {
          return { data: null, error: { message: 'Bucket not found' } };
        }
        if (bucketName === 'user_avatars') {
          return { data: { name: 'user_avatars' }, error: null };
        }
        return { data: null, error: { message: 'Bucket not found' } };
      },
      createBucket: async (bucketName) => {
        calls.push(`create:${bucketName}`);
        return { data: { name: bucketName }, error: null };
      },
    },
  };

  const resolvedBucket = await resolveStorageBucket(supabase, 'user-avatars');

  assert.equal(resolvedBucket, 'user_avatars');
  assert.deepEqual(calls, ['get:user-avatars', 'get:user_avatars']);
});

test('uses an existing bucket discovered via listing when getBucket reports it as missing', async () => {
  const calls = [];
  const supabase = {
    storage: {
      getBucket: async (bucketName) => {
        calls.push(`get:${bucketName}`);
        return { data: null, error: { message: 'Bucket not found' } };
      },
      listBuckets: async () => {
        calls.push('list');
        return {
          data: [{ name: 'user_avatars', public: true }],
          error: null,
        };
      },
      createBucket: async (bucketName) => {
        calls.push(`create:${bucketName}`);
        return { data: { name: bucketName }, error: null };
      },
    },
  };

  const resolvedBucket = await resolveStorageBucket(supabase, 'user-avatars');

  assert.equal(resolvedBucket, 'user_avatars');
  assert.ok(calls.includes('list'));
  assert.ok(calls.slice(0, 3).some((call) => call === 'get:user-avatars'));
});
