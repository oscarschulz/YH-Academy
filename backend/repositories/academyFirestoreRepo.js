const primary = require('./academySupabaseRepo');
const legacy = require('./academyFirestoreRepoLegacy');

function isEnabled() {
    const value = String(process.env.YHU_ACADEMY_CORE_SUPABASE_MODE || 'primary').trim().toLowerCase();
    return value !== 'off' && value !== 'false' && value !== 'legacy';
}

function wrapFunction(name) {
    return async function wrappedAcademyRepoFunction(...args) {
        if (isEnabled() && typeof primary[name] === 'function') {
            try {
                return await primary[name](...args);
            } catch (error) {
                console.error('Academy Supabase primary failed:', name, error?.message || error);
            }
        }

        if (typeof legacy[name] === 'function') {
            return legacy[name](...args);
        }

        throw new Error(`Academy repo function not available: ${name}`);
    };
}

const out = {};
const names = new Set([
    ...Object.keys(legacy || {}),
    ...Object.keys(primary || {})
]);

for (const name of names) {
    if (typeof primary[name] === 'function' || typeof legacy[name] === 'function') {
        out[name] = wrapFunction(name);
    } else {
        out[name] = primary[name] !== undefined ? primary[name] : legacy[name];
    }
}

module.exports = out;
