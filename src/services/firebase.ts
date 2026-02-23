// src/services/firebase.ts

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  update,
  remove,
  query,
  orderByChild,
  runTransaction,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCw3a1sI7i0u6rCLZ1D_8y4QUq53i7B1_I",
  authDomain: "texawave-erp.firebaseapp.com",
  databaseURL: "https://texawave-erp-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "texawave-erp",
  storageBucket: "texawave-erp.firebasestorage.app",
  messagingSenderId: "1005702064731",
  appId: "1:1005702064731:web:43b056e63efb970edbad7e",
  measurementId: "G-CKEQ3BYBHL"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
const database = getDatabase(app);

// ---------------------------------------------------------------------------
// CREATE RECORD
// ---------------------------------------------------------------------------
export const createRecord = async (path: string, data: any) => {
  const listRef = ref(database, path);
  const newRef = push(listRef);

  await set(newRef, {
    ...data,
    id: newRef.key,
    createdAt: Date.now(),
  });

  return newRef.key;
};

// ---------------------------------------------------------------------------
// UPDATE SINGLE RECORD
// ---------------------------------------------------------------------------
export const updateRecord = async (path: string, id: string, data: any) => {
  const recordRef = ref(database, `${path}/${id}`);
  await update(recordRef, {
    ...data,
    updatedAt: Date.now(),
  });
};

// ---------------------------------------------------------------------------
// BATCH UPDATE (Multiple fields across multiple records in one atomic write)
// ---------------------------------------------------------------------------
export const batchUpdate = async (path: string, updates: Array<{ id: string; updates: any }>) => {
  const updatesObj: Record<string, any> = {};

  updates.forEach(({ id, updates }) => {
    updatesObj[`${path}/${id}`] = {
      ...updates,
      updatedAt: Date.now(),
    };
  });

  await update(ref(database), updatesObj);
};

// ---------------------------------------------------------------------------
// DELETE RECORD
// ---------------------------------------------------------------------------
export const deleteRecord = async (path: string, id: string) => {
  const recordRef = ref(database, `${path}/${id}`);
  await remove(recordRef);
};

// ---------------------------------------------------------------------------
// GET RECORD BY ID
// ---------------------------------------------------------------------------
export const getRecordById = async (path: string, id: string) => {
  const recordRef = ref(database, `${path}/${id}`);
  const snapshot = await get(recordRef);

  return snapshot.exists() ? { ...snapshot.val(), id } : null;
};

// Legacy alias (for backward compatibility)
export const getRecord = getRecordById;

// ---------------------------------------------------------------------------
// GET ALL RECORDS
// ---------------------------------------------------------------------------
export const getAllRecords = async (path: string) => {
  const listRef = ref(database, path);
  const snapshot = await get(listRef);

  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.keys(data).map((key) => ({ ...data[key], id: key }));
};

// ---------------------------------------------------------------------------
// QUERY RECORDS BY CHILD
// ---------------------------------------------------------------------------
export const queryRecords = async (path: string, child: string) => {
  const listRef = ref(database, path);
  const q = query(listRef, orderByChild(child));
  const snapshot = await get(q);

  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.keys(data).map((key) => ({ ...data[key], id: key }));
};

// ---------------------------------------------------------------------------
// RUN TRANSACTION (Used for safe stock deduction)
// ---------------------------------------------------------------------------
export { runTransaction };

// ---------------------------------------------------------------------------
// EXPORTS FOR DIRECT USE (commonly needed in components)
// ---------------------------------------------------------------------------
export { ref, database };