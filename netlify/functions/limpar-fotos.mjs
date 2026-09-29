import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { PHOTO_RETENTION_MS, pruneLegacyPhotos } from '../../lib/retention-core.mjs';

export const config = { schedule: '17 3 * * *' };

function database() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada no Netlify.');
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  return getFirestore();
}

async function deleteExpiredPhotoDocuments(db, cutoff, deadline) {
  let deleted = 0;
  while (Date.now() < deadline) {
    const photos = await db.collection('fotos').where('criadoEm', '<=', Timestamp.fromMillis(cutoff)).limit(100).get();
    if (photos.empty) break;
    const batch = db.batch();
    photos.docs.forEach(photo => batch.delete(photo.ref));
    await batch.commit();
    deleted += photos.size;
    if (photos.size < 100) break;
  }
  return deleted;
}

async function cleanLegacyIncidentPhotos(db, nowMs, deadline) {
  const stateRef = db.doc('_sistema/retencaoFotos');
  const state = await stateRef.get();
  let cursor = state.exists ? state.data().cursor || '' : '';
  let removed = 0;
  let scanned = 0;
  while (Date.now() < deadline) {
    let page = db.collection('incidentes').orderBy(FieldPath.documentId()).limit(50);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    if (snapshot.empty) {
      cursor = '';
      break;
    }
    for (const incident of snapshot.docs) {
      const data = incident.data();
      const result = pruneLegacyPhotos(data.timelineEtapas, nowMs, data.dataTimestamp);
      if (result.removed) {
        await incident.ref.update({ timelineEtapas: result.timeline });
        removed += result.removed;
      }
      scanned++;
      cursor = incident.id;
    }
    if (snapshot.size < 50) {
      cursor = '';
      break;
    }
  }
  await stateRef.set({ cursor, ultimaExecucao: Timestamp.fromMillis(nowMs) }, { merge: true });
  return { removed, scanned };
}

export default async () => {
  const db = database();
  const nowMs = Date.now();
  const deadline = nowMs + 20000;
  const deleted = await deleteExpiredPhotoDocuments(db, nowMs - PHOTO_RETENTION_MS, deadline);
  const legacy = await cleanLegacyIncidentPhotos(db, nowMs, deadline);
  console.log(JSON.stringify({ photosDeleted: deleted, legacyPhotosRemoved: legacy.removed, incidentsScanned: legacy.scanned }));
  return new Response('Limpeza concluída.');
};
