const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const COLLECTIONS_FIREBASE_APP_NAME = 'yhCollectionsFirebaseApp';

function getServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }

    return require(path.join(__dirname, 'firebase-service-account.json'));
}

function getCollectionsServiceAccount() {
    const base64ServiceAccount = String(
        process.env.YH_COLLECTIONS_FIREBASE_SERVICE_ACCOUNT_BASE64 || ''
    ).trim();

    if (base64ServiceAccount) {
        const decoded = Buffer.from(base64ServiceAccount, 'base64').toString('utf8');
        return JSON.parse(decoded);
    }

    if (process.env.YH_COLLECTIONS_FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.YH_COLLECTIONS_FIREBASE_SERVICE_ACCOUNT_JSON);
    }

    return null;
}

const firebaseApp = getApps().find((app) => app.name === '[DEFAULT]')
    || initializeApp({
        credential: cert(getServiceAccount())
    });

const firestore = getFirestore(firebaseApp);

const collectionsServiceAccount = getCollectionsServiceAccount();

const collectionsFirebaseApp = collectionsServiceAccount
    ? (
        getApps().find((app) => app.name === COLLECTIONS_FIREBASE_APP_NAME)
        || initializeApp(
            {
                credential: cert(collectionsServiceAccount)
            },
            COLLECTIONS_FIREBASE_APP_NAME
        )
    )
    : null;

const collectionsFirestore = collectionsFirebaseApp
    ? getFirestore(collectionsFirebaseApp)
    : null;

module.exports = {
    firebaseApp,
    firestore,
    collectionsFirebaseApp,
    collectionsFirestore
};