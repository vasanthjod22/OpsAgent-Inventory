const request = require('supertest');
const express = require('express');

// We need to bypass auth for testing, or we can just mock auth middleware.
// Let's create a wrapper that requires the index, but we pass a mock token.
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 'test-user-id', email: 'test@example.com' }, process.env.JWT_SECRET || 'secret');

async function testAll() {
  try {
    const res1 = await fetch('http://localhost:3001/api/reports/finance', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Finance:', res1.status, await res1.text());

    const res2 = await fetch('http://localhost:3001/api/reports/inventory', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Inventory:', res2.status, await res2.text());

    const res3 = await fetch('http://localhost:3001/api/reports/purchase', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Purchase:', res3.status, await res3.text());

    const res4 = await fetch('http://localhost:3001/api/reports/customers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Customers:', res4.status, await res4.text());

    const res5 = await fetch('http://localhost:3001/api/reports/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Products:', res5.status, await res5.text());

    const res6 = await fetch('http://localhost:3001/api/reports/billing', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Billing:', res6.status, await res6.text());
  } catch (err) {
    console.error('Test script error:', err);
  }
}

testAll();
