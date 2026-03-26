const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function getServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }

    return require(path.join(__dirname, 'firebase-service-account.json'));
}

const firebaseApp = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(getServiceAccount())
    });

const firestore = getFirestore(firebaseApp);

module.exports = {
    firebaseApp,
    firestore
};