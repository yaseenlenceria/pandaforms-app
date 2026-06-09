import fetch from 'node-fetch';

async function test() {
  const url = 'https://programs-ntsc-departmental-nearly.trycloudflare.com/api/form-config?id=aafbefbb-6e6d-4db4-9e92-016230ec6895';
  console.log(`Fetching from: ${url}`);
  try {
    const res = await fetch(url);
    console.log(`Response status: ${res.status}`);
    console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log(`Response body snippet (first 500 chars):`, text.substring(0, 500));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
